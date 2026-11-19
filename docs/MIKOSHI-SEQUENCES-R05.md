# Mikoshi R05 — temporal auditory sequence learning (no LLM)

An independently bootable `mikoshi_sequences` MAS 1.0 app learns
**ordered chains of previously discovered acoustic motif IDs**. It is
not a language model, phoneme recognizer, ASR, grammar system or thinker.

## Functions
- `model.mjs`: short context statistics. Learns patterns of two, three
  and four consecutive motif identifiers, preserving coarse inter-motif
  gaps: quick (<180 ms), medium (<450 ms), slow (<900 ms).
- Any gap >=900 ms separates independent episodes. No transition spans
  that boundary. Predictions back off from a three-ID context to shorter
  contexts when the exact longer sequence was not observed.
- `mikoshi_sequences.status`: patterns and frequent observed chains.
- `mikoshi_sequences.predict`: candidate next IDs with conditional
  observation share. These fractions are NOT calibrated probabilities.
- `mikoshi_sequences.teach`: only explicitly approved lessons; bounded
  to 2–24 events, 1,024 stored patterns and private state quotas.
- `MIKOSHI_SEQUENCE_STATE`: opt-in owner-private JSON with one previous
  snapshot. Contains only IDs, binned timings and counts; no raw audio.

## Architecture and limits
The provider publishes `skill.schema=mikoshi.skill.v1` with domain
`auditory-sequence`. The Classroom discovers this at runtime and receives
recognized IDs from the separately installed `mikoshi_motifs` provider;
no direct import or mandatory dependency between these MAS apps.
The interactive Classroom allows a teacher to manually select the gap
between demonstration clicks. **These timings are manually configured**,
not extracted from continuous speech. Automatic speech segmentation and
real-time event timing still require a separate provider.

An experimental short-sound memory cannot by itself discover words,
understand utterances, infer intentions or act autonomously. Pattern
matching is only tested on synthetic ID sequences, not real dialogues.

## Consent and boundaries
Scope `sequence.inspect` permits reads and `sequence.learn` permits
updates when private storage is configured. The `sourceApproved:true`
parameter is merely the operator's assertion; it does NOT establish
recording consent, media licensing, or data provenance. No silent
background recording or cross-agent learning is enabled. A production
design needs per-agent isolation, provenance checks, quotas, rollback
and Noosphere-integrated persistent identity. Do not load foreign data
or private voice recordings in this repository.

## Validation
`node tests/mikoshi_sequences.test.mjs` verifies order sensitivity,
recurring patterns, pause boundaries, variable-order fallback and state
validation. `node tests/mikoshi_sequences_service.test.mjs` starts an
independent service and checks authenticated graph discovery, denied
writes, concurrent learning, persisted counts and read-only restarts.
Also run `node tools/mas-check.mjs`, `python tools/check-size.py` and
full CI. No live neural cognition, new human-speech benchmarks or
production service deployment is claimed.
