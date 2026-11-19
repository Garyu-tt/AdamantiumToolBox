# Adamantez signed-grant bridge contract — R02 (experimental)

This is the **public non-secret interface** to the independently owned private
Adamantez provider. It makes no private source, credentials, policy or signing
keys public. The implementation under review is in the private AdamantezTolls
repository. The public Toolbox microkernel has **no dependency** on it.

## MAS action (current prototype)

An installed and explicitly approved provider may advertise:

- app: `adamantez`
- action node: `adamantez.access.evaluate`
- required host capability: `adamantez.evaluate`
- input: `{action, resource, envelope}`
- response: `{result:{allowed:boolean}}` from the MAS `/invoke` handler

The `envelope` is a signed grant document:

```json
{
  "grant": {
    "schema": "adamantez-grant/1",
    "issuer": "operator",
    "subject": "peer-1",
    "audience": "adamantez",
    "action": "source.read",
    "resource": "private:example",
    "issued_at": 1795000000,
    "not_before": 1795000000,
    "expires_at": 1795000060,
    "nonce": "example-long-unique-correlation-value"
  },
  "signature": "<base64url-encoded-Ed25519-signature>"
}
```

Illustrative only; no private signing key, live signature, domain endpoint, or
authorization is included. Time fields are Unix seconds, maximum validity is
five minutes. The prototype signs the `adamantez-grant/1\n` domain separator
followed by recursively key-sorted compact JSON of the `grant` object, using
the linked JavaScript reference implementation. Cross-language canonicalization
and signed conformance fixtures MUST be agreed before other clients issue grants.

## Security contract

- Public source descriptors advertise only `source.resolve` as an abstract
  discovery capability. **There is no source resolver implementation in R02.**
- Branch names, worktrees, manifests and UI hidden states never grant access.
- The gateway may *evaluate* signed grants, but each private operation must
  verify the authenticated principal and authorization again at **point of use**.
- A host-level shared `ADA_INTERNAL_KEY` used by today's MAS prototype is
  insufficient to isolate hostile/compromised plugins; private source retrieval
  requires per-service identity and a stronger authenticated transport.
- The current evaluator has no replay ledger, privileged source retrieval,
  artifact delivery, sandbox, audit chain or production deployment.
- An unavailable provider is not an implicit success or a reason to hardcode
  an address; optional capabilities disappear from the live graph.

## Required acceptance before plugging into live source routing

A distinct MAS source provider must expose a scoped authorization boundary
and return **only approved signed artifacts** to agents. Test expiry, revocation,
mixed public/private jobs, delegated peer scope, private-log leakage, independent
review, signed package activation and rollback. Keep the five autonomous
development workers' schedules, roles and prompts unchanged; this contract is
additive to their shared repository-routing reminder.

See [R01 source routing](../../docs/ADAMANTEZ-SOURCE-BOUNDARY-R01.md).
