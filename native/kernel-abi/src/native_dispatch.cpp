#include "mas/native_dispatch.hpp"
#include <array>
#include <cstring>
#include <utility>
namespace mas::native {
namespace {
bool valid_name(const std::string& s) {
  if (s.empty() || s.size() > 128) return false;
  const auto c = static_cast<unsigned char>(s[0]);
  if (!((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z'))) return false;
  for (unsigned char ch : s) {
    if (!((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') ||
          (ch >= '0' && ch <= '9') || ch == '.' || ch == '_' || ch == '-'))
      return false;
  }
  return true;
}
uint32_t cancelled_query(void* context) noexcept {
  auto* flag = static_cast<const std::atomic<bool>*>(context);
  return flag->load(std::memory_order_acquire) ? 1u : 0u;
}
}  // namespace
DispatchStatus ReadOnlyDispatcher::register_readonly(
    const std::string& id, const std::string& owner,
    mas_read_provider_invoke_v1 callback, void* context) {
  if (!valid_name(id) || !valid_name(owner) || !callback)
    return DispatchStatus::Invalid;
  auto entry = std::make_shared<ProviderEntry>();
  entry->owner = owner;
  entry->callback = callback;
  entry->context = context;
  std::lock_guard<std::mutex> guard(mutex_);
  if (providers_.count(id)) return DispatchStatus::Invalid;
  providers_.emplace(id, std::move(entry));
  return DispatchStatus::Ok;
}
DispatchStatus ReadOnlyDispatcher::unregister_readonly(const std::string& id) {
  std::lock_guard<std::mutex> guard(mutex_);
  const auto it = providers_.find(id);
  if (it == providers_.end()) return DispatchStatus::ProviderUnavailable;
  if (it->second->in_flight) return DispatchStatus::Busy;
  providers_.erase(it);
  return DispatchStatus::Ok;
}
DispatchResult ReadOnlyDispatcher::invoke_readonly(
    const std::string& principal, const std::string& id,
    std::uint64_t expected_revision, const std::vector<std::uint8_t>& input,
    const std::atomic<bool>& cancelled) {
  auto result = [&](DispatchStatus status) -> DispatchResult {
    return {status, graph_.revision(), {}};
  };
  if (!valid_name(principal) || !valid_name(id) ||
      input.size() > MAS_READ_PROVIDER_MAX_REQUEST_V1)
    return result(DispatchStatus::Invalid);
  if (cancelled.load(std::memory_order_acquire))
    return result(DispatchStatus::Cancelled);
  auto allowed = graph_.resolve(principal, id, expected_revision);
  if (allowed.status == QueryStatus::StaleRevision)
    return result(DispatchStatus::StaleRevision);
  if (allowed.status != QueryStatus::Present)
    return result(DispatchStatus::Denied);
  std::shared_ptr<ProviderEntry> entry;
  {
    std::lock_guard<std::mutex> guard(mutex_);
    const auto it = providers_.find(id);
    if (it == providers_.end()) return result(DispatchStatus::ProviderUnavailable);
    entry = it->second;
    if (entry->owner != allowed.capability->owner)
      return result(DispatchStatus::Denied);
    ++entry->in_flight;
  }
  /* Hold provider context pinned until callback completes. No locks during
     callback; revocations and unrelated calls may advance concurrently. */
  struct Guard {
    std::mutex& mu;
    std::shared_ptr<ProviderEntry> entry;
    ~Guard() { std::lock_guard<std::mutex> lock(mu); --entry->in_flight; }
  } lifetime{mutex_, entry};
  // Close the register/check race and the revoke-before-use window.
  allowed = graph_.resolve(principal, id, expected_revision);
  if (allowed.status != QueryStatus::Present ||
      allowed.capability->owner != entry->owner)
    return result(DispatchStatus::StaleRevision);
  if (cancelled.load(std::memory_order_acquire))
    return result(DispatchStatus::Cancelled);
  std::array<std::uint8_t, MAS_READ_PROVIDER_MAX_RESPONSE_V1> scratch{};
  mas_read_provider_request_v1 request{
      sizeof(mas_read_provider_request_v1), MAS_READ_PROVIDER_ABI_V1,
      expected_revision, id.data(), static_cast<uint32_t>(id.size()),
      input.empty() ? nullptr : input.data(), static_cast<uint32_t>(input.size()),
      cancelled_query, const_cast<std::atomic<bool>*>(&cancelled)};
  mas_read_provider_reply_v1 reply{
      sizeof(mas_read_provider_reply_v1), MAS_READ_PROVIDER_ABI_V1,
      scratch.data(), static_cast<uint32_t>(scratch.size()), 0};
  mas_read_provider_status_v1 code = MAS_READ_PROVIDER_FAILED;
  try { code = entry->callback(entry->context, &request, &reply); }
  catch (...) { return result(DispatchStatus::ProviderError); }
  // No data escaped to the caller before final revoke/cancel checks.
  if (cancelled.load(std::memory_order_acquire))
    return result(DispatchStatus::Cancelled);
  allowed = graph_.resolve(principal, id, expected_revision);
  if (allowed.status != QueryStatus::Present ||
      allowed.capability->owner != entry->owner)
    return result(DispatchStatus::StaleRevision);
  if (code == MAS_READ_PROVIDER_CANCELLED) return result(DispatchStatus::Cancelled);
  if (code != MAS_READ_PROVIDER_OK ||
      reply.struct_size != sizeof(reply) ||
      reply.abi_version != MAS_READ_PROVIDER_ABI_V1 ||
      reply.payload != scratch.data() || reply.capacity != scratch.size() ||
      reply.written > reply.capacity)
    return result(DispatchStatus::ProviderError);
  return {DispatchStatus::Ok, expected_revision,
          {scratch.data(), scratch.data() + reply.written}};
}
}  // namespace mas::native
