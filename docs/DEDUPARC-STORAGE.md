# DedupArc Storage Provider v1

Provider: standards/storage/darc.mjs (optional, not imported by microkernel).
Contract: mas-storage-provider-1. CLI: tools/archive.mjs.

Verified locally against an existing Windows DedupArc 0.7.0 binary; public
repository documents a newer 1.0 implementation. The adapter uses shared CLI:
create --balanced/--fast/--maximum, list, verify, info, extract.

Discovery: explicit executable path, DEDUPARC_BIN environment setting,
then per-user Windows DedupArc install convention relative to LOCALAPPDATA.
No absolute machine path or required GPU. If unavailable, it reports
deduparc_provider_unavailable; other applications remain functional.

Example:
    node tools/archive.mjs capabilities
    node tools/archive.mjs pack snapshot.darc ./apps
    node tools/archive.mjs verify snapshot.darc
    node tools/archive.mjs list snapshot.darc
    node tools/archive.mjs unpack snapshot.darc ./restored

Creates archives via temporary file, verifies then renames to destination.
Refuses to overwrite existing archives or existing restore directories.
Do not unpack untrusted archives without extractor sandboxing and path-validation.

Current API:
    snapshot: true, restore: true, list: true, verify: true
    randomAccess: false, inPlaceWrite: false, dependencies: false

Virtual read_file(path), write_file(path), list_files(), get_dependencies()
are architectural targets, NOT implemented. Published format v2 includes
file-to-block references; a true random-access reader must decompress only
necessary chunks. Writes need copy-on-write and atomic commit, not in-place
editing of a packed shared block. Dependency data comes from CodeGraph.

Future Mesh integration: optional signed .darc payloads. Validate digest,
manifest, compatibility and permissions before staging/activation.
Current signed MAS JSON transport remains unchanged until tested.
