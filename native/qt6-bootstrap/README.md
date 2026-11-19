# Qt6 SDK bootstrap (isolated CI)
This is a **minimal native Qt6 compile-and-smoke slice**, not the Stage 7 runtime.
It validates installation of Qt6 Widgets, Network and Test on the runner; a stable
window with F11 fullscreen, incremental capability list, and revocation.
The list is intentionally not connected to Core and never invokes unknown actions.

The full Stage 7 prototype currently remains a local conversation artifact.
Do not claim this CI job verifies Stage 7, CppMicroServices, Wayfire, the real
Desktop Workspace or Leonardo. Those need separate integration builds.
Linux install: `sudo apt-get install qt6-base-dev qt6-base-dev-tools`.
Windows laptop installation is separate and currently blocked by a host-key
verification error; do not bypass SSH verification.
