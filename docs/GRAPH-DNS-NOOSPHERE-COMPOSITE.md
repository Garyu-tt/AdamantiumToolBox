# Graph DNS / Noosphere 3.0 / Composite Programs

Status: **prototype source only**. Not deployed to VM121 or VM122. No public
DNS records, mailboxes, or existing Noosphere data have been changed.

## Minimal-core / independent MAS applications

Each app is independently discoverable in the live capability graph. The Core
only handles lifecycle, routing and access policy. Data, graphs, DNS engines,
mail engines and UI composition belong to optional applications.

Graph DNS models: zone -> record -> hostname -> explicit service binding -> node.
No hidden changes to mail service addresses. Inbound MX, outgoing SMTP source
address, webmail endpoint, PTR, SPF, DKIM, DMARC and TLS are distinct objects.
DNS discovery hints are NOT trusted mesh identities. Transport requires pinned
node identity, strict scopes and a verified target, not an arbitrary SRV lookup.

Noosphere 3.0 models: source -> snapshot -> record -> provenance -> references
and placement. The old database remains an independent read-only source.
There is no direct in-place upgrade from the historical Noosphere schema.

Composite Programs group live action bindings into one interface. The blueprint
never grants permissions, and each click invokes a real backend action with
fresh authorization. Disappearing capabilities vanish from the rendered UI.

## Two known VM roles (proposal, NOT deployment)

- VM 122 mk-neurocms (4 GiB): thin API/GUI, graph routing and DNS control plane.
- VM 121 mk-noosphere (32 GiB): isolated Noosphere 3.0 data staging, validation
  and indexes with an independently versioned storage adapter.
- Both currently share Proxmox sc211-s01. Two virtual machines here are NOT two
  failure-independent storage replicas. Use an encrypted verified copy on
  another physical host and test restore.

Placement must be controlled by operator-approved host discovery, not hardcoded
IP addresses or environment-dependent paths.

## DNS scope

The current graph_dns.audit and graph_dns.plan are PURE read-only operations.
They validate supplied zone/record snapshots, MX targets, CNAME collisions
and explicit address bindings. The plan does not apply DNS writes.

Production requirements:
- Separate registrar, delegation, authoritative DNS and hosting concepts.
- Zone import from verified providers, NS/SOA/DS/DNSSEC and TTL planning.
- Pluggable authoritative providers, optionally self-hosted with independent
  secondaries, no required Cloudflare.
- A/AAAA/MX/PTR alignment, mail service IP roles, SPF, DKIM, DMARC, TLS.
- Compare proposed state with public resolvers and source of truth.
- Permission-filtered two-phase apply, audit logs, rollback and verification.
- Changing mailbox settings must never rewrite chosen mail IP bindings.

## Hestia and mail migration

The intended Hestia source and domains are not yet supplied. Do NOT use the
old July 2026 domain workbook as the migration source.

Mail migration requires a separate independent adapter and mail engine.
Inspect accounts, maildir messages, aliases, forwarders, credentials where
portable, spam rules, sieve, quotas, DKIM private keys and DNS cutover options.
Preserve source backups and compare mailbox counts and IMAP UID behavior.
Validate outgoing port 25 and PTR ownership before traffic is switched.
Webmail is an independent client, with avatar and contact identity features,
not a mandatory Roundcube dependency.

## Clean Noosphere data migration

1. Obtain a consistent read-only snapshot of the historical SQLite DB. Never
   run raw exporter on an active database file or its live WAL.
2. Run the read-only tools/noosphere_sqlite_export.py snapshot output_directory.
   Its restricted directory contains all non-system SQLite tables as JSONL,
   SQLite BLOBs as base64 and per-table/SOURCE SHA-256 manifests. Handle as
   SECRET DATA. Do not commit private exports to the public repository.
3. Define versioned per-table semantic adapters, and map historical metadata
   into the new record contract with provenance and temporal fields.
4. Run bounded noosphere.inspect batches. Quarantine invalid timestamps,
   duplicate IDs, malformed links, invalid payloads and integrity errors.
5. Stage an entirely new, empty data store; commit only transactionally after
   checks, reconstruct indexes and reconcile cross-batch references.
6. Verify counts, hashes, sample reads, reference integrity, backup restore,
   then separately approve the traffic cutover.
7. Keep old snapshot and original system read-only through rollback period.

Noosphere.inspect currently audits the supplied JSON batch ONLY. It does NOT
import records, correct historic data automatically, run indexes or replicate.

## Release / security gates

- Independently run each plugin with Core + that plugin only.
- Validate manifests, source size and functional/HTTP-negative tests.
- Test idempotent stop/restart, permission revocation and graph refresh.
- Verify access to each VM through approved node identity and live policy.
- Keep new capabilities disabled until approved and linked to a vetted node.
- Never promote read-only prototype to production nameserver or MTA.

This initial branch is an architectural foundation, not a migration completion.
