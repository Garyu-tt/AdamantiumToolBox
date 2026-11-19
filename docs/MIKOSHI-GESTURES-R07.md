# Mikoshi R07 — continuous articulation, still no LLM

R07 adds two separately installable MAS 1.0 providers, not a new core
dependency. Both can start with Core alone.

## 1. mikoshi_gestures — motor trajectory planner
- Skill: `mikoshi.skill.v1`, domain `gesture-planner`.
- Scoped actions: `mikoshi_gestures.status` (`gesture.inspect`) and
  `mikoshi_gestures.plan` (`gesture.plan`).
- Accepts 2–6 selected motor landmarks (`f1,f2`) with explicit durations
  and optional pauses. Converts them to 10 ms time-ordered motor frames.
- Uses fifth-degree smoothstep near contiguous segment boundaries:
  no instantaneous formant switch at voiced transitions.
- Explicit pauses are silent frames. Output has only scalar motor positions,
  voicing flags and duration, not audio, texts or speech labels.
- Fixed bounds: 120–600 ms per segment, 0–200 ms pause, at most 360
  total frames (3.6 sec). Transition duration 40–160 ms.

## 2. mikoshi_vocalstream — continuous-phase waveform provider
- Skill: `mikoshi.skill.v1`, domain `waveform-renderer`.
- Scoped actions: `mikoshi_vocalstream.status` (`waveform.inspect`)
  and `mikoshi_vocalstream.render` (`waveform.render`).
- Takes a validated gesture trajectory from any authorized caller.
  Independently synthesizes an additive/formant waveform at 12 kHz.
- Harmonic oscillator phase is global across every 10 ms frame; harmonic
  weights are crossfaded within each frame. No splicing isolated WAVs.
- Fixed operator-selected `MIKOSHI_VOCAL_ANCHOR_HZ` range 170–340
  (default 235) is **not learnable** in this provider. Operators must
  provision the same identity anchor as the separate phonetics plugin.
- WAV is returned in-memory via MAS action; no recordings or private
  training state are stored by these new providers.
- This is a CPU-first, vowel-like **formant demonstrator**, not natural
  voiced speech or a finished soundbank.

## 3. Mikoshi Classroom composition
Existing `mikoshi_motorlinks` holds the independently learned best
formant motor positions. Classroom discovers motor-learning, gesture-planner
and waveform-renderer skills from the live capability graph.
A teacher selects 2–6 learned motor IDs, per-motif duration and optional
pause; only then does it query the current motor catalog and request:
`plan(learned_motors)` → `render(trajectory)` → browser playback.
No required direct import between providers; no fixed endpoints in the UI.

## Safeguards and current boundaries
- No LLM, prompt-based dialogue, language labels, or singer impersonation.
- No real understanding, phoneme learning, syllable intelligibility, ASR or
  autonomously chosen language utterances. Learned gestures are selected by
  a teacher using the UI; motor values are from a synthetic experiment.
- R07 has no additional training mutations. Independent `gesture.plan`
  and `waveform.render` permissions gate generation.
- Current prototype returns bounded WAV blobs, not realtime audio streaming.
  CPU cost and on-device listening quality need actual measurement.
- No runtime installation, Noosphere data copying, background recording,
  private source ingestion or multi-tenant access is performed.
- One subtle limitation: `f1,f2` motors are simplified acoustic filters,
  **not** a human tongue, larynx or complete vocal tract.

## Acceptance
`node tests/mikoshi_gestures.test.mjs`
`node tests/mikoshi_vocalstream.test.mjs`
`node tests/mikoshi_gesture_runtime.test.mjs`
`node tools/mas-check.mjs`
`python tools/check-size.py`

Tests must verify finite timing and motor bounds, transitions, pauses,
waveform integrity, authorization, complete Core+App isolation and successful
Cross-provider planning+rendering. Next milestones are syllable-likeness
evaluation, CPU latency budgets, explicit feedback for transition timing
and learning coarticulation from approved listening examples.
