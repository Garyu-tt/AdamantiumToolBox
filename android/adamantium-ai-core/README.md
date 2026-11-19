# Adamantium AI Core (Android) — R01

**Purpose:** opt-in, mobile-only AI compute node and phone capability gateway for the Adamantium MAS pool. This is NOT the Toolbox Core, not a universal native bridge replacement, and not the chat server.

## Current source slice
- Android app starts/stops a user-visible foreground watchdog, monitors battery, thermal condition, ABI, and memory, and sends signed outbound heartbeats to a user-provisioned HTTPS + pinned-SPKI gateway.
- A small **real** CPU inference primitive (`ml.dense.f32`) executes bounded dense layer tasks leased by an enrolled pool coordinator. A result is acknowledged before another task is fetched. It is not an LLM, GPU, NPU, or TPU execution backend.
- No arbitrary commands, app enumeration, contacts, camera, mic, files, root, Accessibility, or browser control are granted. Future adapters must be separate permissioned MAS capabilities.
- Optional chat button opens a configured HTTPS Conversation Hub/LibreChat-compatible site in an Android WebView. It is **not** a complete chat implementation, and chat backend is not bundled.
- GENESIS-like genes are descriptors for portable capabilities and local learned calibration: see `docs/ADAMANTIUM-AI-CORE-R01.md`. No model weight genome reconstruction exists here.

## Build
Open `android/adamantium-ai-core` in Android Studio with Android SDK 35 and JDK 17; Gradle Android plugin 8.9.1. Run `:app:assembleDebug`. No Gradle wrapper is checked in in this source slice. Requires device Android 10+ (API 29); targets Android 15 (35). **Uncompiled on Android in this PR**; actual physical-device acceptance pending.

## Enrollment and operation
1. Build/install. In the screen, provide an operator-approved HTTPS Gateway URL and the SHA-256 Base64 **SPKI certificate pin** for its verified TLS server cert. Neither address nor pin is embedded in source.
2. Read the displayed device public key and node id; pin it to the approved gateway's device registry separately. The app does not auto-enroll itself or grant access.
3. Press Save, then Start pool watchdog. Stop turns off contribution immediately. Initial policy only accepts tiny CPU dense inference tasks, with battery/thermal checks.
4. A configured Chat URL is separately validated as HTTPS (no JavaScript bridge), then opens in WebView using the website's own auth flows.
5. Review network service side contract and test fixture before accepting leases. Sending a signed heartbeat alone does not prove a matching backend exists.

## Constraints
- On Android 15+ a `dataSync` FGS has a 6h/day quota, so this app uses a specifically declared *specialUse* FGS for user-visible opt-in compute. This classification must be reviewed for deployment/distribution. Android OS may kill/restrict service, including restart/boot. No guarantee of permanent uptime.
- No indefinite wakelock, no hidden battery-optimization bypass. Never run workloads outside user consent; no unverified hardware acceleration advertised.
- Thermal severity/battery gates revoke available capacity. No automatic retry of an ambiguous task result: idempotency is enforced by lease/result id at the gateway, and each pulse has a unique request ID.
- A signed device request is **not** server-side authorization. The pool verifies pre-enrolled key, exact scoped actions, request age, nonce, quotas, budgets and lease eligibility.
- Public source contains no user credentials/private nodes, addresses or data. Private implementation remains outside public repository.
- This change does not alter existing Core, MAS Browser, Conversation Hub, native ABI work or five developer automations.

## Acceptance (not yet claimed)
Android debug build; install on Pixel 4 XL and Pixel 9; foreground + boot/restart behavior; offline/timeout/reconnect; key enrollment and TLS pin mismatch; denied lease; battery/thermal release; `ml.dense.f32` numerical test; signed result idempotency; independent source QA, and existing repository test suite.

## R02 Android runtime: WireGuard mesh + model artifacts
- Mobile runtime only. No server provisioning, new chat/orchestrator implementation, or remote device administration.
- Operator imports a standard WireGuard .conf into Android; the profile is parsed, restricted to non-default split-tunnel routes and encrypted at rest with an Android Keystore AES-GCM key. Operator explicitly grants Android VPN consent. Uses official com.wireguard.android:tunnel userspace GoBackend.
- Opt-in watchdog attempts tunnel reconnection. The compute lease/pulse client refuses to send if the tunnel is down, or if any resolved HTTPS gateway address lies outside the configured mesh AllowedIPs; HTTPS hostname verification, SPKI pinning and signed device requests remain required.
- Virtual LAN subnet, tunnel endpoint, peer keys and server roles come entirely from the operator-provisioned WireGuard file. No private keys or site addresses committed.
- Via Android SAF the operator may register GGUF, safetensors, ONNX, GENESIS/genome and binary weight artifacts without loading entire model files into Java heap. Content URI is persisted. ModelRegistry.open() returns a read-only file descriptor for a future verified inference provider.
- **Do not confuse artifact import with LLM execution:** R02 does not contain llama.cpp/ONNX/GENESIS decoders, GPT-OSS-120B inference, GPU/NPU kernels or live model compatibility tests. Only the prior bounded dense f32 executor is active.
- Android allows one VpnService at a time; other VPN apps may conflict. Always-on VPN must be opted into in Android settings. No continuous operation guarantee.
- Model file grants depend on backing document provider. Do not import third-party WireGuard configuration unless the operator has verified its peers/AllowedIPs. Import and model permissions do not authorize uploading weights into the pool.
- Requires acceptance on a physical phone and independently checked build. No fabricated VPN connection, server-side virtual LAN or hardware performance results.
