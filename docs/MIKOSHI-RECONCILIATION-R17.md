# Mikoshi R17 — read-only reconciliation and explicitly approved repair

R17 adds the independent `mikoshi_reconciliation` MAS 1.0 provider
and optional Classroom recovery controls. It builds on R16 signed
per-pair receipts. This is not an autonomous transaction coordinator,
shared memory store, background agent or conversational language model.

## Read-only receipt classification

- Skill: `source-reconciliation`, permission `reconciliation.inspect`.
  Actions: `mikoshi_reconciliation.status` and `.assess`.
- The service receives a bounded list of readback results. It is
  stateless and has **no access to other MAS apps, storage or keys**.
  Its classification is not independently cryptographically attested:
  the composition must obtain receipts from the authenticated hearing
  and audiovisual memory services.
- For each pair, classify:
  - `complete`: motif and grounding receipts both exist and agree on
    the same sound ID
  - `missing-link`: learned sound exists, association absent
  - `missing-both`: neither provider reports a write
  - `inconsistent`: an association exists without its motif, or sound
    identifiers contradict each other
- No repair is permitted for `inconsistent` or `missing-both`.
  A `missing-link` is eligible for an explicit **link-only** repair
  only during the original signed 60-second write window.
- The service returns a decision, **never directly writes**.

## Classroom operator flow

- `av_recovery.js` reads R16 provider receipts for each pair,
  asks the standalone reconciliation provider to classify them and
  refuses mismatches or expired write windows.
- `av_recovery_ui.js` provides two distinct buttons:
  readback/inspection and **explicit manually consented repair**.
  The recovery button is hidden if R17 or the signed R16 readback
  capabilities are not discovered in the host capability graph.
- Only a verified `missing-link` can be repaired. Before each
  association write, Classroom verifies the exact original lesson
  digest, active source policy, signed motif receipt and a 2-second
  margin before permit expiration. It **never creates a new motif**
  during repair and does not replay a pair already complete.
- After repair, it reads receipts again and displays whether the
  entire lesson has completed. Errors remain visible; no recursive
  retry is run and raw audio/video is not persisted by R17.

## Limitations and release gates

- A short session permit and its in-memory lesson are still needed.
  Remounting Classroom/closing the browser loses that handle.
  Recovery after the 60-second write window is **read-only** (R16
  supports receipt inspection for up to 24 hours).
- This is not cross-provider ACID, distributed rollback, exactly-once
  delivery over all failure conditions, or automatic repair of
  corrupted state. Existing R16 idempotent service writes and atomic
  per-service file state are prerequisites.
- The source-policy HMAC token is based on **operator statements**,
  not independently verified participant consent, hardware origin,
  recording rights or identity. No production deployment.
- No multi-tenant agent isolation, Noosphere export or source gate
  extension to other memory producers is claimed.

### Tests

`node tests/mikoshi_reconciliation.test.mjs` — states, expiry,
contradictions and malformed receipts.

`node tests/mikoshi_reconciliation_service.test.mjs` — independent
authenticated MAS HTTP graph and read-only assessment.

`node tests/mikoshi_av_recovery.test.mjs` — deliberately triggered
link-only recovery; no duplicate writes; expiry, consent and
contradiction checks.

Run source budget, MAS graph checks and full CI. Synthetic tests do
not validate a real browser crash or live camera/microphone hardware.
