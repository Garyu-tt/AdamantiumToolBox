# Mikoshi R08 — complete learn-by-hearing circuit, not speech fluency

R08 completes a **demonstrable closed auditory-motor learning circuit**
assembled from independent MAS plugins. It does not grant an infant
preinstalled speech, words, conversational intent or thought. An
original high, soft, clear vocal identity remains an operator-selected
design target; no cloning of a recognizable singer.

## New independent MAS providers

### mikoshi_audiometry
Stateless, CPU-only, isolated service for comparing **two aligned,
phase-consistent** 12 kHz, mono, PCM16 WAV files produced by an
authorized waveform provider. It validates the exact WAV header,
bounded duration (240 ms–3.6 s), non-silence and matching sample count.
Reward is a normalized sample-domain error within [0,1].
It has no recording permissions, no language model, no training state.

Contract: `mikoshi.skill.v1` domain `acoustic-feedback`,
`mikoshi_audiometry.compare`, scope `audiometry.compare`.
**Important:** waveform error does NOT generalize to real human audio
without time alignment, pitch-invariant features and noise handling.

### mikoshi_transitions
Isolated online state for an *ordered pair* of learned acoustic motif IDs.
It tests seven safe transition durations [80,40,60,100,120,140,160] ms;
saves the duration giving the lowest scalar acoustic error.
Only small state (opaque IDs, timing, count and error) is persisted.
Opt-in `MIKOSHI_TRANSITIONS_STATE`, one preceding state snapshot,
256 ordered pairs maximum, seven trials per pair.
Read scope `transition.inspect`, training scope `transition.learn`;
stale or duplicated feedback is rejected.

Contract: `mikoshi.skill.v1`, domain `transition-learning`,
`mikoshi_transitions.propose`, `.feedback`, `.status`.
The controller neither knows the synthesizer nor calls other plugins.

## The full composite application (Mikoshi Classroom)

`apps/mikoshi_classroom/loop_panel.js` advertises ONE user-started,
bounded synthetic learning experiment when all required graph actions
are available with permission:

1. Select two synthetic reference sounds via live `articulation.preview`.
2. Record their distinctive *acoustic motifs* with `auditory-memory.remember`.
3. Explore the two motif → articulator mappings through `motor-learning`
   proposals, `articulation.preview/observe` and scalar spectral feedback.
4. Learn their order with `auditory-sequence.teach`.
5. Use learned motor positions, `gesture-planner.plan` and
   `waveform-renderer.render` to construct a synthetic reference join.
6. Propose transition durations; synthesize each attempt and score
   via `acoustic-feedback.compare`. Apply accepted reward to
   `transition-learning.feedback`, preserving best timing.
7. Render a final audible result with the selected learned timing.

Orchestration imports **no provider implementation**, only typed
actions resolved from the current live capability graph. There are
no static service endpoints or dependencies in Toolbox Core.
It can cancel between calls, never retries uncertain write outcomes
without readback, and stops when any capability is missing.

## Learning boundaries
- Synthetic reference stimuli, manual one-click start, no microphone
  activation, no media scraping, no conversation prompts and no LLM.
- Per-agent ownership/authorization, source provenance and trusted reward
  attestations remain necessary for any multi-user deployment.
- `sourceApproved:true` only asserts provenance within the authorized
  synthetic lesson. It is NOT a replacement for verifying human
  recording consent or licenses.
- This is a numerical *audio imitation* experiment, not a claim of
  phoneme discovery, speech intelligibility, semantic grounding,
  autonomy or subjective experience.
- No real episode uploads, Noosphere migration or changes to Dante's
  running state are part of this PR.
- Goal is a **complete architecture for future learning**; do not
  insert canned vocabulary or fake understanding to pass a demo.

## Acceptance gates
`node tests/mikoshi_transition_feedback.test.mjs`
`node tests/mikoshi_transition_service.test.mjs`
`node tests/mikoshi_complete_loop.test.mjs`
`node tools/mas-check.mjs`
`python tools/check-size.py`

The functional integration test uses actual acoustic, motif, motor,
sequence, gesture, waveform, scalar reward and transition algorithms
across independent source modules; only the app invocation transport
is mocked there. Separate live-service tests validate the real
authenticated scoped R08 APIs. Real human microphone/voice listening,
latency and privacy must be tested before production deployment.
