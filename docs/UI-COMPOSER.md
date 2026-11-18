# UI Composer — optional MAS graphics layout service

UI Composer is an independent plugin with resource schema
`mas-ui-composer-provider-1` and `planAction`, discovered via the authorized
live capability graph. Its sole permission is `ui.compose` (opt-in).

**Three conceptual modes:** Raw (always available at client), Automatic
(deterministic schema-based grouping and ordering, provided now), Intelligent
(future model-backed provider, **NOT included**). Unavailable modes must not
silently pretend an AI model composed anything.

Input `{schema:{schema:"mas-ui-schema-1",app,elements,groups?},mode:"automatic"}`.
Each element has unique stable ID, a typed role and optional group/label.
A group has an ID, title, width constraint and optional relative priority.
Output `mas-ui-plan-1` only contains sections (ID, title, width, item IDs).
The plan cannot delete, duplicate or invent any control IDs. It does not
contain code, callbacks, URLs, permissions, styles or backend action calls.

The rendering adapter belongs to the consuming view, not the composer:
it must validate the output and move existing DOM controls instead of
recreating them, preserving listeners, focusable values and event handlers.
When the provider disappears or is unauthorized, restore DOM via original
anchors. The whole application continues as Raw UI.

The initial deterministic policy uses semantic roles and explicit group hints.
The model may later propose another complete valid plan, subject to the
same constraints and user approval. No LLM, vision model, tokens or image/video
models are required to operate this plugin.

Independent app example: `apps/leonardo` opts into the contract, while its
core graphics API remains unaffected when UI Composer is removed.
