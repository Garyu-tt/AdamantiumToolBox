# Factory Anchor R10 — live preview evidence

## Real operator preview verification (2026-11-20)

- **Production** MAS Core observed listening on loopback `8880`; `factory_anchor` **not** in active registry, port `8966` unused. The owner policy actually **lacks** `factory_anchor.read` and `factory_anchor.attest`. A previous PowerShell probe erroneously interpreted a one-element boolean array as truthy; the native R10 preflight and explicit readback corrected this. No scopes were granted.
- Live R10 state is `not_ready`, `missingPermissions:[factory_anchor.read,factory_anchor.attest]`, `operatorPolicyApprovalRequired:true`, `selectedInCore:false`, `productionInstallationPerformed:false`.
- Actual Windows disposable source signer generated a signed staged package with digest `527d6d0187f4d32cb00280cb0ee01f7213beded5c6bbe1457038c07a07863806`, verified source readback, zero selected apps, ephemeral signing key destroyed, no access to owner production key.
- Windows local tests passed: signed stage CAS and owner-policy denial; isolated actual signed activation followed by rollback; disposable Ed25519 proof; two safe visual graph tests. Separate GitHub Windows/Linux CI handles Node22/24.
- Visual Node-RED Studio: tab **10 · SIGNED LIFECYCLE R10** at `http://127.0.0.1:1885/#flow/f10f000000000001`; two visible lanes: actual blocked production authorization and independent disposable signed staging. **17 tabs, 262 nodes**; previous 242 nodes retained, CAS backups taken, Node-RED HTTP 200, runtime errors zero, real headless Chrome rendered both branches.
- Desktop Windows shortcut `Adamantium Studio - Check Lifecycle R10` only refreshes the live owner-policy preflight; it cannot approve scopes or activate a plugin. Self-test returns `not_ready` with exit code 0 and no stderr.

## Stop conditions / next step

Do not run the production `stage-only`, native `activate` or sign on behalf of the owner while scopes are missing. Use a separate explicit owner-authorized approval of least-privilege capabilities, signed policy receipt, revision CAS and live Core capability readback; do not infer a grant from repository source or test receipts. A security improvement is to separate read-only installation from the optional attest capability in a new manifest version instead of demanding both scopes for simple read access.

Neither the real Core nor JediControl services were restarted or altered; no production installer or dashboard direct-control endpoint was added.