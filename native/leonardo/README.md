# Leonardo Native Vector — optional MAS graphics provider
Standalone browser-independent C++17 CPU image generator. No Qt, Wayfire, GUI,
GPU or Node required for the engine/service. Legacy Node launch adapter under
`mas/` is **only** for the existing MAS supervisor; it does not generate SVG.

Build: `cmake -S native/leonardo -B build/native-leonardo -DCMAKE_BUILD_TYPE=Release`,
then `cmake --build build/native-leonardo` and
`ctest --test-dir build/native-leonardo --output-on-failure`.

Requires Boost.JSON/Beast/Asio 1.83, OpenSSL Crypto and C++17.
Start `mas-leonardo-native` with APP_PORT, ADA_INTERNAL_KEY (24+ bytes),
ADA_CAPS supplied by the authorized plugin runtime. Loopback-only.
MAS graph resource advertises `mas-graphics-provider-1` and action
`leonardo_native_vector.generate` for image/render SVG. No static Leonardo
imports; router selects providers from the authorized graph.

At most 32 worker threads, at most 128 in-flight requests, strict 32KB JSON
body/8KB headers, 3-second timeout, HTTP 503 overload, constant-time key
comparison. C++ generator is deterministic and mirrors legacy JS for tested
prompts, not an AI art generator.

DO NOT copy `mas/` to active apps or install until the executable has been
built and approved on a node. Operator must select a collision-free manifest
service port, an approved binary path and permissions. Do not overwrite a live
provider, deploy from CI or embed credentials into the repo.

**Open integration gap:** current Node supervisor launches Node service.mjs
by convention. A future native supervisor should launch C++ directly and
remove even this compatibility shim, without changing MAS provider API.
