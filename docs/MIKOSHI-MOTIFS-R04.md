# Mikoshi R04 — auditory motif memory without a language model

R04 introduces an independent MAS 1.0 provider `mikoshi_motifs`.
It requires neither LLM, speech recognition nor a catalog of predefined
letters, vowels, phonemes or words. The current implementation learns
short **acoustic motifs**. These are NOT proven linguistic phonemes.

## Core + provider
- `encoder.mjs`: 12 kHz short PCM (2200–4096 samples), silence gating,
  two Hann-windowed 1024-point FFTs, 11 perceptually coarse bands each.
  The resulting 22-dimensional amplitude-normalized spectral signature
  contains no textual labels or raw waveform history.
- `cluster.mjs`: bounded online clustering. Novelty distance creates
  `m00001`, `m00002`, etc.; similar heard examples reinforce existing
  prototypes with a running centroid and observation count. Neither
  user-defined word labels nor neural language models are used.
- `store.mjs`: optional owner-private `MIKOSHI_MOTIFS_STATE` file.
  Atomic JSON writes, one prior metadata snapshot (`.previous`).
  The stored data contains no raw audio; state is bounded to 256 units.
- `service.mjs`: independent `/health`, `/graph`, `/invoke`.
  `mikoshi_motifs.status`, `.recognize`, `.remember` are separate,
  permission-checked typed actions. Requires `motifs.inspect` for read
  and `motifs.learn` plus configured private storage to train.
- `view.js`: standalone read-only catalog; no dependencies on Classroom.
- Classroom discovers `skill.schema=mikoshi.skill.v1`,
  `skill.domain=auditory-memory` and composes optional recognition and
  opt-in learning alongside auditory-motor articulation. The reference
  can come from a synthetic lesson or user-initiated microphone capture.

## Safeguards and limitations
- A caller explicitly requesting learning also asserts
  `sourceApproved:true`. **This boolean is not a verifiable legal or
  consent proof**. A production provider must check signed media
  provenance/permission; do not automatically train from arbitrary cartoons,
  conversations or other people's recordings.
- No background recording, no published user voice, no private recordings
  in Git, no cross-user copying, no automatic activation, no LLM.
- Isolated MAS runtime shares the usual OS user's privileges: it is not an
  execution sandbox. This is a single-instance prototype, not multi-tenant
  tenancy or a complete Noosphere persistence backend.
- Recognition is only of *short similar spectral shapes*, tested against
  synthetic vowel-like stimuli. A pitch shift, speaker change, coarticulation,
  music or noise may create false novelty and fragmentation.
- `threshold=.095` is an experimental algorithm parameter, NOT a measured
  phoneme threshold. No claims of word comprehension, ASR or cognition.

## Future opt-in providers
1. Voice activity detection and continuous spectral change-point segmentation.
2. Pitch- and speaker-invariant auditory features and similarity calibration.
3. Phonetic-motor association: discover a motif, try articulation, listen to
   the output, update its motor link without overwriting voice identity.
4. Temporal sequences, spoken-word concepts and audiovisual grounding from
   appropriately licensed sources, under independent permissions.
5. Safe memory migration to Noosphere, per-agent keys, snapshots and
   observable rollback; distributed resource scheduling and quotas.
6. Independent evaluation on held-out human speech and unseen sound patterns.

## Validation
`node tests/mikoshi_motifs.test.mjs`
`node tests/mikoshi_motifs_service.test.mjs`
`node tools/mas-check.mjs`
`python tools/check-size.py`
Full CPU-only and Windows CI remain required.

Unit tests prove amplitude-tolerant reinforcement, novelty separation,
non-mutation, silence rejection; integration tests start the real standalone
service, reject unauthorized/unsanctioned learning and check persistence.
A physical-microphone test and listening evaluation are not yet complete.
