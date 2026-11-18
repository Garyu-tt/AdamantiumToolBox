# Adamantium Toolbox: Mesh Sync v1

Purpose: synchronize complete MAS plugin packages between authorized backends.
The service is CPU-only. Nothing depends on cloud coordination or GitHub.

## Laptop plugin drop folder
Place one MAS-compliant plugin directory under:
    %LOCALAPPDATA%\Adamantium Toolbox\plugins\inbox\<app-id>\

Required inside: manifest.json, service.mjs, view.js.
Additional local modules and SVG/ICO resources may be included in the signed package.
The worker polls about every 12 seconds. It validates each package, produces one
content-addressed signed envelope and writes it to plugins/store/<sha256>.json.
View status via node tools/agent.mjs mesh, or through the Mesh button.

## Peer authorization
Each node generates its own Ed25519 keypair under local mesh/identity.json.
NEVER commit private keys or local mesh/ config to public GitHub.
Exchange the publicKey and id of each node over a separately verified channel.
Then create mesh/trust.json, keyed by node ID:

    { "<trusted-node-id>": {"publicKey": "<PEM>", "receive": true} }

And mesh/peers.json:

    [{ "id": "<trusted-node-id>", "url": "https://trusted-tunnel.example/" }]

This v1 mesh server binds ONLY to 127.0.0.1:8884. A verified HTTPS reverse proxy
or authenticated SSH forwarding is required to connect different computers.
HTTP is accepted only for loopback simulation. No automatic trust-on-first-use.
Store/forward is symmetric: each node compares inventories, pushes missing packages
and pulls signed packages it lacks, retrying after a peer becomes reachable.

## Security boundaries
- Separate Ed25519 request signatures, short timestamps and nonce replay checking.
- Each package has a cryptographic origin signature and content hash.
- Package cap 8 MiB / 120 files. No arbitrary paths or symlinks accepted.
- A signature confirms the originating trusted node, NOT that code is benign.
- This version stores received packages only. It NEVER auto-executes them.
- Multi-OS install, compatibility gating, automatic activation and rolling rollback
  are required before the original goal of running a plugin on every backend.
- Peer config and trust lists must be created explicitly; they are not shipped in source.
- No remote peers are provisioned by this development release.

## Proof
node tests/mesh.test.mjs
Tests two independent loopback nodes, signed transfer, invalid package detection,
replay rejection, an offline peer, and automatic catch-up on reconnection.
