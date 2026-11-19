# Wayfire native IPC adapter — optional Linux component
This is **only a transport and framing library**, not a compositor or an
authorization layer. The C++17 code has zero dependencies on Qt,
CppMicroServices, Leonardo or MAS Core.

The Unix socket is always an explicit operator-supplied absolute path.
Do not embed user, session, host, or node paths in source. Each invocation
must be permitted through a fresh authorized capability graph and local
policy before calling this library. Never use it from the Qt event thread.
Wayfire itself runs as a separate optional process. The codec uses native-
endian framing consistent with the current Wayfire fork's IPC plugin.

Run: cmake -S native/wayfire -B build/wayfire && cmake --build build/wayfire
&& ctest --test-dir build/wayfire --output-on-failure

The tests use a mock Unix socket and do NOT prove real Wayfire, Wayland
session integration, frame pacing, screen capture, or window control.

## Real compositor metrics (explicit opt-in)
`mas_wayfire_diagnostics --socket /operator/approved/wayfire.sock --samples 60 --interval-ms 250`
reads **only** the Wayfire IPC `wayfire/render-metrics` method from the
owner-configured socket. stdout contains the Wayfire JSON response; stderr
contains per-request transport latency in microseconds. This is not proof
of application FPS; inspect `refresh-ns`, `predicted-path`, composed/direct
scanout timers and presentation timestamps from the actual compositor.

The IPC rules plugin must expose render-metrics; otherwise the compositor
returns an error. Never infer a valid socket from a user or node identifier.
The CLI performs no mutation and is not wired to MAS Core until an approved
capability-bound service adapter exists.
