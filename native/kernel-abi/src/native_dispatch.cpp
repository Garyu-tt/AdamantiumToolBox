#include "mas/native_dispatch.hpp"
#include <utility>
#include <vector>
#include <cstring>

namespace mas::native {
NativeDispatcher::NativeDispatcher(CapabilityGraph& graph, Authorize host_authorize)
    : graph_(graph), host_authorize_(std::move(host_authorize)) {}

bool NativeDispatcher::bind(const std::string& action, const std::string& owner,
                            const std::string& contract, Handler handler) {
  if (action.empty() || action.size() > 128 || owner.empty() ||
      owner.size() > 128 || contract.empty() ||
      contract.size() > 256 || !handler) return false;
  std::lock_guard<std::mutex> lock(mutex_);
  return bindings_.emplace(action, std::make_shared<Binding>(owner, contract, std::move(handler))).second;
}
bool NativeDispatcher::unbind(const std::string& action) {
  std::lock_guard<std::mutex> lock(mutex_);
  const auto found = bindings_.find(action);
  if (found == bindings_.end()) return false;
  found->second->enabled.store(false, std::memory_order_release);
  bindings_.erase(found);
  return true;
}

InvokeResult NativeDispatcher::invoke(std::string_view verified_principal,
    std::string_view action, std::uint64_t expected_revision,
    std::string_view request, char* output, std::size_t output_capacity,
    const std::atomic_bool& cancelled) noexcept {
  try {
    if (verified_principal.empty() || verified_principal.size() > 128 ||
        action.empty() || action.size() > 128 || !expected_revision ||
        request.size() > kMaxBytes || output_capacity > kMaxBytes ||
        (!output && output_capacity > 0))
      return {InvokeStatus::Invalid, graph_.revision(), 0};
    if (cancelled.load()) return {InvokeStatus::Cancelled, graph_.revision(), 0};

    const auto view = graph_.resolve(std::string(verified_principal),
                                     std::string(action), expected_revision);
    if (view.status == QueryStatus::StaleRevision)
      return {InvokeStatus::Stale, view.revision, 0};
    if (view.status != QueryStatus::Present || !view.capability)
      return {InvokeStatus::Denied, view.revision, 0};

    std::shared_ptr<Binding> binding;
    {
      std::lock_guard<std::mutex> lock(mutex_);
      const auto found = bindings_.find(std::string(action));
      if (found == bindings_.end())
        return {InvokeStatus::Unbound, view.revision, 0};
      binding = found->second;
    }
    if (!binding->enabled.load(std::memory_order_acquire) ||
        (view.capability->owner != binding->owner ||
         view.capability->contract != binding->contract))
      return {InvokeStatus::Denied, view.revision, 0};
    if (!host_authorize_ ||
        !host_authorize_(verified_principal, action, expected_revision))
      return {InvokeStatus::Denied, view.revision, 0};

    // Re-evaluate after host authorization to fence revocation that happened
    // while consulting policy. The admitted callback can still run concurrently
    // with *later* revocation; physical side effects need their own lease/fence.
    const auto latest = graph_.resolve(std::string(verified_principal),
                                       std::string(action), expected_revision);
    if (latest.status == QueryStatus::StaleRevision)
      return {InvokeStatus::Stale, latest.revision, 0};
    if (latest.status != QueryStatus::Present ||
        !latest.capability || (latest.capability->owner != binding->owner ||
         latest.capability->contract != binding->contract))
      return {InvokeStatus::Denied, latest.revision, 0};
    if (!binding->enabled.load(std::memory_order_acquire))
      return {InvokeStatus::Unbound, latest.revision, 0};
    if (cancelled.load()) return {InvokeStatus::Cancelled, latest.revision, 0};

    // Stage response bytes privately; never disclose a partial or rejected
    // handler result to the caller. Handlers are trusted, in-process code:
    // memory safety still requires OS/process sandboxing for hostile providers.
    std::vector<char> scratch(output_capacity);
    std::size_t written = 0;
    if (!binding->handler(request, scratch.empty() ? nullptr : scratch.data(),
                          output_capacity, written, cancelled))
      return {InvokeStatus::HandlerFailed, latest.revision, 0};
    if (written > output_capacity || written > kMaxBytes)
      return {InvokeStatus::OutputLimit, latest.revision, 0};
    if (cancelled.load()) return {InvokeStatus::Cancelled, latest.revision, 0};
    if (!binding->enabled.load(std::memory_order_acquire))
      return {InvokeStatus::Unbound, latest.revision, 0};
    // This read fences output publication; it cannot roll back side effects.
    const auto final_view = graph_.resolve(std::string(verified_principal),
                                           std::string(action), expected_revision);
    if (final_view.status == QueryStatus::StaleRevision)
      return {InvokeStatus::Stale, final_view.revision, 0};
    if (final_view.status != QueryStatus::Present ||
        !final_view.capability || (final_view.capability->owner != binding->owner ||
         final_view.capability->contract != binding->contract))
      return {InvokeStatus::Denied, final_view.revision, 0};
    if (written > 0) std::memcpy(output, scratch.data(), written);
    return {InvokeStatus::Ok, final_view.revision, written};
  } catch (...) {
    // Never propagate an optional provider exception through host dispatch.
    return {InvokeStatus::HandlerFailed, 0, 0};
  }
}
}  // namespace mas::native
