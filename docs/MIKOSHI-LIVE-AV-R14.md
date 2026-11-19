# Mikoshi R14 — explicitly initiated camera/microphone experience

R14 adds one independent MAS 1.0 provider, `mikoshi_avsync`, and a
browser-only optional adapter in `mikoshi_classroom`. The purpose is to
replace a purely synthetic cross-modal demonstration with a bounded way
to **inspect real, user-authorized audio/video samples**. It does not
learn words, independently understand scenes, record continuously or
provide general-purpose intelligence.

## Sensor ownership
- `av_capture.js` is a local browser UI adapter: clicking an explicit
  button requests **one shared camera+microphone MediaStream** using
  `getUserMedia`; no background timers or ambient recording are created.
- Video is temporarily displayed into an offscreen 8x8 canvas, sampled
  around every 190ms for a maximum of twelve frames; audio-only
  MediaRecorder captures roughly two seconds of the same shared stream.
  Browser AudioContext decodes and rescales to 12kHz mono PCM.
- It returns transient in-memory frames, audio and **best-effort**
  relative timestamps. The browser's `performance.now` timing and
  decoded audio start are NOT cryptographically synchronized. R14
  assigns a conservative 160ms uncertainty budget, but that is a
  heuristic, not an experimentally calibrated hardware guarantee.
- All stream tracks, audio contexts and timers are explicitly stopped
  in `finally`, including when the user denies permission or decoding
  fails. No `localStorage`, IndexedDB, file uploads, cloud recording,
  automatically saved recording or camera snapshots are created.
- Some browser implementations/embeds may refuse device access or
  audio decoding. Those failure paths must not trigger training.

## Independent timestamp matcher
- `mikoshi_avsync` advertises a `mikoshi.skill.v1` resource with
  `domain:av-alignment`, read-only scope `avsync.inspect`, actions
  `mikoshi_avsync.status` and `mikoshi_avsync.align`.
- It receives **only** bounded event timestamps/kinds from the separate
  `visual-events` and `auditory-events` MAS providers.
  No raw audio, pixels, persistent state or cross-provider imports.
- For each `appear` event, it proposes at most one sound event if
  `abs(time1-time2)+uncertainty <= 250ms`; multiple nearby sounds
  or an audio event shared between multiple visual events are rejected.
- Output distinguishes candidate pairs from unpaired/ambiguous events,
  explicitly sets `certified:false`, and never writes a memory.

## Composition and training boundary
`av_live_panel.js` is an optional Classroom interface discovered from
the authorized graph, separate from the R13 synthetic test. It offers:
a user-initiated capture; an **analysis-only** visual/audio/event
alignment pass; a separate consent checkbox and teaching button;
and an explicit clear-temporary-data action.

Only after the user authorizes teaching can Classroom call existing
`auditory-memory.remember` followed by
`audiovisual-association.teach` for a matched pair.
These are separate MAS writes, not an atomic transaction. If one succeeds
and another fails, Classroom reports the partial write and does NOT
automatically retry it.

**These time coincidences remain correlations, not labels or causation.**
The `sourceApproved:true` flag and UI checkbox express caller intent;
they do not prove that all captured people consent or that media
licensing and provenance have been independently validated. In
production, a source-policy capability must authorize each source
before persistent learning. R14 does not install that capability.

## Acceptance
- `node tests/mikoshi_avsync.test.mjs`: bounded timestamps, duplicate/
  ambiguous matches, clock uncertainty and no content retention.
- `node tests/mikoshi_avsync_live.test.mjs`: five independent live MAS
  HTTP services (visual detector, audio segmenter, sync, motif memory,
  cross-modal associations), synthetic test scene and strict auth.
- `node tests/mikoshi_av_capture.test.mjs`: mocked browser device permissions,
  bounded PCM extraction, and cleanup of all tracks after normal/error paths.
- `node tools/mas-check.mjs`, `python tools/check-size.py`,
  architecture tests and full CI.
- Real browser-camera/microphone operation and actual lip/sound sync,
  on-device CPU cost, permissions on mobile and object tracking are
  **NOT validated** by synthetic CI. They require explicit hardware
  acceptance work before a deploy/merge.

No production deployment, long-running listening, Noosphere migration,
third-party media ingestion or silent learning was performed.
