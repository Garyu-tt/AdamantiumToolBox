# Mechanicus Gauntlet R01 — fail-closed QA intake
Independent optional MAS app `gauntlet`. No Core changes or direct Claude/Fixiki imports.

## Verified path
Submit `gauntlet.submit` with `{task_id,plugin_id,author_id,files,sha256}`.
Files are UTF-8 text keyed by relative path; checksum is SHA-256 of JSON
sorted by filename. Intake validates MAS 1.0 manifest, source budgets,
paths, syntax (Node --check, never execution), forbidden environment literals,
import boundaries and live catalog port conflicts. The case becomes BUILDING.

An independent CI runner sends `gauntlet.attest` with
`{task_id,report,signature}`. The signature must be Ed25519 over the exact
UTF-8 JSON stringification of `report`; its public key is obtained from
`GAUNTLET_QA_PUBLIC_KEY_FILE`, provisioned by the owner. Each named test
includes nonempty log, status and SHA-256 of that log. Missing/failing checks
block release. The signer must be independent of the reported author.
Changed shared contracts require signed complete graph scope and dependent
plugin checks. Dynamic registration, removal, update and live UI checks
are mandatory when the signed runner declares UI support.

## Lifecycle and permissions
Cases are private local state in `GAUNTLET_STATE_DIR`, or OS user state.
`GAUNTLET_MAX_ATTEMPTS` (default 3) and `GAUNTLET_MAX_COST_USD` (default 20)
are configurable. A bad candidate yields a content-addressed diagnostic and
a PENDING_DISPATCH Fixiki request. This outbox does not claim actual dispatch
to an unavailable Fixiki or Claude capability. Fixiki runs independently.
Pass yields immutable candidate and PENDING_DELIVERY request, with
approval REQUIRED. It does not sign, install, activate, or bypass owner policy.
The existing Lifecycle signer and `--approve` activation gate remain separate.

## Security limits of R01
Intake does not execute submitted source. Real builds/unit/integration/security
tests must occur on an isolated, separately authenticated CI worker; R01
verifies its cryptographic evidence, not the execution environment.
The CI report issuer must be separately provisioned and audited.
Source scan is heuristic, not a complete malicious-code proof.
Text-only source candidates are not yet MAS Mesh signed bundles.
State persistence is atomic per file, not a cross-process transaction.
Only in-process submissions are serialized. The release queue is local,
not a connected delivery service; its consumer requires a separate adapter.
No live MAS graph client was present when this branch was authored.

## R02 graph inspection and repair routing
`gauntlet.detail` returns an authorized case summary and verified diagnostic
by task ID. Blocker resource nodes reflect source SHA-256, status, diagnostic
reference and affected component IDs. Nodes appear/disappear on live graph
requests; shell UI re-renders from polling without a page reload. This does
not establish a distributed event notification transport.
Fixiki outbox requests declare the semantic capability `task.blocker.triage`
rather than a hardcoded provider. Dispatch remains PENDING_DISPATCH until
a trusted capability exists and an authenticated delivery receipt is observed.

`gauntlet.outbox` is a read-only, hash-verified queue inspector.
Clients may request only `fixiki-outbox` or `delivery-outbox` and may
not mutate queue records through this API. Neither queue is considered
delivered until an independently authorized adapter acknowledges the request.

## CI flakiness observed during R02
A pull_request CI run on the exact same commit as a green push run
failed in Frank Rust's namespace test. Observed failure modes were
`rustc must work in CI Linux namespace` and a later `adapter_http_400`
after roughly 19 seconds. The Rust compilation deadline was 16 seconds,
the host bridge call timeout 18 seconds. R02 retains production defaults
but provisions bounded 45/60-second limits inside the Rust CI test,
raises the sandbox CPU ulimit to 30 seconds, and exposes safe adapter error
codes for diagnostics. Only independent repeated CI runs can confirm
whether this remedies the intermittent failure.
