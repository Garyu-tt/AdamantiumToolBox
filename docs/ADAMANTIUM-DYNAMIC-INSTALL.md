# Dynamic MCP Bridge installation (source-only)

The **standalone** bridge source is `packages/mcp_bridge`. It is deliberately absent from bundled `apps/`, so Core does not start or reserve its ID just because a repository is checked out.

The existing MAS Lifecycle is authoritative. A generic CLI `tools/plugin-stage.mjs` stages and signs a package under the local Mesh identity, using the existing owner-approved capabilities and signed-store validation. It requires the Mesh identity to be provisioned **before** staging; a status check never generates or replaces it. No key material or bearer is printed.

From the Adamantium repository root, on the *authorized installation machine*:

```sh
node tools/plugin-stage.mjs prepare packages/mcp_bridge
node tools/plugin-stage.mjs install packages/mcp_bridge --approve
node tools/lifecycle.mjs status
```

The prepare step is safe to inspect: it writes a signed immutable packet to the local content-addressed store, returning the exact activation plan without running the app. Install must be explicitly approved, runs the standard lifecycle probe, commits `active.json` atomically, and reads back the newly selected app from the catalog. The existing background supervisor discovers the installed app on its next poll. The legacy one-shot supervisor must use the dynamically discovered `app.directory`.

The installed bridge remains **disabled for external MCP** until independent operator-controlled `ADA_MCP_BEARER`, approved pinned node registry and HTTPS ingress are configured. Approval never grants new capabilities: `policy.json` must already permit `mcp_bridge.read`. An existing bundled ID or port conflict fails; do not work around either collision. The active app can be rolled back through the existing signed Lifecycle. Do not copy private Mesh keys between simultaneously active owners or expose `/ready` outside loopback.

Running the installer on a laptop requires authorized local execution (JediControl if available). A successful local unit test or GitHub CI is NOT proof the laptop is installed. Confirm `plugins/active.json`, process health and the live Core capability graph on that host before claiming success.
