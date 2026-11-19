# Mikoshi R06 — sensorimotor vocal links (non-LLM)

An independent `mikoshi_motorlinks` MAS 1.0 plugin learns a motor
configuration for each previously observed acoustic motif ID. It does
**not** synthesize or analyze audio itself, and does not import another
application. Toolbox Classroom dynamically composes it with existing
`articulation` and `auditory-memory` providers via live graph actions.

## Learning loop
1. Teacher explicitly selects or records a sound and recognizes/learns its
   motif identifier using the existing `auditory-memory` skill.
2. An authorized operator clicks the opt-in eight-step practice button.
   The classroom asks the motor controller for a proposed motor setting
   (`f1`, `f2`) for that stable motif ID.
3. The existing `articulation.preview` action synthesizes the attempted
   sound. `articulation.observe` extracts normalized spectral features
   from the teacher reference and generated attempt.
4. Classroom computes a bounded mean-squared spectral error and calls
   `motor-learning.feedback` with the exact pending trial number, motor
   setting, scalar error and explicit source approval.
5. The controller persists the best observed motor, proposes a bounded
   neighboring adjustment and eventually exhausts its step budget.
6. `motor-learning.status` provides the best learned motor for replay
   through the independent articulatory renderer.

No raw voice recording is passed to or persisted by `mikoshi_motorlinks`.
The motor state includes motif IDs, formant motor positions and scalar error.
The pitch anchor remains owned by `mikoshi_phonetics` and unmodified.
There is no hard-coded dependency on eSpeak, Piper, Noosphere or Core internals.

## APIs
- `mikoshi_motorlinks.status` (permission `motor.inspect`): catalog.
- `mikoshi_motorlinks.propose` (`motor.inspect`): exact next trial.
- `mikoshi_motorlinks.feedback` (`motor.learn`, private storage):
  ordered reward. Stale attempts are rejected to prevent duplicate updates.

Private `MIKOSHI_MOTOR_STATE` opts into durable state. A prior snapshot
is kept at `.previous`; at most 128 motifs and 160 trials per motif.
The proposed motor search is deterministic and bounded, designed for
CPU-only execution with isolated app lifecycles and capability revocation.

## Limitations and protections
- This optimizes two formant parameters for **short vowel-like sounds**.
  It does NOT learn consonant articulation, syllable duration, continuous
  speech, semantics or an independent thinking brain.
- MSE on normalized spectra may not predict perceptual sound similarity.
  Synthetic validation is not evidence of intelligibility on natural speech.
- The explicit `sourceApproved:true` value is only caller assertion, not
  an independent copyright/provenance or recording-consent proof.
- Scalar error returned by Classroom is trusted only within the manually
  approved prototype. Production must validate reward provenance and
  per-agent access boundaries. The current storage is not multi-tenant.
- Never copy a real singer's distinctive vocal identity or model weights.
  The target remains an original, high, soft, clear and expressive voice.

## Acceptance
`node tests/mikoshi_motorlinks.test.mjs`
`node tests/mikoshi_motorlinks_service.test.mjs`
`node tools/mas-check.mjs`
`python tools/check-size.py`

Tests must confirm measurable spectral loss reduction, immutable source
state, bounded motor candidates, write/replay protection, authorization,
read-only restart, no raw audio retained and isolated MAS startup.
Real-world listening evaluations, permissioned ingestion, provenance,
latency and privacy isolation remain mandatory before deployment.
