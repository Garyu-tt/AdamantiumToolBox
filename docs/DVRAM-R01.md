# DVRAM R01 — Deduplicated VRAM

Status: **tested CPU state machine only**, NOT a GPU kernel, CUDA-VMM backend, hardware VRAM saver, or installed MAS provider.

Tracked by https://github.com/Garyu-tt/AdamantiumToolBox/issues/115

## Objective
On supported GPUs, independent logical read-only GPU virtual addresses should map to one immutable physical allocation. An ordinary compatible GPU kernel then reads the same bytes without archive decompression. Modifications need explicit copy/remap at a synchronized boundary, not a fictional CUDA GPU page-fault COW.

## R01 contents
- standards/gpu/vram-model.mjs — bounded independent CPU-only model with SHA-256 candidate hashing, mandatory exact-byte equality, per-tenant isolation, allocation-granularity rounding, model budget, explicit COW and in-flight read-kernel leases.
- tests/vram_model.test.mjs — sharing, granularity, hash collision, tenant isolation, busy allocation, COW and failure atomicity.

Run:

    node tests/vram_model.test.mjs

The model explicitly publishes gpuDevicePresent:false and hardwareAliasing:false, and returns simulated:true in its stats. All reported physical allocation numbers are modeled aligned bytes; they are not GPU memory telemetry. GPU drivers, CUDA, HIP, and actual VRAM are not touched.

## Hardware implementation and acceptance gates
1. Query exact device, driver, and CUDA-VMM support dynamically. Check CU_DEVICE_ATTRIBUTE_VIRTUAL_MEMORY_MANAGEMENT_SUPPORTED and granularity before cuMemCreate/cuMemAddressReserve/cuMemMap/cuMemSetAccess. Device architectures including old P106-100/Pascal must NOT be assumed compatible. For HIP, verify the actual device and installed API.
2. If supported, test two readonly virtual allocations mapping the same physical pages and actual GPU read kernels. Verify outputs, memory usage and access permissions. Otherwise mark unsupported; never quietly claim CPU system RAM as VRAM.
3. Protect allocation lifetime under asynchronous kernels; enforce real stream synchronization before clone/remap, and do not assume transparent hardware COW.
4. Benchmark repeated transformers/lookup tables, independent duplicated weights, random tensors and hot mutable activations using actual device memory queries, alignment overhead, throughput and latency.
5. Publish a separate versioned optional MAS GPU memory provider only after real tests and independent security review. It must not be a hard dependency of Core, DRAM, DedupArc or ALT/GENESIS.
6. Follow-on compute-on-dedup must be explicitly marked as specialized kernels and measured separately from transparent ordinary GPU alias reads.

This is a narrow R01 API/algorithm experiment, not a production security boundary, multi-GPU VRAM pool, working driver hook or a 17x memory-savings claim. Keep all host secrets and privileged code in approved private sources.

## R02 — read-only NVIDIA CUDA VMM capability query

New: `experiments/dvram-cuda-probe.c` + `tests/dvram_cuda_probe.test.mjs`.

- No CUDA SDK/header required for this *read-only feature query*; uses `dlopen("libcuda.so.1")` and CUDA Driver API function pointers.
- Default prints `opt_in_required` without opening the driver. On explicit `--probe`, queries `cuInit`, driver API version, device count, compute capability and `cuDeviceGetAttribute(..., 102, ...)` for VMM availability. Attribute ID 102 is `CU_DEVICE_ATTRIBUTE_VIRTUAL_MEMORY_MANAGEMENT_SUPPORTED` in official NVIDIA `cuda.h`.
- It does **not** reserve virtual addresses, allocate physical GPU memory, launch a kernel, change driver settings or assume support on older GPUs.
- On unsupported/no-driver platforms, status is explicit; result never pretends GPU memory savings. Linux-only test skips on other platforms.

```bash
node tests/dvram_cuda_probe.test.mjs
cc -std=c11 -Wall -Wextra -Werror experiments/dvram-cuda-probe.c -ldl -o /tmp/dvram-probe
/tmp/dvram-probe --probe
```

Initial local isolated-container result: `cuda_driver_not_found`, zero actual devices probed. This does NOT imply that P106-100 or any user GPU lacks driver/VMM; probe each authorized physical node separately. Actual `cuMemCreate/AddressReserve/Map` and a readonly kernel alias test are a **later** hardware gate.
