# Mikoshi non-LLM skill ecosystem — R17

**24 independent MAS providers plus Classroom**
(25 MAS apps), CPU-first.
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
| source-policy | `mikoshi_sourcepolicy` | HMAC lesson permits |
| source-reconciliation | `mikoshi_reconciliation` | Classify incomplete signed writes |
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
`av_live_panel.js` offers opt-in AV capture and protected writes.
`av_recovery_ui.js` adds manual receipt inspection and link-only repair.
No background tasks.

## Vocal identity
Owner-chosen eSpeak profile, oscillator anchor and optional rights-approved
local Piper model remain separate from learned articulation and timing.
No artist voice cloning, weights or automatically downloaded models.

## Permission boundary
R17 builds on source permits verified by memory writers when the private
signing key is configured. Sound receipts bind visual associations.
Journals deduplicate writes; R17 classifies partial receipts and
allows manual link-only recovery during the original permit window.
Legacy mode is for isolated tests ONLY; do not expose it to live media.
A signature does not prove consent. Cross-service atomicity, durable
agent isolation and hardware verification are not complete.
No background recording, Noosphere migration or deployment.

**R17 does not establish speech understanding, object identity or causal
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
- `docs/MIKOSHI-SOURCE-TRANSACTIONS-R16.md` — guarded writes
- `docs/MIKOSHI-RECONCILIATION-R17.md` — manual recovery

Run `node tests/mikoshi_reconciliation.test.mjs`,
`node tests/mikoshi_reconciliation_service.test.mjs`, and
`node tests/mikoshi_av_recovery.test.mjs` for R17.
Full test commands are in `.github/workflows/ci.yml`.
Core/MAS regression coverage also includes
`node tools/mas-check.mjs` and `python tools/check-size.py`.
The CI also runs isolated Core+App and Windows regression checks.
Before deployment: real clocks, verified consent, agent isolation and
cross-service transactional recovery.
