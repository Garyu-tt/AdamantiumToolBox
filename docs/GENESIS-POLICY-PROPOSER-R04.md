# Genesis Policy Proposer R04

Status: **draft, CPU-only, source-only**. This is a pure, deterministic *simulation* provider, NOT a live Genesis, goal generator, neural system or actuator.

The independent MAS app \`apps/genpropose\` exports **\`genesis.policy.propose.v1\`**, one required leaf of the merged recursive Genesis policy composite \`genpolicy\` (#91). It consumes a caller-owned \`genesis.worldmodel.state.v1\` observed-state snapshot, caller-supplied numerical goal \`{entityId, feature, target}\`, and an explicitly provided action catalogue.

Every action must be marked \`scope:'virtual'\` and \`mode:'simulate'\`, must match the chosen observation/feature and has bounded numeric \`delta\` and nonnegative \`cost\`. It computes a first-order additive counterfactual and ranks proposals by \`utility = improvement − cost\`. It invents **neither goals nor executable actions**. Missing features produce no candidates. An input state/goal digest, revision and last-event cursor support stale-plan detection by the separate selector.

No motor action is executed, no external side effects or permissions granted. The plugin owns no durable memory, imports no sibling app, and runs as Core + App with host-delegated auth and a read-only UI.

Run focused tests after checking out this branch:

\`\`\`sh
node --test tests/genpropose.test.mjs tests/genpropose_service.test.mjs
\`\`\`

Locally 3/3 PASS on Node v22.16.0, including a separate authenticated HTTP process, contract schema, deterministic input handling, malicious/out-of-scope rejection and absent launch denial. Cross-component composition and simulation smoke are provided separately because \`genselect\` is an independent draft.

Before merge: full repo MAS schema, architecture and Core+App isolation; independent Gauntlet, Windows E2E, signing and owner-approved activation. No claim that this deterministic heuristic constitutes cognition.

Refs #47 #91 #99.
