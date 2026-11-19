#include "mas_host_api_v1.h"
#include <mutex>
#include <new>

struct mas_host_v1 {
  std::mutex mutex;
  uint32_t state = MAS_HOST_CREATED;
  uint64_t generation = 0;
};

namespace {
mas_status_v1 create_host(const mas_host_config_v1 *cfg, mas_host_v1 **out) noexcept {
  if (!out || !cfg) return MAS_ERR_ARGUMENT;
  *out = nullptr;
  if (cfg->struct_size != sizeof(*cfg) || cfg->flags || cfg->reserved)
    return MAS_ERR_ARGUMENT;
  if (cfg->abi_version != MAS_HOST_ABI_V1) return MAS_ERR_VERSION;
  try {
    *out = new (std::nothrow) mas_host_v1;
    return *out ? MAS_OK : MAS_ERR_RESOURCE;
  } catch (...) { return MAS_ERR_INTERNAL; }
}
mas_status_v1 start_host(mas_host_v1 *host) noexcept {
  if (!host) return MAS_ERR_ARGUMENT;
  try {
    std::lock_guard<std::mutex> guard(host->mutex);
    if (host->state == MAS_HOST_RUNNING) return MAS_ERR_STATE;
    host->state = MAS_HOST_RUNNING;
    ++host->generation;
    return MAS_OK;
  } catch (...) { return MAS_ERR_INTERNAL; }
}
mas_status_v1 stop_host(mas_host_v1 *host) noexcept {
  if (!host) return MAS_ERR_ARGUMENT;
  try {
    std::lock_guard<std::mutex> guard(host->mutex);
    if (host->state != MAS_HOST_RUNNING) return MAS_ERR_STATE;
    host->state = MAS_HOST_STOPPED;
    return MAS_OK;
  } catch (...) { return MAS_ERR_INTERNAL; }
}
mas_status_v1 snapshot_host(mas_host_v1 *host, mas_host_snapshot_v1 *out) noexcept {
  if (!host || !out || out->struct_size != sizeof(*out)) return MAS_ERR_ARGUMENT;
  try {
    std::lock_guard<std::mutex> guard(host->mutex);
    out->state = host->state;
    out->generation = host->generation;
    return MAS_OK;
  } catch (...) { return MAS_ERR_INTERNAL; }
}
void destroy_host(mas_host_v1 *host) noexcept { delete host; }
}

extern "C" MAS_HOST_EXPORT mas_status_v1 mas_host_get_api_v1(
    uint32_t requested_abi, uint32_t table_bytes, mas_host_api_v1 *out_api) {
  if (!out_api || table_bytes != sizeof(mas_host_api_v1)) return MAS_ERR_ARGUMENT;
  if (requested_abi != MAS_HOST_ABI_V1) return MAS_ERR_VERSION;
  const mas_host_api_v1 api = {
    sizeof(mas_host_api_v1), MAS_HOST_ABI_V1,
    create_host, start_host, stop_host, snapshot_host, destroy_host
  };
  *out_api = api;
  return MAS_OK;
}
