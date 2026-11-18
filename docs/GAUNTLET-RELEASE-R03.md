# Gauntlet R03 — Signed delivery preflight (no activation)

The Gauntlet app is independent of the Mesh, signer and Lifecycle runtime.
`gauntlet.preflight` compares the active task's current source SHA-256,
candidate and delivery content-addressed files, signed QA evidence, and
canonical MAS payload bytes. Old queued candidates are explicitly rejected
after a newer task revision. It returns `READY_FOR_AUTHORIZED_SIGNER`, not
`RELEASED`. The permission requirement is `approval: REQUIRED`.

A hermetic CI integration test exercises a temporary, newly generated
Ed25519 signer identity, real `seal`/`trustEnvelope`, content-addressed
Mesh `receive`, and `planActivation`. It asserts the absence of an owner
policy blocks planning and that `activate(..., false)` rejects execution.
No production identity, approval, installation or activation is created.

The R03 CI proof is for contract compatibility, NOT actual delivery.
A production signer and authorized delivery transport remain unprovisioned.
A delivery worker must read the current queue, call preflight just before
signing, verify the payload SHA-256, use the owner-approved signed Lifecycle
route, and confirm selected hash + target identity after activation.
Never trust old outbox rows, task descriptions or a successful model reply.
