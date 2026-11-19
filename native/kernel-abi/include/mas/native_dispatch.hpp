#pragma once
#include "mas/native_graph.hpp"
#include <atomic>
#include <cstddef>
#include <cstdint>
#include <functional>
#include <map>
#include <mutex>
#include <string>
#include <string_view>

namespace mas::native {

// HOST-ONLY service. Caller must authenticate principal before invoking.
// A graph visibility grant is never a right to execute an action.
enum class InvokeStatus {
  Ok, Invalid, Denied, Stale, Unbound, Cancelled, HandlerFailed, OutputLimit
};
struct InvokeResult {
  InvokeStatus status = InvokeStatus::Invalid;
  std::uint64_t revision = 0;
  std::size_t bytes = 0;
};
using Authorize = std::function<bool(std::string_view verified_principal,
                                     std::string_view action,
                                     std::uint64_t graph_revision)>;
// Handler writes only into host-allocated output; zero-copy view valid during call.
// Cancellation is cooperative; no guarantee to undo an already started side effect.
using Handler = std::function<bool(std::string_view request, char* output,
                                   std::size_t capacity, std::size_t& written,
                                   const std::atomic_bool& cancelled)>;

class NativeDispatcher final {
 public:
  static constexpr std::size_t kMaxBytes = 65536;
  NativeDispatcher(CapabilityGraph& graph, Authorize host_authorize);
  // Bind/unbind are trusted host lifecycle operations, never plugin exports.
  bool bind(const std::string& action, const std::string& owner, Handler handler);
  bool unbind(const std::string& action);
  InvokeResult invoke(std::string_view verified_principal, std::string_view action,
                      std::uint64_t expected_revision,
                      std::string_view request, char* output,
                      std::size_t output_capacity,
                      const std::atomic_bool& cancelled) noexcept;

 private:
  struct Binding { std::string owner; Handler handler; };
  CapabilityGraph& graph_;
  Authorize host_authorize_;
  std::mutex mutex_;
  std::map<std::string, Binding> bindings_;
};
}  // namespace mas::native
