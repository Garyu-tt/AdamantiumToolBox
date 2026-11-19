# Mikoshi R09 — short continuous hearing (non-LLM)

Adds one stateless MAS 1.0 provider, `mikoshi_segments`, that accepts
up to 4 seconds of **12-kHz mono PCM** from an explicitly authorized caller.
It detects coarse activity regions and candidate acoustic events. It does not
recognize words, differentiate speakers, transcribe, model intentions, or train
its own memory. No neural language model is involved.

## Providers and pipeline
- `mikoshi_segments/segmenter.mjs`: 20-ms energy framing, conservative
  silence/activity threshold, fill brief quiet gaps, and 200-ms windows
  compatible with the independent `mikoshi_motifs` encoder.
- `mikoshi_segments/spectra.mjs`: independent Hann-windowed FFT,
  nine coarse normalized spectral bands. Adjacent near-identical
  windows are merged; spectral novelty can split adjacent sounds
  even without silence. Returned events include `timeMs`, `gapMs`,
  `durationMs`, and ephemeral samples. Max twelve events per call.
- Service and UI declare skill `mikoshi.skill.v1`, domain
  `auditory-events`, action `mikoshi_segments.analyze`. Requires
  `segments.observe`; there is **no learning permission or store** here.
- Classroom discovers event detection, auditory memory, and temporal
  sequence learning from the live capability graph. User controls are:
  an explicit 2-second microphone recording, an offline synthetic test,
  an analysis-only action, read-only recognition, and a separate
  consent-gated action to commit event motifs and their sequence.
  Failure after a partial commit is shown, never retried automatically.
- `stream_capture.js` uses the browser's permission prompt,
  stops microphone tracks on completion, decodes/resamples in memory
  and retains no audio file. Browser audio support is device-dependent.
- A **second explicit** Classroom action, `stream_imitation.js`, can take
  at least two already learned event IDs and attempt to reproduce their
  short audio through independent `articulation.observe/preview`,
  `motor-learning.propose/feedback/status`, `gesture-planner.plan`,
  and `waveform-renderer.render` skills. Motor tuning is capped at
  six trials per event. No synthesis is attempted until the user starts
  this separate action and checks its approval box. It is a coarse
  proof-of-linkage, not human-intelligible speech.

## Important limitations
- This is an **acoustic event candidate detector, not phoneme or
  speech segmentation**. 200-ms windows, coarse spectra and a static
  novelty threshold are engineering heuristics, not speech-trained
  knowledge. Repeated similar syllables may merge; different speakers,
  noise, variable speed and music can create errors.
- Synthetic A/I formants and isolated tones are used only as tests.
  The program does not provide the learner with any vocabulary.
- `sourceApproved:true` is a **caller assertion**, not verifiable media
  provenance or proof of the recorded person's consent. The separate
  Classroom checkbox is only an additional explicit UI action.
  Automatic scraping/training on cartoons and ambient conversations
  is **not implemented or authorized**. User-licensed media requires a
  dedicated source-policy provider before persistence.
- No prompt-driven cognition, no claim of autonomous thought, no
  inference of the meaning of human speech.
- Audio sent in an authorized analyze request is held transiently in
  process memory and returned to the caller, without disk persistence.
  A hostile host could still inspect process memory; no multi-tenant
  protection is claimed.
- No permanent agent-state migration or installation to production.

## Validation
`node tests/mikoshi_segments.test.mjs`
`node tests/mikoshi_segments_service.test.mjs`
`node tests/mikoshi_stream_imitation.test.mjs`
`node tools/mas-check.mjs`
`python tools/check-size.py`

The second test starts three **real independent MAS services**:
segmenter → explicit auditory motif teaching → temporal sequence memory.
Checks read-only, approval, authorization and absence of audio in the
saved state. A separate synthetic composition test checks event-to-motor
training, bounded retries and one continuous WAV playback. Browser/hardware microphone and human voice tests are
separate release gates; synthetic success does not validate them.
