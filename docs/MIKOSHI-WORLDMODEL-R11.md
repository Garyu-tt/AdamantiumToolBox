# Mikoshi R11 — predicting the sound of an action, without LLM

An independent MAS 1.0 `mikoshi_worldmodel` plugin predicts short acoustic
outcomes of the existing two-parameter vocal motor (`f1`, `f2`).
It is an intentionally **small, learned sensorimotor model**, not an
autonomous consciousness, universal world model or natural-speech learner.

## One prediction/learning transaction

1. On a manually approved exploration session, Classroom asks the motor
   controller for a proposed vocal motor position.
2. Before synthesizing the action, it invokes `world-prediction.forecast`.
   That action persistently records a UUID ticket, motor coordinates,
   current acoustic prediction and the observation revision.
3. The separate articulation provider generates the sound and the
   hearing provider extracts ten normalized acoustic spectral features.
4. Classroom invokes `world-prediction.observe` with the ticket and
   heard feature vector. The plugin measures mean-squared prediction
   error, emits an uncalibrated surprise flag, updates learned examples
   and clears the ticket.
5. The original motor and exploration feedback proceed independently.
   Future predictions use previous recorded motor→spectrum experiences.

The memory uses bounded nearest-example interpolation (at most 96
motor/acoustic experiences; four nearest neighbors per prediction).
It can interpolate a result for a motor position not directly observed
during training. This is **local numeric interpolation**, not natural
language or generalization to unexperienced real-world conditions.

## Interfaces and privacy
- Skill domain `world-prediction` in the live `mikoshi.skill.v1` graph.
- `mikoshi_worldmodel.status`, `.estimate` are read-only and require
  `prediction.inspect`.
- `.forecast`, `.observe`, `.abort` require `prediction.learn`,
  explicit `sourceApproved:true` and owner-private storage path
  `MIKOSHI_WORLD_STATE`. That flag is NOT evidence of recording consent.
- Only one in-flight forecast per instance. Duplicate or mismatched
  tickets fail closed; a crashed forecast can be inspected and explicitly
  aborted by an authorized operator. No automatic replay of uncertain
  mutations or cross-provider rollback is claimed.
- Stored data: motor coordinates, ten-value acoustic vectors, counts,
  prediction ticket, numeric losses. No raw audio, model weights, artist
  recordings, spoken words or private video are persisted by this plugin.
- Owner must isolate each agent's storage and permissions independently;
  these single-runtime prototypes are not yet multi-tenant.

## Composition and test gates
The existing `explore_engine.js` optionally discovers the full
forecast/observe/abort/status capability set. With it, each experiment
records a forecast BEFORE calling `articulation.preview` and reports
surprise afterward. Without it, R10 exploration remains available.
The Classroom never imports `mikoshi_worldmodel` directly.

`node tests/mikoshi_worldmodel.test.mjs`
`node tests/mikoshi_worldmodel_service.test.mjs`
`node tests/mikoshi_explorer_live.test.mjs`
`node tools/mas-check.mjs`
`python tools/check-size.py`

The unit test checks held-out synthetic motors, forecast→observe order,
numeric surprise and replay rejection. The standalone service test checks
rights, durable private state, crash/restart behavior and write revocation.
The updated live integration checks five real MAS HTTP services with one
prediction ticket for each executed acoustic action.

Important limitations: the spectral loss is not a validated perceptual
metric; the surprise threshold and confidence score are heuristics.
A caller can supply fabricated spectral outcomes; authenticated
source-of-truth capture and tamper-resistant reward attestation are
still needed. Real microphones, voices and human speech remain untested.
No background autonomous work, runtime deployment or Noosphere migration.
