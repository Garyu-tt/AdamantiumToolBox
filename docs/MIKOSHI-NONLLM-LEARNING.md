# Mikoshi non-LLM skill ecosystem — R15

**23 independent MAS providers plus Mikoshi Classroom**
(24 MAS apps), CPU-first and independently discoverable.
No conversational LLM; Classroom is an optional composition.

## Independently discoverable providers

| Skill domain | App | Function |
|---|---|---|
| hearing | `mikoshi_hearing` | PCM energy and pitch features |
| visual-events | `mikoshi_vision` | Unlabeled 8×8 RGB change detection |
| audiovisual-association | `mikoshi_grounding` | Temporal motif/event correlations with abstention |
| av-alignment | `mikoshi_avsync` | Bounded event-time matching |
| visual-tracking | `mikoshi_tracking` | Anonymous coarse blob paths |
| clock-calibration | `mikoshi_clockcal` | Known-cue clock offset estimates |
| source-policy | `mikoshi_sourcepolicy` | Short-lived HMAC lesson permits |
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

`mikoshi_classroom` mounts optional panels from live `mikoshi.skill.v1` skills.
`loop_panel.js`: opt-in hearing → memory → motor → sound → feedback
lesson, hidden when permissions are absent.
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
`av_panel.js` provides synthetic pairing; `av_live_panel.js` adds
explicit capture, optional tracks and source-gated writes.
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
Prototypes are single-instance, not secure multi-tenant hosting.
No background microphone recording, Noosphere migration or active
deployment was performed in this change.

**R15 does not establish speech understanding, object identity or causal
reasoning.** Synthetic checks do not validate real hardware or permission.

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
- `docs/MIKOSHI-LIVE-AV-R14.md` — explicit capture, clock limits
- `docs/MIKOSHI-TRACKING-SOURCE-R15.md` — tracks, known cues, signed claims

Run `node tests/mikoshi_r15_live.test.mjs` and its four R15 unit tests.
Full test commands are in `.github/workflows/ci.yml`.
Core/MAS regression coverage also includes
`node tools/mas-check.mjs` and `python tools/check-size.py`.
The CI also runs isolated Core+App and Windows regression checks.
Before deployment: measured CPU/clock error, verified source consent,
per-agent isolation, provider-side permit enforcement and recovery.
