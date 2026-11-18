# Mikoshi — Adamantium MAS plugin (R16)

A **separately signed, independently bootable** MAS 1.0 adapter.
The full nervous-system code remains in the [Mikoshi repository](https://github.com/Garyu-tt/mikoshi).
Do not bundle its personal Engrams or source-specific data inside this package.

## Runtime arrangement

- Adamantium Core discovers signed plugin and launches this Node service.
- The service verifies an owner-pinned, clean local Mikoshi Git checkout.
- It starts the genuine Python 3 runtime as an independent loopback-only process.
- Internal auth is delegated by Core; the Python API has an ephemeral private token.
- Declarative `routes.json` maps only read-oriented native capabilities to MAS actions.
- The 2D map actions appear only when registered by actual source-backed providers.
- The plugin starts without Python, Mesh, sensors or other optional MAS apps;
  missing providers report offline and **do not** invent neural state.

## Owner-private deployment configuration

The installer creates `%LOCALAPPDATA%/Adamantium Toolbox/mikoshi/integration.json`.
It records local executable and verified Git paths, expected source revision,
and schema `mikoshi.mas.backend.v1`. This file and all state are **not published**.

Only `mikoshi.read` is requested. No write or motor capability is offered.
Full neural operation requires genuine R238/R239 source and hardware; no
pretend retina/depth/actuation capabilities are emitted.

## Installation and rollback

Deliver source to `plugins/inbox/mikoshi`; the local owner mesh worker
signs it. Then use the owner's lifecycle CLI `plan` and `activate --approve`.
The supervisor verifies the signed package and launches it automatically.
Existing Toolbox apps and private data are not replaced.
Rollback: `node tools/lifecycle.mjs rollback mikoshi --approve`.

The Python runtime has normal current-user permissions, **not an OS sandbox**.
It must not be used with unreviewed neural source or arbitrary remote URLs.
