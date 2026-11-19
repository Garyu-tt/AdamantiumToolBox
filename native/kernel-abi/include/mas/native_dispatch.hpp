#pragma once
#include "mas/native_graph.hpp"
#include "mas_read_provider_v1.h"
#include <atomic>
#include <cstdint>
#include <map>
#include <memory>
#include <mutex>
#include <string>
#include <vector>

namespace mas::native {
/* PRIVATE C++ host API; NOT an ABI for plugin, network, browser or agent use.
 * The caller MUST supply a principal authenticated by its own trusted ingress.
 * This source-only fixture MUST NOT receive unauthenticated external input. */
enum class DispatchStatus {
  Ok, Invalid, Denied, StaleRevision, Cancelled,
  ProviderUnavailable, ProviderError, Busy
};
struct DispatchResult {
  DispatchStatus status = DispatchStatus::Invalid;
  std::uint64_t revision = 0;
  std::vector<std::uint8_t> output;
};

class ReadOnlyDispatcher final {
 public:
  explicit ReadOnlyDispatcher(const CapabilityGraph& graph) : graph_(graph) {}
  ReadOnlyDispatcher(const ReadOnlyDispatcher&) = delete;
  ReadOnlyDispatcher& operator=(const ReadOnlyDispatcher&) = delete;

  /* Register only trusted in-process callbacks, with owner identity pinned by
     the host. This is NOT dynamic plugin loading or native code sandboxing. */
  DispatchStatus register_readonly(const std::string& id,
                                   const std::string& owner,
                                   mas_read_provider_invoke_v1 callback,
                                   void* context);
  DispatchStatus unregister_readonly(const std::string& id);

  DispatchResult invoke_readonly(const std::string& authenticated_principal,
                                 const std::string& capability_id,
                                 std::uint64_t expected_graph_revision,
                                 const std::vector<std::uint8_t>& input,
                                 const std::atomic<bool>& cancelled);
 private:
  struct ProviderEntry {
    std::string owner;
    mas_read_provider_invoke_v1 callback = nullptr;
    void* context = nullptr;
    std::uint32_t in_flight = 0;
  };
  const CapabilityGraph& graph_;
  std::mutex mutex_;
  std::map<std::string, std::shared_ptr<ProviderEntry>> providers_;
};
}  // namespace mas::native
