# Recursive MAS module contract v1 (experimental)

A plugin is an independently installed package. A module is a separately configurable lifecycle unit. A component is a reusable implementation part. A capability is a versioned API contract provided by any unit. Recursive nesting organizes ownership but **does not define dependencies**: any module can require an abstract capability from another module or plugin.

Each module declares `modules/<child>/module.json` recursively, without a fixed maximum depth. Shared manifest fields include MAS version, ID, version, lifecycle, capabilities, settings, events and permissions. Module-specific fields include kind, isolation, entry, provides, requires, enabled. Top-level legacy `manifest.json` remains compatible and will be unified through a separately versioned packaging migration.

A provided capability has name and major.minor version, optionally an action and permission. A required capability declares name and minimum compatible major.minor. Negotiation currently accepts equal major and provider minor >= requested minor, a simple R01 rule, NOT general semantic-version negotiation.

The generic loader is under `core/modules`, part of the minimal lifecycle infrastructure. It recursively validates module manifests, resolves dependencies by capability, and activates in-process implementations. Disabled or missing modules do not emit graph actions or placeholder UI. The module policy is data-driven; module names are never hardcoded in the loader.

`in-process` isolation is lightweight and limits error propagation from activation/calls, not crashes. `dedicated` isolation is reserved and currently rejected; it must never silently downgrade to in-process. Hot updates, distributed routing, per-caller policies, capability aliases and typed remote transport require subsequent releases.

Every plugin must pass an independent Core + Plugin test. One process may host many lightweight components, while independently managed processes or remote nodes are used only when justified. The public API should survive promoting a module into its own plugin.
