#include "mas_host_api_v1.h"
#define REQUIRE(expr) do { if (!(expr)) { \
  fprintf(stderr, "FAIL %s:%d: %s\n", __FILE__, __LINE__, #expr); \
  return 1; } } while (0)
#include <stddef.h>
#include <stdio.h>

int main(void) {
  mas_host_api_v1 api = {0};
  REQUIRE(mas_host_get_api_v1(MAS_HOST_ABI_V1 + 1, sizeof(api), &api) == MAS_ERR_VERSION);
  REQUIRE(api.create == NULL); /* failed negotiations cannot alter caller data */
  REQUIRE(mas_host_get_api_v1(MAS_HOST_ABI_V1, sizeof(api) - 1, &api) == MAS_ERR_ARGUMENT);
  REQUIRE(mas_host_get_api_v1(MAS_HOST_ABI_V1, sizeof(api), NULL) == MAS_ERR_ARGUMENT);
  REQUIRE(mas_host_get_api_v1(MAS_HOST_ABI_V1, sizeof(api), &api) == MAS_OK);
  REQUIRE(api.struct_size == sizeof(api) && api.abi_version == MAS_HOST_ABI_V1);
  REQUIRE(api.create && api.start && api.stop && api.snapshot && api.destroy);

  mas_host_v1 *host = NULL;
  mas_host_config_v1 cfg = {sizeof(cfg), MAS_HOST_ABI_V1, 0, 0};
  REQUIRE(api.create(NULL, &host) == MAS_ERR_ARGUMENT);
  REQUIRE(api.create(&cfg, NULL) == MAS_ERR_ARGUMENT);
  cfg.flags = 1;
  REQUIRE(api.create(&cfg, &host) == MAS_ERR_ARGUMENT && host == NULL);
  cfg.flags = 0;
  cfg.abi_version += 1;
  REQUIRE(api.create(&cfg, &host) == MAS_ERR_VERSION && host == NULL);
  cfg.abi_version = MAS_HOST_ABI_V1;
  REQUIRE(api.create(&cfg, &host) == MAS_OK && host != NULL);

  mas_host_snapshot_v1 snap = {sizeof(snap), 99, 99};
  REQUIRE(api.snapshot(host, &snap) == MAS_OK);
  REQUIRE(snap.state == MAS_HOST_CREATED && snap.generation == 0);
  REQUIRE(api.stop(host) == MAS_ERR_STATE);
  REQUIRE(api.start(host) == MAS_OK);
  REQUIRE(api.start(host) == MAS_ERR_STATE);
  REQUIRE(api.snapshot(host, &snap) == MAS_OK);
  REQUIRE(snap.state == MAS_HOST_RUNNING && snap.generation == 1);
  REQUIRE(api.stop(host) == MAS_OK);
  REQUIRE(api.stop(host) == MAS_ERR_STATE);
  REQUIRE(api.start(host) == MAS_OK);
  REQUIRE(api.snapshot(host, &snap) == MAS_OK);
  REQUIRE(snap.state == MAS_HOST_RUNNING && snap.generation == 2);
  snap.struct_size = 0;
  REQUIRE(api.snapshot(host, &snap) == MAS_ERR_ARGUMENT);
  REQUIRE(api.stop(host) == MAS_OK);
  api.destroy(host);
  api.destroy(NULL);
  puts("MAS_NATIVE_ABI_V1_OK: C caller, version rejection, lifecycle, restart");
  return 0;
}
