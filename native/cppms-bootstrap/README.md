# Independent CppMicroServices bridge
The optional registry maps *already authorized* MAS capability metadata to
native CppMicroServices objects. A service reference never authorizes MAS invoke.
A full native host must always verify actions against the live MAS Core graph.
The registry has atomic validation on duplicate inputs and removes revoked
service registrations, allowing ServiceTracker observers to react.

The CI job builds the user's pinned CppMicroServices fork in an isolated runner.
No production node is modified. The native Qt shell does not yet depend on this
registry; the later integration must keep CppMicroServices optional for web and
core-only operation. The workflow pins an immutable upstream commit for reproducibility.
