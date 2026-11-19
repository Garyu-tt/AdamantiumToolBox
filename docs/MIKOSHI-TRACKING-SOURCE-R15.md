# Mikoshi R15 — tracking, explicit clock cues, source-policy permits

Three **independent** MAS 1.0 providers have been added. Each can be
started without other Mikoshi applications or a conversational LLM.

## Anonymous visual continuity: `mikoshi_tracking`
- Skill `visual-tracking` with read-only `tracking.inspect`.
- `mikoshi_tracking.track` consumes 2–12 timestamped 8x8 RGB frames.
  It compares pixels to the first background frame, flood-fills 4-neighbor
  foreground regions of two or more cells, estimates center/color/area,
  and greedily associates nearby regions across neighboring frames.
- At most eight **ephemeral** region IDs `t00001` etc.; the returned
  path has only event times and centroids. Raw RGB frames are NOT kept.
- IDs are NOT real object identities or tracking across recording
  sessions. Occlusion, merged blobs, motion blur, camera motion,
  crowded scenes, changing illumination and persons are unsolved.
  The baseline may itself contain a moving object, yielding errors.
- Classroom optionally shows how many anonymous coarse paths were
  found in a manually captured two-second clip. No new write action.

## Clock calibration: `mikoshi_clockcal`
- Independent read-only `clock-calibration` skill with `clock.inspect`.
  `estimate` requires 3–12 **explicitly known paired calibration cues**,
  monotonically timestamped in both streams. It estimates the median
  audio-minus-video offset and uses residual error to reject unstable
  or extreme offsets. `shift` adjusts event times only when usable.
- `knownCommonStimulus:true` is an assertion by the trusted caller,
  NOT independently verified proof of the same physical event.
- No automatic calibration of the existing real-media browser adapter
  has been implemented: it has no controlled flash+click generator and
  the actual audio/vision hardware latency is unmeasured. Classroom
  continues using its previously documented **uncertified** clock.
  A numeric estimate must not be called hardware calibration.

## Explicit source-gate: `mikoshi_sourcepolicy`
- Independent, stateless skill `source-policy`.
  `source.inspect` allows `status/verify`;
  `source.authorize` allows `authorize` if the private
  `MIKOSHI_SOURCE_SIGNING_KEY` is at least 32 bytes. No credential is
  checked into this public repository.
- `authorize` refuses requests without a declared explicit user
  gesture, rights statements for all participants, no third-party
  media, no raw-media retention, 400–2500ms duration, 1–12 pairs,
  approved learning purpose and a SHA-256 lesson digest.
- It returns a 60-second HMAC-SHA256 signed permit, bound to that
  SHA-256 digest, purpose and count. `verify` checks signature,
  expiry and expected digest before accepting the claim.
- `av_policy.js` hashes exact in-memory visual feature vectors,
  audio event samples and matched times, then asks the independent
  policy provider to issue and verify the permit. It verifies again
  before each write to the existing auditory memory and association.
- In live Classroom, the **write button is hidden when the source
  policy provider, its signing key, or write scopes are absent**.
  Read-only camera/audio event analysis and optional tracking work
  without `source.authorize` or training rights.
- This is **an operator-attested claim, not proof of legal consent**.
  It cannot identify who was captured, check individual consent,
  certify ownership, or independently prove the capture method.
- Existing standalone auditory/grounding provider write APIs still
  accept their older `sourceApproved:true` flag and **DO NOT enforce
  this permit**; direct authorized calls can bypass the Classroom UI.
  Full host-wide policy enforcement must be added at each write boundary
  or as an independent trusted authorization interceptor before
  multi-user production deployment.
- Permits are short-lived but reusable within their lifetime; there is
  NO single-use nonce ledger, revocation or cross-provider transaction.
  A failure after one accepted write may leave a partial state.

## Validation and acceptance gates
`node tests/mikoshi_tracking.test.mjs` tests movement, stable anonymous
paths and adversarial frame validation.
`node tests/mikoshi_sourcepolicy.test.mjs` tests HMAC integrity,
expiry, purpose/digest binding and denied consent claims.
`node tests/mikoshi_clockcal.test.mjs` rejects unpaired/unstable cues.
`node tests/mikoshi_av_policy.test.mjs` tests exact lesson hashing and
detecting a changed lesson after authorization.
`node tests/mikoshi_av_gate_view.test.mjs` checks that source-policy
unavailability disables live-training buttons but not read-only capture.
`node tests/mikoshi_r15_live.test.mjs` runs **eight real independent
MAS HTTP services**: vision, tracking, acoustic segmentation, known-cue
clock estimate, time alignment, source policy, motif memory and
cross-modal association. It uses synthetic inputs and simulated
rights attestations, NOT real device data.

Run `node tools/mas-check.mjs`, `python tools/check-size.py`
and the repository's full CPU/Windows CI as additional gates.
Actual on-device sync calibration, camera tracking performance,
human/third-party consent verification, Noosphere storage and
agent-keyed isolation are **not done**. No production deployment or
automatic background capture is part of R15.
