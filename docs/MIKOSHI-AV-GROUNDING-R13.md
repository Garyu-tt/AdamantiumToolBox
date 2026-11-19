# Mikoshi R13 — acoustic/visual event association (no language model)

R13 adds two independent MAS 1.0 providers that can be used separately.
It is a **bounded experimental association pipeline**, not sighted
understanding, vocabulary, causal knowledge, or inference of object identity.

## 1. mikoshi_vision — visual event candidates
- Standalone, stateless `visual-events` skill, guarded by `vision.inspect`.
- `mikoshi_vision.analyze` accepts 2–12 timestamped 8×8 RGB frames,
  normalized 0–1. It detects changes of at least two pixels and emits
  unlabeled numeric ten-element vectors, event times and coarse
  `appear` / `disappear` / `change` flags.
- No camera, screenshots, people detection, background capture, OCR,
  semantic labels, face recognition, object names, or learned vision model.
- Raw pixels are not returned by this provider and are never persisted.
  Tiny 8×8 frames are **only a test input contract**, not high-resolution
  perception or actual observation of human surroundings.

## 2. mikoshi_grounding — temporal association memory
- Independent `audiovisual-association` skill with
  `grounding.inspect` for `.status`, `.associate`, `.recall` and
  `grounding.learn` for `.teach`.
- Accepts an anonymous ten-value visual event vector and a previously
  discovered auditory motif ID (`m00001`, etc.) with observed times.
  Audio/video pairing is rejected when events differ by over 250 ms.
- Online clustering of up to 128 visually similar event types,
  at most 12 sound links per visual cluster. Stores only centroids,
  co-occurrence counts and opaque IDs. No raw pixel arrays or waveforms.
- Recognition waits for at least two matching observations and >=75%
  share for the strongest sound before setting `ready:true`.
  Contradictory or insufficient evidence returns `ready:false`
  instead of claiming a correct word or meaning.
- Reverse `recall` returns visual cluster IDs by known sound ID; these
  remain *correlations*, not semantic referents.
- Private opt-in `MIKOSHI_GROUNDING_STATE` and previous metadata
  snapshot; serialized writes; no cross-agent access model yet.

## 3. Synthetic Classroom example
`av_panel.js` dynamically discovers live `visual-events`,
`audiovisual-association`, `articulation` and `auditory-memory`
actions. A teacher can produce a **synthetic** colored-square and
vowel-like sound exercise, examine changes without learning, explicitly
approve each teaching pass, then query associations.
The timestamps are assigned by the synthetic demo, not extracted from
natural synchronized video/audio. Repeating the demo twice counts as two
**simulated exposures**, not two independent samples of real life.

The Classroom has **no live video/camera capture** for this R13. Actual
licensed AV ingest, source provenance, sensor clock alignment, separate
scene/object tracking, repeated independent encounters and temporal
causal interventions require later plugins and validation.
No automatic training from cartoons, user recordings or third-party
media is authorized.

## Validation and honest limitations
`node tests/mikoshi_vision.test.mjs`
`node tests/mikoshi_grounding.test.mjs`
`node tests/mikoshi_av_live.test.mjs`
`node tools/mas-check.mjs`
`python tools/check-size.py`

Unit tests verify distinct visual changes, no raw pixels returned,
temporal mismatch rejection, conservative abstention, ambiguous links,
no raw audio/video persistence, and input bounds. Integration test starts
**four independent authenticated MAS HTTP services** (visual events,
vocal articulation, auditory motifs, and audiovisual association) and
checks repeated correlated observations.

`sourceApproved:true` is only an application assertion, not proof
of consent or licensing. Simultaneous audio/video occurrences do not
establish causation or comprehension. No real hardware, Noosphere
migration, deployment, production merge, or general intelligence claim.
