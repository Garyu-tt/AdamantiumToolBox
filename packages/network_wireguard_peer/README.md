# Network WireGuard Peer Enrollment — MAS v0.2.0

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


## Client-only profile generation (v0.2)

`network_wireguard_peer.clientProfile` is a **read-only** capability available only when the operator has provisioned all required server values:

- `NETWORK_WG_SERVER_PUBLIC_KEY`: public (never private) key of the reviewed server WireGuard interface.
- `NETWORK_WG_SERVER_ENDPOINT`: reviewed DNS/IPv4/IPv6 endpoint with UDP port; not guessed by the client.
- `NETWORK_WG_CLIENT_ROUTES`: explicit comma-separated IPv4 CIDRs to allow over the tunnel (split tunnel recommended).
- `NETWORK_WG_CLIENT_DNS`: optional IPv4 DNS server address.

Request `{peerPublicKey, address}` using the client's **WireGuard X25519 public key**, not an SSH key. The provider re-reads the local live WireGuard peer table and refuses templates for missing or differently assigned peers. Output intentionally contains `PrivateKey = __LOCAL_PRIVATE_KEY__`; the private key must be inserted on the client device only. The template includes endpoint, allowed routes, keepalive, and server public key, but never the local private key or system command. No profile is exposed when server settings are absent or invalid.

Android AVF Debian guests can lack TUN/NET_ADMIN, so this output **does not prove that WireGuard can run inside Pixel's Debian VM**. Importing a locally populated profile into the Android WireGuard client is an independent option; the Android VPN may not automatically route Debian guest traffic. A valid peer and a rendered config still require a verified handshake, routing and ACL checks.

Run: node --test packages/network_wireguard_peer/tests/*.test.mjs
Stage: node tools/plugin-stage.mjs prepare packages/network_wireguard_peer
Never execute unreviewed installation, change VPN ACLs, or claim the app is deployed based on GitHub CI alone.
