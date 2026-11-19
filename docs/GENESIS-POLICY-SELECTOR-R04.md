# Genesis Policy Selector R04

Status: **draft, CPU-only, source-only**. This provides an advisory simulation decision, not executable motor authority or a real Genesis runtime.

The independent MAS app \`apps/genselect\` exports \`genesis.policy.select.v1\`, the second required leaf of merged recursive Genesis policy composite \`genpolicy\` (#91). Inputs: \`genesis.policy.proposals.v1\`, a **fresh, caller-supplied** allowlist of action IDs and an expected state/goal \`basis\` digest. The selector rejects stale digests, invalid candidates, external scopes, duplicate IDs and nonfinite scores.

It sorts by numerical benefit, breaks ties deterministically by candidate ID, and either recommends the best permitted *positive-utility* virtual action or returns \`reason:'abstain'\` with no selection. Its output **always** declares \`mode:'simulation'\`, \`approved:false\`, \`executable:false\`.

The allowlist is a filter for a test proposal set, **not authorization to invoke a real capability**. Actual motor control would require separate runtime identity, live permissions, state freshness checks, idempotent outbox, and independent signed Lifecycle.

This app owns no persistent state and imports no optional sibling plugin; it runs as Core + App on loopback with host-delegated auth and a read-only view.

Focused tests:

\`\`\`sh
node --test tests/genselect.test.mjs tests/genselect_service.test.mjs
\`\`\`

Local Node v22.16.0: 3/3 PASS, including an independent authenticated MAS child process, safe abstention, stale-plan rejection and absence of a launch action. Cross-PR HTTP composition smoke is distributed separately; no merger/activation is implied.

Release gates: independent review, repository-wide architecture/isolation QA, Gauntlet, Windows and signed Lifecycle. Not a real cognitive decision engine or durable Dante identity.

Refs #47 #91 and the independent Proposer draft.
