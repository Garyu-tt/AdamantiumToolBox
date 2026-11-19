# ADR-0002 (DRAFT): recursive composed MAS applications

Decision: any substantial feature can be implemented as a recursively composed application; a component of one composite may itself be another composite. This is a *general* Mechanicus pattern, not a Dante-specific exception.

## Contract

A leaf is a separately versioned, independently testable MAS capability provider. A composite declares a versioned `mas.composite.v1` descriptor, exports typed contracts, and consumes required/optional slots by capability contract—not by node ID, host, implementation language, plugin path, or hardcoded program list.

`Dante -> Genesis -> perception/world-model/decision/self-state -> further subcomposites` is one example. Recursive depth is not architecturally fixed; a configurable finite traversal budget prevents cycles, runaway resource use, and unbounded recursion. A shared component may be used by several composites, but ownership, side effects and state must remain explicit.

## Implementation, current scope

- `sdk/composition/resolver.mjs` is a pure offline planner over an ALREADY authenticated, permission-filtered capability graph and explicit descriptors. No host commands, network, model calls, plugin installation or runtime activation.
- `standards/composition/genesis.json` and `dante.json` define required and optional slots. These are *blueprints*, not registered MAS services or proof of a running brain.
- A direct action provider, even if discovered, is not evidence of live runtime or persistence. `fixture:true` is rejected for a required production slot; ambiguous matches and recursive cycles fail closed.
- A *virtual composite export* from a descriptor is a planning candidate only. Before a real composite advertises a callable action, the supervisor must verify all required providers, identities, permissions, actual invocation routes, runtime health, compatible versions, state and signed activation.
- The resolver always returns `runnable:false`. It cannot authorize a launch. A separate authorized runtime orchestrator must handle dynamic binding, lease/ownership, lifecycles, and revocation.

## Decomposition boundaries

Split by independently testable capability, change rate, state ownership, fault isolation and scalability—not mechanically into a new OS process for every function. A tiny pure helper may stay in a microplugin; a large service can contain nested composite definitions. Shared functionality should be factored into contracts/adapters instead of duplicating Core logic.

Each accepted unit must have one small contract, bounded resource budget, deterministic fixtures, an independent Core+App test when applicable, versioned state migrations, diagnostics, and no dependency on optional UI or GPU. Provider selection must be explicit when more than one compatible provider is visible; the current planner refuses ambiguity.

## Genesis-specific constraints

- Genesis is a **composite cognitive application**, not one oversized model or one file. Its perception, world-model, decision policy, self-state, optional attention, plasticity and language are separate contracts. Future modules may themselves be composites.
- Persistent cognitive state is an external separately managed state resource, not owned by the install tree or ephemeral plugin process.
- Replacing submodules must not overwrite historical checkpoints or silently migrate state. New providers shadow-test first; incompatible state schema fails closed. A replacement does not prove preservation of subjective identity.
- Real world/motor side effects require idempotent outbox and durable receipts; checkpoint-before-ACK alone only solves a local deterministic fixture.
- No fake `Genesis` activation from a mock controller; a missing real cognition provider remains a blocker.

## Acceptance gates

1. Contract/resolver tests: nested DAG, missing, ambiguous, fixture, cyclic graph, invalid metadata, bounded depth.
2. Independent Gauntlet, full repository regression and code-size/architecture gates.
3. Real authorized provider verification, dynamic revocation, permission intersection and cross-process communication tests.
4. Stable instance state with atomic checkpoint, crash/restart reconciliation, provenance, migration, and per-device resource budgets.
5. Signed staged activation and native Windows/Linux smoke; do not auto-merge or auto-deploy.

Related: [ADR-0001](./ADR-0001-ARCHITECTURE.md), Dante critical path #47, composite shell #85, sensory #89, checkpoint #90.
