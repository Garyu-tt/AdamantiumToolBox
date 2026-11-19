# Mikoshi non-LLM skill ecosystem — R13

**Nineteen independent MAS providers plus Mikoshi Classroom**
(20 MAS apps). All are CPU-first, capability-driven and usable with
Core alone. No conversational language models or prompt-generated
dialogues are required. The composite UI is a separate user-facing app,
not a replacement monolith or a dependency of any provider.

## Independently discoverable providers

| Skill domain | App | Function |
|---|---|---|
| hearing | `mikoshi_hearing` | PCM energy and pitch features |
| visual-events | `mikoshi_vision` | Unlabeled 8×8 RGB change detection |
| audiovisual-association | `mikoshi_grounding` | Temporal motif/event correlations with abstention |
| auditory-events | `mikoshi_segments` | 2–4 second PCM stream acoustic event candidates |
| speech | `mikoshi_voice` | Optional eSpeak NG parametric voice |
| general | `mikoshi_learning` | Supervised feature prototypes |
| prosody | `mikoshi_prosody` | Small online neural pitch/speed adjustments |
| speech | `mikoshi_piper` | Optional rights-approved neural-acoustic Piper TTS |
| articulation | `mikoshi_phonetics` | Short vowel-like motor trial and FFT hearing |
| auditory-memory | `mikoshi_motifs` | Discover and reinforce acoustic prototypes |
| auditory-sequence | `mikoshi_sequences` | Remember order and manually set coarse timing |
| motor-learning | `mikoshi_motorlinks` | Learn acoustic motif → motor mapping |
| gesture-planner | `mikoshi_gestures` | Smooth timed vocal motor transitions |
| waveform-renderer | `mikoshi_vocalstream` | Continuous-phase formant WAV synthesis |
| acoustic-feedback | `mikoshi_audiometry` | Compare aligned synthetic WAV exercises |
| transition-learning | `mikoshi_transitions` | Learn a better between-motif join duration |
| exploration | `mikoshi_explorer` | Select inspect/practice by error and uncertainty within a limited session |
| world-prediction | `mikoshi_worldmodel` | Predict acoustic outcome of a motor action before execution, then learn the error |
| hypothesis-search | `mikoshi_hypotheses` | Pick untried vocal actions using model uncertainty |

`mikoshi_classroom` discovers `mikoshi.skill.v1` resource contracts
from the authorized capability graph. It can mount isolated panels for
voice, hearing, motor rehearsal, sequence memory and timing practice.
`loop_panel.js` exposes one explicit opt-in complete synthetic lesson
covering hearing → acoustic memory → motor action → audible result →
scalar reward → motor/transition memory. Missing permissions hide it.
`stream_panel.js` additionally connects explicitly recorded short clips
or synthetic diagnostic signals to transient event segmentation, approved
memory updates and separate voluntary sensorimotor reproduction.
`explore_panel.js` provides a manually authorized 2–12-step lesson;
`mikoshi_explorer` then chooses which existing acoustic motif to inspect
or practice based on numeric error and uncertainty. The optional
`mikoshi_worldmodel` forecasts the sensory consequence BEFORE synthesis
and updates its prediction from the resulting acoustic observation.
`hypotheses_panel.js` lets the operator approve one untried vocal action,
forecast it, hear the result and update prediction error.
`av_panel.js` adds an opt-in synthetic audiovisual pairing exercise.
No background tasks.

## Immutable owner-chosen vocal identity
- eSpeak NG: `MIKOSHI_VOICE_PROFILE_JSON` with language/pitch/speed/amplitude.
  Default higher-register starting point is a relative engine preset, not Hz.
- Vocal oscillator: `MIKOSHI_VOCAL_ANCHOR_HZ` (default 235 Hz, 170–340).
  Must be provisioned consistently with the phonetics anchor.
- Piper: optional `MIKOSHI_PIPER_MODEL` absolute ONNX path plus matching
  JSON config, `MIKOSHI_PIPER_MODEL_RIGHTS=approved`, optional Python binary.
  Model licensing/rights must actually be independently verified. No
  third-party singer voice cloned or automatically downloaded.
- Learned articulation, vocal timing and prosody remain distinct from
  the operator-selected initial timbral identity.

## Consent, permissions and scope
Each module declares its own inspect/render/learn scopes. Owner-managed
private state files are opt-in; no raw audio stored in long-term motor,
motif or timing memory. Training flags do NOT prove license or consent;
external media needs separate signed provenance and recording policies.
Current prototypes are single-instance, not isolated multi-tenant hosting.
No background microphone recording, Noosphere migration or active
deployment was performed in this change.

**R13 is not speech understanding, speech recognition, a learned phoneme
inventory, independent reasoning or proven autonomy.** The final sound
is a synthetic learning demonstration. The target is a complete
architecture able to acquire skills later, not a ready-made conversation.

## Implementation and validation records
- `docs/MIKOSHI-PHONETICS-R03.md` — short vowel imitation
- `docs/MIKOSHI-MOTIFS-R04.md` — acoustic motifs
- `docs/MIKOSHI-SEQUENCES-R05.md` — temporal patterns
- `docs/MIKOSHI-MOTORLINKS-R06.md` — feedback-based motor learning
- `docs/MIKOSHI-GESTURES-R07.md` — continuous coarticulation
- `docs/MIKOSHI-CLOSED-LOOP-R08.md` — full circuit, limitations and gates
- `docs/MIKOSHI-STREAM-R09.md` — bounded continuous hearing and replay
- `docs/MIKOSHI-EXPLORER-R10.md` — bounded self-directed sensory experiments
- `docs/MIKOSHI-WORLDMODEL-R11.md` — sensory forecasts before actions
- `docs/MIKOSHI-HYPOTHESES-R12.md` — test a new action
- `docs/MIKOSHI-AV-GROUNDING-R13.md` — visual/audio associations

Run `node tests/mikoshi_vision.test.mjs`,
`node tests/mikoshi_grounding.test.mjs`, and
`node tests/mikoshi_av_live.test.mjs` for R13.
Full Mikoshi acoustic, isolated MAS and core regression coverage is
listed in `.github/workflows/ci.yml`, alongside
`node tools/mas-check.mjs` and `python tools/check-size.py`.
The CI also runs isolated Core+App and Windows regression checks.
For real user deployment still need CPU and acoustic field benchmarks,
recording consent, data isolation and robust recovery.
