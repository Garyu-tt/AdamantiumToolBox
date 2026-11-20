# factory_anchor — independent Mechanicus MAS R09

**Standalone CPU-first MAS app**: Node >=22, manifest MAS 1.0, host-delegated Core + app only. No dependency on Node-RED, Noosphere, JediControl, network_* or other optional apps.

Independent factory_anchor reads pinned R05 source journal, R06 source witness and R08 anchor signatures. With independently provisioned Ed25519 signing keys and explicit opt-in, it can record another signed R08-compatible **audit-only** checkpoint. No app package installation, production publish, DNS, firewall change or MAS Lifecycle approval.

## Scoped actions

| Action | MAS required scope | Meaning |
|---|---|---|
| factory_anchor.status | factory_anchor.read | Read readiness, public head and basic state |
| factory_anchor.latest | factory_anchor.read | Read public latest signed receipt and public SPKI |
| factory_anchor.inspect | factory_anchor.read | Check strict current/stale source signature against anchored revision |
| factory_anchor.attest | factory_anchor.attest + explicit signing opt-in | CAS append one Ed25519 signed audit receipt; no production permissions |

Core and app both require the host-authenticated connection: loopback-only MAS HTTP, X-Internal-Key, ADA_CAPS scope. GET /health reports liveness only. Failure to load valid trust, keys or journal disables capabilities. Read-only mode never reads a private key. Signing is disabled unless FACTORY_ANCHOR_ALLOW_SIGNING=yes exactly.

## Operator-provisioned storage

Use a new, explicit absolute directory with anchor-identity.json, anchor-public.pem and anchor.jsonl. When signing is permitted, also provision anchor-private.pem in PKCS#8 Ed25519 format with POSIX mode 0600. Keys are NOT generated, enrolled, copied, logged or moved by the plugin. Do not transfer the private key from a notebook to a server.

Environment variables: FACTORY_ANCHOR_ROOT (absolute existing directory), FACTORY_ANCHOR_PUBLIC_PIN (independently pinned anchor public SHA256), FACTORY_ANCHOR_SOURCE_PIN (independently pinned source R06 public SHA256), FACTORY_ANCHOR_LEDGER_ID (explicit ledger ID), FACTORY_ANCHOR_ALLOW_SIGNING (exact yes or disabled), ADA_INTERNAL_KEY and ADA_CAPS (MAS host scopes), APP_PORT (operator-approved loopback port). Nothing autostarts or opens public ingress.

## Audit-only signing

The caller supplies a whitelisted public R05/R06 bundle plus expectedReceiptHash, expectedSourceSequence and expectedSourceHead. Verification must be current, source IDs pinned, anchor sequence strictly increasing, writer lock exclusive, signatures Ed25519, append fsynced and signature replay checked before acknowledgement. Duplicate replay requires the current signed head. Torn tails or foreign locks fail closed. View cache is not the authority. All outputs preserve masApprovalGranted=false, productionPublished=false, enforcement=false.

The independent cryptographic signature cannot alone prove independent administrators, immutable storage or actual authorization. This package does not modify production, run a privileged network reconciler, install Node-RED nodes, or attach a permanent daemon.

## Run isolated tests

node --test packages/factory_anchor/tests/store.test.mjs packages/factory_anchor/tests/http.test.mjs
node --test packages/factory_anchor/tests/core.integration.test.mjs

Core isolation runs only the real Core plus this app in a temporary runtime. A stopped app disappears from the capability graph. This PR remains source/draft until explicit operator-authorized MAS installation.
