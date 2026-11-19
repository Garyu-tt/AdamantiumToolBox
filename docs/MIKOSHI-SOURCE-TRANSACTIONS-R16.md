# Mikoshi R16 — provider-enforced signed source pairs and receipt recovery

R16 hardens the existing R14/R15 real-audio/video training path. It
does **not** add a conversational LLM, autonomous camera operation, a
natural-speech model or production data collection.

## Wire contract: `mikoshi.source.permit.v2` payload
- The source-policy MAS app now optionally signs `pairBindings` when
  issuing a permit. Each binding contains an `audioHash` of the
  exact JSON `{samples,sampleRate}` and a `visualHash` of the exact
  JSON `{visualVector,visualAtMs,soundAtMs}`. Pair order, a lesson
  SHA-256 digest, purpose, participant-count claim, and a 60-second
  TTL are bound into the HMAC-SHA256 permit.
- Old v1 permits remain readable for source-policy compatibility but
  **cannot authorize any R16 guarded provider write**.
- Browser `av_policy.js` computes these hashes from transient
  in-memory events. A separate signed permit still represents an
  operator's claim, NOT proof of recording consent, content ownership,
  media provenance or observation timing.

## Independent MAS provider write boundaries
- Both `mikoshi_motifs` and `mikoshi_grounding` enable secure mode
  when provisioned with the same private `MIKOSHI_SOURCE_SIGNING_KEY`
  (minimum 32 UTF-8 bytes), or explicitly with
  `MIKOSHI_REQUIRE_SOURCE_PERMIT=1` plus that key.
- In secure mode, *all* `remember` and `teach` calls require a valid
  v2 permit, lesson digest, zero-based pair index and exactly matching
  content. `sourceApproved:true` alone no longer suffices.
- On a successful auditory write, `mikoshi_motifs` returns a signed
  `sourceReceipt` for its specific learned `soundId`, pair index
  and authorized audio digest. The grounding service checks that receipt
  against the bound audio hash, exact sound ID and visual hash **before**
  learning the association. One cannot simply submit a different
  sound ID with a valid visual permit.
- Cryptographic verification uses a small **vendored, byte-identical
  static protocol implementation in each app**. There is no runtime
  import, fixed endpoint or deployment dependency between MAS apps.
  A CI test fails if any copy diverges from the canonical version.
- In insecure legacy mode, the original `sourceApproved:true` write
  APIs remain for existing offline/synthetic experiments. **Do not
  expose legacy mode to untrusted/live training clients.**
- Shared HMAC credentials are a single trust domain, not independent
  identity proof. Server-side storage and secret rotation need a
  hardened host provisioning layer before production.

## Provenance, replay and interrupted writes
- Each secure service atomically saves its own learned state and a
  bounded provenance journal: opaque lesson digest, pair index,
  source kind, recorded time, expiry, hashed token key and result.
  No raw audio or raw RGB frames are stored in this metadata.
- Repeating an authorized pair within the 60-second write window
  returns its prior result without reinforcing the memory twice,
  including after service restart.
- Read-only actions `mikoshi_motifs.receipt` and
  `mikoshi_grounding.receipt` accept the signed lesson token, digest
  and index; they report whether the individual write completed.
  Readback is allowed up to 24 hours without extending write rights.
  Journals are capped; after that window recovery is not guaranteed.
- `Mikoshi Classroom` refuses to show the real-AV training button if
  either provider lacks its signed readback capability. On ambiguous
  failures it retains only an in-memory permit and the temporary
  lesson for **manual status inspection**, not automatic replay.
  Clearing the panel or remounting the UI discards this temporary
  recovery handle.
- These are two independent atomic file updates, **not a distributed
  transaction**. A motif write may succeed while the association
  fails. R16 can detect and avoid duplicate writes, but cannot yet
  guarantee cross-provider atomic rollback or complete reconciliation.

## Validation
- `tests/mikoshi_r16_secure_writes.test.mjs`: launches three actual
  authenticated MAS processes (policy, hearing memory and associations);
  rejects legacy-bypass flags and tampered content, verifies signed
  cross-provider receipts, idempotent write replay and restart readback.
- `tests/mikoshi_permit_contract.test.mjs`: verifies that the
  individually installed providers bundle identical static contracts.
- `tests/mikoshi_av_gate_view.test.mjs`: live-AV write controls remain
  hidden if the source-policy gate or signed provider readback is absent.
- Previous R15 synthetic lessons continue in explicitly unguarded
  fixture mode. The CPU/Windows CI, source-size and MAS isolation checks
  are still mandatory before merging.

**Not tested:** real subject consent verification, cryptographically
authenticated camera hardware, distributed transactions, durable
operator-specific recovery tokens, encrypted Noosphere export,
multi-tenant security or physical AV clock calibration. **Not deployed.**
