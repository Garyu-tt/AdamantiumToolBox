#include "mas_read_provider_v1.h"
#include <string.h>
struct mas_probe_state { unsigned int invoked; };
mas_read_provider_status_v1 mas_probe_c_read(
    void* userdata, const mas_read_provider_request_v1* req,
    mas_read_provider_reply_v1* rep) {
  struct mas_probe_state* state = (struct mas_probe_state*)userdata;
  if (!req || !rep || !state || req->struct_size != sizeof(*req) ||
      req->abi_version != MAS_READ_PROVIDER_ABI_V1 ||
      rep->struct_size != sizeof(*rep) ||
      rep->abi_version != MAS_READ_PROVIDER_ABI_V1 ||
      req->capability_bytes != 10 ||
      memcmp(req->capability_id, "alpha.read", 10) ||
      (req->payload_bytes && !req->payload) ||
      (req->payload_bytes > rep->capacity))
    return MAS_READ_PROVIDER_REJECTED;
  state->invoked += 1;
  if (req->is_cancelled(req->cancel_context))
    return MAS_READ_PROVIDER_CANCELLED;
  if (req->payload_bytes) memcpy(rep->payload, req->payload, req->payload_bytes);
  rep->written = req->payload_bytes;
  return MAS_READ_PROVIDER_OK;
}
