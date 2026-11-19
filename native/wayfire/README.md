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
