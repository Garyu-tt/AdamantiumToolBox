#ifndef MAS_READ_PROVIDER_V1_H
#define MAS_READ_PROVIDER_V1_H
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif

/* Independent callback ABI for trusted, synchronous, READ-ONLY native providers.
 * Exact versions and structures. No STL, exceptions or cross-boundary allocation.
 * No link to Node.js, Qt, CppMS, OS services or host system libraries required. */
#define MAS_READ_PROVIDER_ABI_V1 UINT32_C(0x00010000)
#define MAS_READ_PROVIDER_MAX_REQUEST_V1 UINT32_C(8192)
#define MAS_READ_PROVIDER_MAX_RESPONSE_V1 UINT32_C(4096)

typedef int32_t mas_read_provider_status_v1;
enum {
  MAS_READ_PROVIDER_OK = 0,
  MAS_READ_PROVIDER_REJECTED = 1,
  MAS_READ_PROVIDER_FAILED = 2,
  MAS_READ_PROVIDER_CANCELLED = 3
};

typedef uint32_t (*mas_read_provider_cancelled_v1)(void *cancel_context);

typedef struct mas_read_provider_request_v1 {
  uint32_t struct_size;
  uint32_t abi_version;
  uint64_t graph_revision;
  const char *capability_id;   /* length-delimited; never assume NUL */
  uint32_t capability_bytes;
  const uint8_t *payload;     /* valid only during synchronous callback */
  uint32_t payload_bytes;
  mas_read_provider_cancelled_v1 is_cancelled;
  void *cancel_context;
} mas_read_provider_request_v1;

typedef struct mas_read_provider_reply_v1 {
  uint32_t struct_size;
  uint32_t abi_version;
  uint8_t *payload;           /* host-owned, caller may write up to capacity */
  uint32_t capacity;
  uint32_t written;           /* provider MUST set <= capacity */
} mas_read_provider_reply_v1;

typedef mas_read_provider_status_v1 (*mas_read_provider_invoke_v1)(
    void *provider_context, const mas_read_provider_request_v1 *request,
    mas_read_provider_reply_v1 *reply);
#ifdef __cplusplus
}
#endif
#endif
