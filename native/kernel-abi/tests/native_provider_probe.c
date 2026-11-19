#include "mas_read_provider_v1.h"
#include <string.h>

struct mas_test_probe_state { unsigned int calls; };

mas_read_provider_status_v1 mas_test_echo_c(
    void* context, const mas_read_provider_request_v1* request,
    mas_read_provider_reply_v1* reply) {
  struct mas_test_probe_state* state = (struct mas_test_probe_state*)context;
  if (!request || !reply || !state ||
      request->struct_size != sizeof(*request) ||
      request->abi_version != MAS_READ_PROVIDER_ABI_V1 ||
      reply->struct_size != sizeof(*reply) ||
      reply->abi_version != MAS_READ_PROVIDER_ABI_V1 ||
      request->capability_bytes != 10 ||
      memcmp(request->capability_id, "alpha.read", 10) ||
      (request->payload_bytes && !request->payload) ||
      !reply->payload || request->payload_bytes > reply->capacity)
    return MAS_READ_PROVIDER_REJECTED;
  ++state->calls;
  if (request->is_cancelled(request->cancel_context))
    return MAS_READ_PROVIDER_CANCELLED;
  if (request->payload_bytes)
    memcpy(reply->payload, request->payload, request->payload_bytes);
  reply->written = request->payload_bytes;
  return MAS_READ_PROVIDER_OK;
}
