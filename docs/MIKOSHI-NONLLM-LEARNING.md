# Mikoshi — non-LLM speech and learning (experimental v0.1)

Six independently installable MAS apps use the same Core capability graph.
The classroom UI discovers resources with \`skill.schema=mikoshi.skill.v1\`,
not app names or fixed infrastructure addresses. Each remains operational alone.

## Implemented
- \`mikoshi_hearing\`: bounded PCM acoustic features, not word recognition.
- \`mikoshi_voice\`: optional local \`espeak-ng\` formant synthesizer with a
  private owner-selected \`MIKOSHI_VOICE_PROFILE_JSON\` (language/pitch/speed/amplitude).
  The initial timbre/profile is fixed; the default is a brighter, higher register
  (pitch=74, speed=164, amplitude=95). This formant engine cannot reproduce the
  natural breathiness or expressivity of a trained human vocalist. The suggested
  high, soft, clear singing-like aesthetic is a broad design target, not a clone
  of any identifiable singer. Phonetic adaptation is not implemented.
- \`mikoshi_learning\`: online feature-to-label prototypes with correctness feedback.
  Explicitly set a private \`MIKOSHI_LEARNING_STATE\` path to enable durable updates.
  No semantic understanding, autonomous thought or consciousness is asserted.
- \`mikoshi_classroom\`: live provider composition, no internal imports of other apps.

The existing \`plugins/mikoshi\` read-only adapter is not modified.
No language model or LLM endpoint is involved; all interaction is owner-authorized.
New scopes: \`hearing.observe\`, \`voice.inspect\`, \`voice.render\`,
\`learning.inspect\`, \`learning.train\`, \`classroom.view\`.
Permissions must be granted through the existing Toolbox authorization policy.

## Next independent providers
1. Explicitly permissioned microphone/media input, VAD and optional denoising,
   separating acquisition from storage and analysis.
2. Audio-visual grounding for licensed cartoons, replayable observed examples,
   phoneme exploration, acoustic imitation and audio feedback.
3. Genuine autonomous cognitive runtime with action selection, world model,
   testable skill generalization and bounded exploration. A prototype matcher
   is not a replacement for this work.
4. Reading, handwriting/typing, counting and device action providers; actions
   require separate least-privilege scopes and human approval when risky.
5. Noosphere provenance, continuity, privacy policies, retrain/rollback snapshots
   and sleep-phase consolidation through independently installed services.

## Open-source candidates (not bundled)
- eSpeak NG: offline formant synthesis, GPL-3.0-or-later.
- Piper OHF-Voice/piper1-gpl: optional offline neural TTS, GPL-3.0-or-later;
  independently check voice model cards and training rights.
- Silero VAD: MIT; RNNoise: BSD-3-Clause.
These are *acoustic* tools, not conversational language models. There is no
implicit permission to record or train on third-party audio.

## Validation and limitations
Run \`node tests/mikoshi_speech.test.mjs\`, \`node tools/mas-check.mjs\`
and \`python tools/check-size.py\`, then Core + App isolation and supervised
audio smoke tests on a host with eSpeak NG installed. No runtime deployment, realistic singer-level timbre, streaming latency,
or learned child-level cognition is claimed by this source prototype.
