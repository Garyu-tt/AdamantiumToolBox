# ADR-R01: virtual source repositories and Adamantez boundary

**Status:** proposed integration contract. The source registry tooling in this change validates metadata only. It does **not** yet fetch Git data, grant access, isolate agents or enforce production security.

## Two independently controlled source spaces

- `Garyu-tt/AdamantiumToolBox` (**public**): minimal core, MAS contracts, API types, generic clients, open modules, public examples and non-sensitive docs.
- `Garyu-tt/AdamantezTolls` (**private**): proprietary/restricted MAS implementations and server-side providers. Production credentials, private Noosphere contents and server state belong in **neither** Git repository.
- `Adamantez` is a planned, **independent** MAS security gateway. Do not make it a hard dependency of microkernel startup, silently assume it exists, or advertise unavailable capabilities. Closed operations require server-side authorization when deployed.

A Git branch/worktree can be an independent **logical source unit**. It is not an independent repository ACL: a GitHub user with repository read permission can fetch **all** branches. For different read permissions, use distinct repositories/accounts.

## Discovery before placement

Source location is NOT plugin identity, trust, permission or activation. The same module can originate from a public branch, a private provider, a local user path or a signed package. Source registry records identify retrieval mechanisms; runtime graph registration happens only after package provenance, signature, explicit authorization and health checks.

Contract: `standards/repository-sources/registry.example.json`; validation: `node tools/check-repository-sources.mjs <path>`. `source-registry-v1` is versioned separately from MAS 1.0; it does not change existing manifests or Core discovery.

For public entries, Git repository and ref may be written explicitly. For private/restricted entries, the **public** registry contains only a capability resolver (e.g. `source.resolve`), not a clone URL, credentials, host inventory or absolute path. The private resolver authenticates the caller and returns a scoped signed artifact or an authorized denial, not the private Git tree. Endpoint addresses and credentials stay outside public source.

Private repository names may be referenced in architecture documents but must not be treated as authentication secrets. Access policies live server-side.

## Lifecycle and rights

1. Discover allowed source descriptors from scoped local configuration or a real source registry provider.
2. Authenticate agent/user/node; authorize the exact read/delegation/installation purpose **on the private side**.
3. Materialize only the approved ref/commit into an isolated workspace; pin its SHA and enforce allowed paths. Never hand agents broad GitHub credentials when narrow operations suffice.
4. Scan changes and output for secrets/confidential material; review all CI jobs/actions and artifacts. Never mirror private source into public logs, PRs or workflow outputs.
5. Verify signed content, permission changes, dependencies and health before explicit activation. Use prior verified version for rollback.
6. Show only entitled capabilities in the UI, and check permission again on the server at every invocation. UI hiding is not access control.
7. Maintain independent audit and fail closed for new privileged work when authorization is unavailable.

## Five autonomous peer developers

Keep their existing schedules, roles, delegation logic and workloads unchanged. Add this as a **routing reminder** in the shared peer instruction document: classify each task PUBLIC/PRIVATE/RESTRICTED; use only allowed source scopes; do not expose private implementation in public PRs, prompts, logs or artifacts; request a narrowly scoped private workspace through approved capabilities; preserve independently verified work and existing recursive recovery behavior. No direct privileged source access or private agent delegation is implied by this note.

## Migration plan without forced rewrites

- Phase 0 (here): bootstrap private repo policy; add public source registry contract, validator, docs and agent reminder.
- Phase 1: inventory current public source and Git history for accidental sensitive material. Existing public history remains public even if files are removed; remediate disclosures by rotating affected secrets and taking targeted history-cleanup steps if necessary.
- Phase 2: implement a standalone source registry provider, private release producer and Adamantez authorization gateway, each with MAS manifests and test fixtures. Preserve Core + App without private source.
- Phase 3: migrate carefully selected private implementations after compatibility, access, audit, CI and rollback verification. Do not move files or turn on production routes automatically as part of this ADR.

**Security limitation:** a private repo, static manifest, file filter or security plugin name is not itself protection from unauthorized runtime access. Require actual enforcement and tests before deployment.
