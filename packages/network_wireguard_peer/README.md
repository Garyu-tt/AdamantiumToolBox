# Network WireGuard Peer Enrollment — MAS v0.1.0

Independent, optional peer-management app. The existing network_wireguard MAS provider remains strictly read-only. Requires only Core + this app; no compulsory Network Fabric, Network Approval, JediControl, Graph Manager, Noosphere or Leonardo. Host service uses mas-http-1, loopback-only with the Core-provided internal secret. The Raw UI remains usable without a styling provider.

## Capabilities

- network_wireguard_peer.status — read-only count and readiness; no keys or endpoints.
- network_wireguard_peer.prepare — validates ONE operator-selected WireGuard public key and ONE IPv4 /32 in an operator-provisioned pool. Emits a nonce-bound, state-revision-bound, 120-second unsigned enrollment proposal for add/remove. No action.
- network_wireguard_peer.apply — disabled unless NETWORK_WG_WRITE_ENABLED=1, network_wireguard_peer.write is granted by Core, and two pinned, independent Ed25519 signing keys approve the exact JSON plan bytes. Write is guarded by a one-writer lock and fresh state check; operation intent is fsynced to a protected local journal before a single fixed wg set invocation. Re-reads the peer set and returns verified, unverified or conflict. No automatic retry after ambiguous writes.

## Operator-only configuration

Set these through an approved signed MAS installation and OS-level service configuration, not via the ChatGPT client:

- NETWORK_WG_IFACE: explicitly approved existing interface.
- NETWORK_WG_POOL: explicitly allocated IPv4 address pool, between /16 and /30.
- NETWORK_WG_JOURNAL: absolute path inside an existing owner-controlled, non-world/group-writable directory; journal is 0600.
- NETWORK_WG_SIGNERS_FILE: path to local JSON with sourcePublicKeyPem and destinationPublicKeyPem (two distinct Ed25519 SPKI PEM values).
- NETWORK_WG_WRITE_ENABLED: leave unset until the host policy, two approvers and least-privilege service account are reviewed.
- NETWORK_WG_BIN: operator-controlled executable path (for mock/unit tests). Never provided by API request.

Permissions: network_wireguard_peer.read for status/preview, network_wireguard_peer.write for apply. The app accepts only /32 client addresses, fixed iface, valid 32-byte WireGuard public keys and detached Ed25519 signatures of the precise UTF-8 bytes Buffer.from(JSON.stringify(plan)). The apply request includes plan, digest (SHA256 of serialized plan), and proofs.source / proofs.destination, Base64 Ed25519 signatures. No SSH keys can stand in for WireGuard peer keys.

## Important limitations

This pilot performs only LIVE, EPHEMERAL WireGuard peer set/remove. No wg-quick persistence, no reboot survivability, no management-route changes, no firewall, NAT, kernel module installation, Android VM TUN access or address allocation. Server config, listen port, network ACL enforcement and client profiles remain outside this app and require explicitly approved integrations. A WireGuard peer does NOT establish mutual policy authorization on its own.

Do not deploy the Core as root or expose the app listener publicly. This source does not constitute a privilege-separation audit or a production-safe privileged reconciler. Deployment on both servers, signed installation, independent witness, watchdog, durable config and a verified Pixel handshake are outstanding operational steps. Existing wg1/WG1/WG2/mk-vpn instances must be inventoried before changes.

Run: node --test packages/network_wireguard_peer/tests/*.test.mjs
Stage: node tools/plugin-stage.mjs prepare packages/network_wireguard_peer
Never execute unreviewed installation, change VPN ACLs, or claim the app is deployed based on GitHub CI alone.
