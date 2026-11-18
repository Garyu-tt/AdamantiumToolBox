# Frank Adapter Contract 1 — language-independent executor ABI

**Scope**: independent Frank Addons, never classic MAS plugin loading.
The MAS application `frankenstein` bridges activated packages into a
single capability graph. The bridge does not maintain a hardcoded list
of languages, interpreters, providers or files.

## Package
`frank-addons/<language>/<id>/frank-addon.json`, schema `frank-addon-1`:
package id, language, version, entry, adapter capability, permissions
and declared action IDs. Nested modules belong to the same package hash.
Its identity is `frank.<language>.<id>`. MAS actions have the form
`frankenstein.<language>.<id>.<action>`.

## Provider contract
A language provider is independently installed and started, listens on
owner-approved loopback only, and registers its capability and port in a
separate private Frank registry. Every request requires `X-Internal-Key`.

- `GET /health` (HTTP 200 only when executor isolation is ready):
  `{"protocol":"frank-adapter-1","adapter":"frankenstein.adapter.<language>"}`
- `POST /invoke`:
  `{"protocol":"frank-adapter-1","package":{"key":"frank.<language>.<id>"},
  "action":"<declared-action>","params":{}}`
- Successful response: `{"result":<JSON-compatible-value>}`.

Path and entry properties supplied by callers are **not trusted**.
Provider must resolve package identity through the local manifest,
approved digest, language, adapter registration and declared action,
then take and revalidate a private package snapshot before executing.
Bridge exposes only packages approved locally with zero permission scopes.
Removing a provider removes its actions from the live graph.

## Execution profile
Each provider supplies its own interpreter/runner and health probe to the
shared Linux Bubblewrap worker. Nothing executes in the host process.
Common worker isolates namespaces/network, read-only package and runner,
and bounds wall time, serialized input and output. Language-specific
restrictions belong to the provider (Python uses resource RLIMITs,
JavaScript currently limits V8 old-space to 64 MiB; Rust compiles a std-only
crate with rustc, using its trusted toolchain and linker only inside the
namespace).

## Compatibility and security
Protocol version, package manifest, MAS graph and approval registry are
separate versioned contracts. Unknown major versions fail closed.
Classic MAS applications run with Core alone; missing Frankenstein or
missing language provider must not block them.

This is an **experimental** sandbox. It is **not** sufficient for arbitrary
hostile code: no seccomp profile, cgroup process limits, per-addon OS users,
signed publisher provenance, sealed immutable release snapshots, or audited
delegated identities are implemented. Treat only owner-reviewed sources
as eligible for local approval. Windows execution is unsupported.
