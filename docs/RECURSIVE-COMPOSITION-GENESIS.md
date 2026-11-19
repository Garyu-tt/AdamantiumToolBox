# ADR: recursive composition for Genesis and the AdamantiumToolBox

Status: **PROPOSED / source-only**. Parent: [ADR-0001](ADR-0001-ARCHITECTURE.md). Scope: a generic mechanism, first exercised with the Dante/Genesis dependency tree. This does not claim that Genesis is executing.

## Decision

Anything too complex to implement, verify, deploy or maintain as one small isolated capability MUST be decomposed into multiple independently versioned microplugins connected by typed capability contracts. **Every composite can itself be a child of another composite.** Depth is a runtime-budget policy, not a hardcoded module hierarchy. Splitting is motivated by bounded testability and independently replaceable responsibilities, *not* the literal size of an AI prompt.

A composite is a **declarative composition plan**, not a monolithic executable, private datastore, privileged host or unconditional action provider. Its exports describe the *desired public interface*, not an automatically callable live operation.

```text
Dante composite
  ├── World provider(s)          -> world.observe / world.apply
  ├── Sensory journal            -> sensory.deliver
  ├── Genesis composite          -> genesis.apply (NOT live without binding + attestation)
  │   ├── Perception composite   -> normalize / integrate / optional salience
  │   ├── World Model            -> update
  │   ├── Policy composite       -> propose / select / optional simulation
  │   ├── Self-State             -> snapshot
  │   └── optional subcomposites -> attention / plasticity / language
  ├── Motor adapter              -> motor.command
  └── Durable state service      -> checkpoint / restore
```

## Current source contract

- `sdk/composition/resolver.mjs` is a **pure, read-only planner**. It receives a caller-supplied set of `mas.composite.v1` manifests and an *already permission-filtered* capability graph.
- Each recipe defines `id`, `version`, `exports`, `requires` and `optional`. Requirements bind by **versioned contract**, not provider ID, path, IP, host, programming language, node count or OS.
- Matching action providers and nested composite exports are resolved recursively. An absent required provider, ambiguity, synthetic `fixture:true` provider, cycle or depth budget prevents a ready plan. Absent optional providers are recorded but never block required functionality.
- `maxDepth=16`, `maxNodes=512` are *configuration defaults* guarding CPU/heap, **not maximum architectural nesting**. The caller can configure bounded values; startup must not recurse indefinitely.
- Returned `discovered:true` only means every required role has a unique non-fixture contract **in the supplied graph**. It is NEVER proof of reachability, liveness, signed artifact authenticity, state continuity or correct execution; `runnable` deliberately remains `false`.
- Recipe selection, durable ownership, dependency pins, isolated service execution, action routing and hot revocation belong to independent MAS services, **not the planner**. No Core change or implicit deployment.

## Acceptance process for every new atomic microplugin

1. Versioned typed contract: inputs, outputs, errors, trace IDs, budgets and state ownership.
2. Standalone `Core + App` test with all other optional apps removed.
3. Pure unit tests, adversarial cases and independent Gauntlet review.
4. Declared dependencies resolved through permissions and live capability discovery, with safe degraded behavior.
5. Signed bundle and explicit authorization to activate. Crash/restart and state migration verified when stateful.
6. Only then surface an exported action in a parent composite, with a real routing/binding proof.

If work is too big for one verified increment, **recursively decompose the component**, including a component that was already part of a composite. No forced rewrite of functioning components and no cross-app direct imports.

## Genesis and identity continuity constraints

Genesis MUST NOT own the only copy of Dante's durable identity. The instance ID, event cursor, ordered history, versioned snapshots, model/adapter provenance and safe migration protocol are external durable contracts. Upgrades of decision, perception or world-model providers must preserve state ownership and be tested in shadow/dual-run mode before switch. A behavioral/technical continuity test is not proof of subjective identity.

A scripted fixture is not a real persistent Genesis. The lower-level perception and policy manifests included here are **interface designs only**; no cognitive engine is implemented or running.

## Next gated implementation

- Connect plan evaluation to the host's **authorized, currently available graph**, not a public/untrusted graph.
- Implement a separately loadable recipe-registry provider (approved manifests, atomic revisions, revocation and resource budgets). Do not include it in the microkernel.
- Implement the actual subproviders in narrow, independently reviewed PRs, prioritizing a minimum CPU cognitive loop.
- Only after a real Genesis instance provides stateful `dante.genesis.apply.v1` with signed live attestation can a composite declare a runnable state.
- Test 100+ cycles, durable sensor ACK and checkpoint-before-ACK replay, shutdown/restart, CPU/RAM limits and Windows smoke. External/physical actions require an idempotent outbox, not only a checkpoint.
- Do not merge, activate or use `main` as a deployment target until independent QA and Lifecycle gates pass.

## Verification

```sh
node --test tests/recursive_composition.test.mjs
node tests/isolation.test.mjs
python tools/architecture-check.py
```

The first command validates the planner; the last two are repository-wide release gates to run independently, not tests of a working Genesis.
