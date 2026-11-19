# Mikoshi Voice & Learning — MAS non-LLM experimental R02

Six independent MAS 1.0 applications; each boots with Core alone and
advertises only real, permitted capabilities. A single Classroom UI composes
resources discovered through `mikoshi.skill.v1`, not fixed app names.

## Implemented in this proposal
- `mikoshi_hearing`: bounded PCM acoustic features (energy, zero crossings,
  approximate pitch). No ASR or comprehension.
- `mikoshi_voice`: optional eSpeak NG CPU formant speech. Default parameters
  pitch=74, speed=164, amplitude=95, Russian; these are *relative engine controls*
  and not measured pitch in Hz. Private `MIKOSHI_VOICE_PROFILE_JSON` overrides them.
  The timbre anchor is owner-configured, never changed by learning.
- `mikoshi_learning`: supervised online acoustic-vector-to-label prototypes.
  Private `MIKOSHI_LEARNING_STATE` opts into persistence.
- `mikoshi_prosody`: independently trained 5-6-2 CPU neural network. Feedback
  higher/lower/faster/slower adjusts pitch/speed corrections, and good rewards
  the current attempt. No LLM, no samples of anybody's voice, no raw audio stored.
  Requires private `MIKOSHI_PROSODY_STATE` for durable feedback.
- `mikoshi_piper`: optional OHF-Voice Piper neural-acoustic TTS backend. No
  conversational language model; no voice model bundled or downloaded.
  Provider is hidden until its locally installed Python package, model/config
  files, and owner-reviewed voice rights acknowledgement are all present.
  Piper currently supports speed correction, not direct pitch correction.
- `mikoshi_classroom`: graph-discovered composition of voice + optional prosody.
  Provider selection uses declared skill priority and supported adjustments.

## Optional Piper configuration (never put model files in this repository)
- `MIKOSHI_PIPER_MODEL`: absolute owner-approved local ONNX voice path.
- `MIKOSHI_PIPER_MODEL_RIGHTS=approved`: explicit reviewed model-license gate.
- `MIKOSHI_PIPER_PYTHON`: optional Python executable with `piper-tts` installed.
- Separate `.onnx.json` voice configuration must exist at model path + `.json`.

The acknowledgement is not legal proof of license rights. Verify each voice's
model card and training terms. No attempt to clone or impersonate a living
performer's recognizable voice. Desired acoustic direction: an original,
high-register, light, soft and clear tenor with expressive articulation.
Formant speech does NOT sound like a natural singer; Piper voice quality depends
on the selected permitted model. No particular singer-level similarity is claimed.

## Security and lifecycle
The existing read-only `plugins/mikoshi` is unchanged. New permissions:
`hearing.observe`, `voice.inspect`, `voice.render`, `learning.inspect`,
`learning.train`, `prosody.inspect`, `prosody.learn`, `classroom.view`.
A user must separately grant rights through Toolbox policy. No automatic
activation, copying of private data, recording, or changes to existing agents.
Only explicit owner-approved training state is persisted. The current prototype
is single-runtime rather than multi-tenant; per-agent isolation remains future work.

## Next separate modules
1. Consent-bound microphone / media ingestion, denoising and VAD.
2. Phoneme acquisition and audiovisual grounding from appropriately licensed
   media, with robust feedback and no commands inferred from show dialogue.
3. Recurrent or predictive world-model cognition with decision-making and
   measurable generalization; current prototype classifier is not a thinker.
4. Independent reading, writing, math, typing and safe action capabilities.
5. Sleep consolidation, Noosphere memory, provenance and reversible learning.

## Acceptance
Run `node tests/mikoshi_speech.test.mjs`,
`node tests/mikoshi_prosody.test.mjs`, `node tests/mikoshi_piper.test.mjs`,
`node tools/mas-check.mjs` and `python tools/check-size.py`. Then test
isolated services, actual eSpeak/Piper binaries, consent, output quality and
permissions on a host. Piper's CLI currently reloads the neural model per
utterance, so production low-latency streaming will require a persistent worker.
No actual installed neural voice or full cognitive learning is claimed.
