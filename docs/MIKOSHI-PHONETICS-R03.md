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
- `mikoshi_classroom/mic_capture.js`: opt-in, short (950 ms) microphone capture
  using browser media permissions, decoded in memory only. `pcm.js` resamples
  to 12 kHz and selects the loudest 200 ms window; it is NOT a VAD or ASR.
  No microphone is started until the user explicitly clicks a button.
  Training remains a separate action after recording.

## Security and consent
Scopes: `phonetics.inspect`, `phonetics.render`, `phonetics.learn`.
Training only exists when private state path is explicitly configured and
learning permission is granted. It also requires `sourceApproved:true`;
that bit is a caller assertion, NOT a license or consent verification.
Real media ingestion must validate its own provenance/consent separately.
The capture UI asks for browser microphone permission; no background recording
or internet download occurs. Recording permission is not the same as permission
to train on material or speaker identities.
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
`node tests/mikoshi_microphone.test.mjs`
`python tools/check-size.py`
`node tools/mas-check.mjs`

The tests verify real spectral loss reduction, isolated MAS startup, PCM
preprocessing and silence rejection; microphone hardware/browser permission
must still be tested manually. They also verify refusal
of unapproved training and non-retention of audio in persistent state.
Do not deploy to production without rights checks, authorization review
and live microphone/audio quality validation.
