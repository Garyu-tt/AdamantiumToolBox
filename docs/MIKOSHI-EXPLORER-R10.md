# Mikoshi R10 — bounded self-directed acoustic exploration

R10 adds the independent `mikoshi_explorer` MAS 1.0 provider:
a minimal **closed-loop intrinsic curriculum planner**, not an LLM and
not a general-purpose cognitive or autonomous reasoning architecture.
It does not own auditory input, voice synthesis, motor-learning code,
agent identity, Noosphere or any other provider.

## How an R10 session works

1. The operator explicitly records or creates a sample, approves learning,
   and stores 2–6 short acoustic motif IDs with the preexisting providers.
   Raw audio remains only in the already open, in-memory Classroom session.
2. The operator starts one bounded explorer session (2–12 actions).
   The plugin stores only the selected IDs, current best error estimates,
   observation counts, proposed action and numeric progress, **not audio**.
3. The policy first chooses **inspect** for as-yet unmeasured motifs.
   The composition then calls independently discovered `articulation.observe`,
   `motor.propose` and `articulation.preview` to measure the current
   synthesized attempt's spectral error, *without changing motor skills*.
4. Once each motif is observed, the planner chooses **practice** according
   to a small uncertainty/learning-potential score. Higher acoustic error
   attracts practice; a count-based exploration bonus prevents permanent
   starvation of less-practised motifs.
5. Classroom invokes one real `motor.feedback` only for a `practice`
   decision, then reports the numeric reward to `explorer.feedback`.
   The explorer rejects stale/duplicated feedback with session/step/ID/action
   checks. Its recommendation changes as the observed errors change.
6. An operator can request stop after the current call. Active sessions
   survive a restart, can be inspected, and require an explicitly approved
   stop action before starting another. No automatic future scheduler.

## Contract and isolation

- Skill domain `exploration` in the existing `mikoshi.skill.v1` graph.
- Actions: `mikoshi_explorer.status`, `.choose`, `.begin`,
  `.feedback`, `.stop`.
- Scoped rights: `exploration.inspect` for read-only policy decisions;
  `exploration.learn` plus private `MIKOSHI_EXPLORER_STATE` for writes.
  An explicit `sourceApproved:true` assertion is required for writes,
  but it is **not** media provenance or proof of consent.
- Store uses bounded, atomic JSON state and one previous copy.
  This pilot supports one active session and one agent per state file.
- No microphone is started by this provider; it cannot issue remote
  actions or expand its own authorization. Only the separately authorized
  Classroom user action composes other provider calls.
- Missing skills are detected before beginning. A runtime failure between
  motor feedback and explorer feedback may leave a **partial** result;
  do not automatically retry ambiguous writes. Cross-provider transactions,
  readback recovery and agent-keyed private storage remain future work.

## Evidence and limitations

`node tests/mikoshi_explorer.test.mjs` checks adaptive action selection,
uncertainty-driven exploration, step budgets, replay rejection and immutability.
`node tests/mikoshi_explorer_service.test.mjs` starts the independent
service and tests authorization, serialized writes and read-only restart.
`node tests/mikoshi_explorer_live.test.mjs` starts four independent MAS
services and runs a real synthetic auditory→motif→exploration→motor loop.
Also run `node tools/mas-check.mjs` and `python tools/check-size.py`.

This is **bounded active learning on synthetic short vowels**. It does not
establish that Dante thinks, understands words, learns from cartoons,
chooses long-term goals or can speak naturally. User/real-device listening
and perceptual metrics remain required. No working node deployment.
