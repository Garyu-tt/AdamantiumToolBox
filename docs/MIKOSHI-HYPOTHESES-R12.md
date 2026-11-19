# Mikoshi R12 — bounded hypothesis-driven vocal experiments

R12 adds `mikoshi_hypotheses`, an independent, **stateless** MAS 1.0
provider which chooses an informative *next experiment* using the learned
confidence from `mikoshi_worldmodel`. This is not a language model,
self-consciousness, natural-speech learning or a universal planning agent.

## What happens during one deliberately started experiment
1. The user explicitly authorizes one experimental action in Classroom.
2. Classroom discovers `hypothesis-search`, `world-prediction`,
   `articulation` and optionally `motor-learning` from the live
   Toolbox capability graph. Missing actions hide the panel or fail before
   the first mutation.
3. If learned motor skills exist, the best-ranked learned position forms
   the search base; otherwise the standard neutral 560/1640 position is used.
   No permanent voice pitch, timbre or identity is changed.
4. `mikoshi_hypotheses.generate` emits at most eight legal nearby motors
   with bounded offsets. It neither renders audio nor writes memory.
5. For each candidate Classroom queries the *independent*
   `mikoshi_worldmodel.estimate` and sends its responses to
   `mikoshi_hypotheses.rank`. The latter selects the highest-uncertainty
   motor. Zero model experience yields an explicitly unknown prediction,
   never invented certainty or phoneme meaning.
6. Classroom invokes `world-prediction.forecast` before synthesis,
   `articulation.preview` and `.observe` for the real generated signal,
   then `world-prediction.observe` to measure prediction error/surprise.
7. The audio can be played in Classroom. This experiment does not
   automatically retrain the vocal motor; it tests and updates only the
   predicted acoustic consequences of motor actions.

## Security, boundaries, and failure recovery
- `hypothesis.inspect` and `hypothesis.propose` are independent rights.
  The hypothesis service has no stored state, microphone, internet,
  model downloads, kernel access, or cross-provider control.
- The user must also have `prediction.learn`, `phonetics.render`
  and corresponding read rights to run a real trial. The operation is
  explicitly clicked and bounded to **one** action.
- If a forecast is persisted but later synthesis or observation fails,
  the ticket is **not automatically retried**. Classroom displays the
  error and offers an explicit status check and authorized abort.
- Source approval is a caller assertion, NOT proof of recording consent,
  provenance, copyright clearance, or an immutable audit identity.
- This is a single-user prototype. Per-agent isolation, cryptographic
  action attestation and cross-MAS transactional recovery are not done.
- The `confidence` and information-score numbers are hand-engineered
  heuristics, not calibrated uncertainty. Incoming estimates are
  untrusted values unless checked by a trusted caller/provider.

## Acceptance / repeatable experiments
`node tests/mikoshi_hypotheses.test.mjs` verifies bounded candidate
generation, preference for uncertain outcomes, input validation, and
deterministic tie-breaking.
`node tests/mikoshi_hypotheses_live.test.mjs` launches **three real**
independent MAS HTTP services: hypothesis search, world prediction,
and acoustic articulation. It proves missing-skill preflight, a first
unmodeled experiment, followed by a novel experiment chosen after
updating world-model experience. No raw waveform is stored on disk.
`node tools/mas-check.mjs`, `python tools/check-size.py` and full CI
remain required.

**Scope:** This is early-stage active sensorimotor exploration using a
toy two-formant vocal instrument. It cannot understand spoken language,
create meaningful words, train freely from cartoons, or demonstrate
independent cognition. Human-audio benchmarks and trusted multi-sensory
grounding are still separate research stages.
