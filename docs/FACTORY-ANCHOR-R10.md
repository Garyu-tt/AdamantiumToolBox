# Factory Anchor R10 — signed package lifecycle gate, observable in Studio

**State:** source-only draft stacked on R09, no production MAS Core activation. The existing owner MAS Core and the separate Node-RED Studio are inspected through the established authenticated JediControl relay, not through an invented MAS capability.

## Contract

The independent R09 package declares MAS Core permissions `factory_anchor.read` and `factory_anchor.attest`. R10 adds an owner-key-aware signed lifecycle preflight and stage-only workflow in the Toolbox **development tools**. The R09 runtime package stays independently runnable with only Core + app, with no dependency on Studio, JediControl or these development tools.

`factoryLifecyclePreflight(project, runtime)` reads existing MAS owner identity (without generating a new production identity), signed registry revision, package manifest, owner policy and available app ports. It returns exact missing permission names and never modifies policy or app state.

`stageFactoryAnchor(project, runtime, expectedRevision)` requires the exact current registry CAS and both explicitly granted manifest scopes. Only then does it pack the actual independent app directory using the existing MAS bundle format, sign it with the already provisioned owner Ed25519 identity, verify the signature, add the envelope to the isolated signed **store**, run the native `planActivation` checks and re-read unchanged active registry. No `activate`, `rollback`, `supervisor`, service listen, host policy edit or implicit grant occurs.

`inspectFactoryStage(project, runtime, hash)` verifies a previously signed envelope and the registry readback; does not execute staged code. The explicit MAS `activate(..., true)` and `rollback(..., true)` are exercised **only inside disposable CI / local test runtimes**. No production activation is implied.

## Operator CLI

Read-only preflight (write public status only to an existing independent status folder):

```sh
node tools/factory-anchor-lifecycle-r10-cli.mjs preflight - <existing-absolute-status-directory>
```

Prepare a signed package and activation plan without activating it, **only after separately approved owner policy and exact expected revision**:

```sh
node tools/factory-anchor-lifecycle-r10-cli.mjs stage-only <expected-active-registry-revision> <existing-absolute-status-directory>
```

Read a previously staged signed envelope:

```sh
node tools/factory-anchor-lifecycle-r10-cli.mjs inspect <signed-package-hash> <existing-absolute-status-directory>
```

The CLI never offers a command to change owner rights or activate a package. A `signed_staged_unactivated` state is not authorization to install.

## Disposable signing proof

`tools/factory-anchor-lifecycle-r10-sandbox.mjs <existing-absolute-output-directory>` creates an isolated temporary MAS owner identity and temporary owner policy, signs the real factory_anchor source package, verifies native activation-plan checks, proves zero active apps and then destroys the ephemeral identity and runtime. Only a public test signature and digest remain in `factory-anchor-r10-sandbox-stage.json`; the receipt explicitly says `testIdentityOnly:true`, `ownerProductionIdentityUsed:false`, `productionCoreModified:false`, `ephemeralSigningKeyDestroyed:true`. It does **not** attest the real MAS owner's package signing.

## Visual graph

Native Node-RED `studio-lifecycle-r10.mjs` projects the public owner policy status to a read-only `watch/inject -> file in -> json -> switch -> 3 debug states` graph. An optional separate `sandbox-lifecycle-studio-r10.mjs` lower lane displays the disposable signed proof without privileged nodes. Neither graph uses exec, function, shell, OS commands, HTTP invocation, policy editing, module install, signer key or MAS authorization.


See [R10 operator evidence](FACTORY-ANCHOR-R10-EVIDENCE.md) for live status, scope gaps and browser checks.
