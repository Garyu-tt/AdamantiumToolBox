# Mikoshi R03 — auditory-motor vowel learning (no LLM)

R03 adds `mikoshi_phonetics`, an independently bootable MAS 1.0 app
and an optional Classroom widget. No changes to the microkernel or the
read-only `plugins/mikoshi` adapter.

## Actual behavior
- `synth.mjs`: deterministic harmonic + formant vowel synthesizer.
  Fixed `anchorHz` represents an initial pitch identity (default 235 Hz).
  Learnable first and second formants (`f1`, `f2`) represent crude articulation.
- `spectrum.mjs`: Hann-window FFT, ten fixed audio-frequency bands;
  amplitude-normalized vector, independent of text or phoneme transcription.
- `learner.mjs`: bounded coordinate search that minimizes spectral mismatch
  between a teacher PCM frame and its own synthesis. No pretrained model,
  word tokenizer, language model, cloud service or static phoneme lookup.
- `service.mjs`: `/health`, `/graph`, `/invoke` with host delegated auth.
  `phonetics.observe`, `phonetics.preview`, `phonetics.imitate`,
  `phonetics.status` are conditionally exposed according to live permissions.
- `store.mjs`: optional `MIKOSHI_PHONETICS_STATE` file. Stores only
  small motor parameters and numeric progress; NOT raw lesson audio.
- `mikoshi_classroom/phonetic_panel.js`: optional live-discovered skill
  with three synthetic example vowels. Teacher and learner playback,
  immediate feedback and the error metric form one interactive experience.

## Security and consent
Scopes: `phonetics.inspect`, `phonetics.render`, `phonetics.learn`.
Training only exists when private state path is explicitly configured and
learning permission is granted. It also requires `sourceApproved:true`;
that bit is a caller assertion, NOT a license or consent verification.
Real media ingestion must validate its own provenance/consent separately.
No microphone capture or internet download is performed by R03.
Private state and agent identity must not be committed to the repository.
The audio, formants and pitch anchor are not copied from a real singer.

## Limitations
This is vowel-like acoustic imitation, NOT ASR, phoneme segmentation, speech
understanding, conversation or autonomous reasoning. It may fit non-vowel
sounds badly and has no speaker-invariant hearing. Synthetic lessons share
the motor generator; passing them does not show generalization to speech.
The pitch anchor and frequency bands are engineering constants for the demo.
No claims of sentience or similarity to an identifiable singer.

## Next milestones
- Gain- and pitch-invariant spectral features and VAD-backed consentful audio.
- Discovered sensor/actuator capabilities for external sound and articulation.
- Online error-driven phoneme repertoire and auditory-motor associations.
- A separate predictive cognitive runtime and independent learning curriculum.
- Noosphere provenance + snapshot/recovery and per-agent state isolation.
- CPU budget benchmarks, controlled failure experiments, sound quality tests.

## Tests
`node tests/mikoshi_phonetics.test.mjs`
`node tests/mikoshi_phonetics_service.test.mjs`
`python tools/check-size.py`
`node tools/mas-check.mjs`

The tests verify real spectral loss reduction, isolated MAS startup, refusal
of unapproved training and non-retention of audio in persistent state.
Do not deploy to production without rights checks, authorization review
and live microphone/audio quality validation.
