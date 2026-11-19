#ifndef MAS_HOST_API_V1_H
#define MAS_HOST_API_V1_H
#include <stdint.h>

#if defined(_WIN32)
#define MAS_HOST_EXPORT __declspec(dllexport)
#else
#define MAS_HOST_EXPORT __attribute__((visibility("default")))
#endif

#ifdef __cplusplus
extern "C" {
#endif

#define MAS_HOST_ABI_V1 UINT32_C(0x00010000)

typedef struct mas_host_v1 mas_host_v1;
typedef enum mas_status_v1 {
  MAS_OK = 0,
  MAS_ERR_ARGUMENT = 1,
  MAS_ERR_VERSION = 2,
  MAS_ERR_STATE = 3,
  MAS_ERR_RESOURCE = 4,
  MAS_ERR_INTERNAL = 5
} mas_status_v1;

typedef enum mas_host_state_v1 {
  MAS_HOST_CREATED = 0,
  MAS_HOST_RUNNING = 1,
  MAS_HOST_STOPPED = 2
} mas_host_state_v1;

typedef struct mas_host_config_v1 {
  uint32_t struct_size;
  uint32_t abi_version;
  uint32_t flags; /* R01: must be zero */
  uint32_t reserved; /* must be zero */
} mas_host_config_v1;

typedef struct mas_host_snapshot_v1 {
  uint32_t struct_size; /* input: sizeof(mas_host_snapshot_v1) */
  uint32_t state;       /* mas_host_state_v1 */
  uint64_t generation; /* increases on each successful start */
} mas_host_snapshot_v1;

typedef struct mas_host_api_v1 {
  uint32_t struct_size;
  uint32_t abi_version;
  mas_status_v1 (*create)(const mas_host_config_v1 *, mas_host_v1 **);
  mas_status_v1 (*start)(mas_host_v1 *);
  mas_status_v1 (*stop)(mas_host_v1 *);
  mas_status_v1 (*snapshot)(mas_host_v1 *, mas_host_snapshot_v1 *);
  void (*destroy)(mas_host_v1 *);
} mas_host_api_v1;

/* Exact version, exact table size, no write on error. C-compatible symbol. */
MAS_HOST_EXPORT mas_status_v1 mas_host_get_api_v1(
    uint32_t requested_abi, uint32_t table_bytes, mas_host_api_v1 *out_api);

#ifdef __cplusplus
}
#endif
#endif
