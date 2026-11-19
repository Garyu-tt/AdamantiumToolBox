#include "mas/native_c_provider.hpp"
#include <algorithm>
#include <cstdint>
#include <string_view>
#include <utility>
namespace mas::native {
namespace {
uint32_t cancelled_query(void* ctx) noexcept {
  return static_cast<const std::atomic_bool*>(ctx)->load(std::memory_order_acquire)
      ? 1u : 0u;
}
bool valid_name(std::string_view s) {
  if (s.empty() || s.size() > 128) return false;
  if (!((s[0] >= 'a' && s[0] <= 'z') || (s[0] >= 'A' && s[0] <= 'Z'))) return false;
  for (unsigned char c : s) {
    if (!((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
          (c >= '0' && c <= '9') || c == '.' || c == '_' || c == '-')) return false;
  }
  return true;
}
}
bool bind_c_read_provider(NativeDispatcher& dispatcher,
                          const std::string& id,
                          const std::string& owner,
                          const std::string& contract,
                          mas_read_provider_invoke_v1 callback,
                          void* trusted_context) {
  if (!callback || !valid_name(id)) return false;
  return dispatcher.bind(id, owner, contract, [id, callback, trusted_context](
      std::string_view input, char* output, std::size_t capacity,
      std::size_t& written, const std::atomic_bool& cancelled) -> bool {
    written = 0;
    if (input.size() > MAS_READ_PROVIDER_MAX_REQUEST_V1 ||
        (capacity && !output)) return false;
    const auto bounded = std::min(capacity,
        static_cast<std::size_t>(MAS_READ_PROVIDER_MAX_RESPONSE_V1));
    auto* buffer = reinterpret_cast<uint8_t*>(output);
    mas_read_provider_request_v1 req{
        sizeof(req), MAS_READ_PROVIDER_ABI_V1,
        id.data(), static_cast<uint32_t>(id.size()),
        input.empty() ? nullptr : reinterpret_cast<const uint8_t*>(input.data()),
        static_cast<uint32_t>(input.size()), cancelled_query,
        const_cast<std::atomic_bool*>(&cancelled)};
    mas_read_provider_reply_v1 reply{
        sizeof(reply), MAS_READ_PROVIDER_ABI_V1, buffer,
        static_cast<uint32_t>(bounded), 0};
    mas_read_provider_status_v1 code = MAS_READ_PROVIDER_FAILED;
    try { code = callback(trusted_context, &req, &reply); }
    catch (...) { return false; }
    if (code == MAS_READ_PROVIDER_CANCELLED && cancelled.load()) return true;
    if (code != MAS_READ_PROVIDER_OK ||
        reply.struct_size != sizeof(reply) ||
        reply.abi_version != MAS_READ_PROVIDER_ABI_V1 ||
        reply.payload != buffer || reply.capacity != bounded ||
        reply.written > bounded) return false;
    written = reply.written;
    return true;
  });
}
}  // namespace mas::native
