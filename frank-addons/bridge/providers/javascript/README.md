# JavaScript Frank Adapter — Linux-only experimental executor

The optional `frankenstein.adapter.javascript` provider implements
[FRANK-ADAPTER-1](../../../../../standards/FRANK-ADAPTER-1.md).
It is a language provider, not a classic MAS plugin or microkernel component.

Requires Node.js, an executable Linux Bubblewrap (`bwrap`) namespace
sandbox, owner-controlled `ADA_INTERNAL_KEY`, `ADA_FRANK_STATE_DIR`,
and `FRANK_ADAPTER_PORT`. It will refuse to run without isolation;
Windows support is intentionally not included.

Start and approve separately (port is an operator-selected example):

```sh
export FRANK_ADAPTER_PORT=9101
node frank-addons/bridge/providers/javascript/service.mjs
# In a second shell, with the same private state configuration:
node frank-addons/bridge/manage.mjs adapter frankenstein.adapter.javascript 9101 --approve
node frank-addons/bridge/manage.mjs plan frank.javascript.hello
node frank-addons/bridge/manage.mjs approve frank.javascript.hello --approve
```

A JavaScript addon declares `entry: "main.mjs"` and exports a function:
```js
export async function handle(action, params) { return {action, params}; }
```

The provider uses a read-only snapshot at `/addon`, a Node executable
bound read-only into a Bubblewrap namespace, network unsharing, an
empty environment and a 3.5s wall-clock timeout. Node runs without native
addons and limits V8 old-space to 64 MiB. Submodule imports within the
snapshot work. `stdout` carries the JSON result, with a 64 KiB ceiling.
Any code writing unrelated output to stdout invalidates the response.

**Not a hardened hostile-code boundary:** seccomp, cgroup memory/PIDs,
per-plugin Linux users, immutable signed releases, third-party supply
chain verification, strict read-access restrictions for mounted system
libraries, and full per-action authorization are not yet implemented.
Do not approve unaudited third-party code for production.
