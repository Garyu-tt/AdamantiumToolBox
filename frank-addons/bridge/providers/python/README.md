# Python Frank Adapter (experimental, Linux-only)

This is a **real Python execution provider**, not a compiler or a simulated
adapter. It is separate from normal MAS plugins and from the microkernel.

## Requirements

- Linux with unprivileged user namespaces enabled and a working Bubblewrap
  (`bwrap`) installation.
- Python 3 with its standard library accessible inside the sandbox via
  `/usr`. Third-party site packages are deliberately disabled (`-I -S`).
- A private `ADA_FRANK_STATE_DIR`, an owner-controlled `ADA_INTERNAL_KEY`,
  and a configured `FRANK_ADAPTER_PORT`. Do not commit secrets or state.
- The optional `apps/frankenstein` gateway running under MAS.

Example commands (use the **same private runtime environment** for gateway,
registry management and provider; the secret must already be injected):

```sh
export FRANK_ADAPTER_PORT=9100
node frank-addons/bridge/providers/python/service.mjs
# In a separate operator shell with the same private env:
node frank-addons/bridge/manage.mjs adapter frankenstein.adapter.python 9100 --approve
node frank-addons/bridge/manage.mjs plan frank.python.hello
node frank-addons/bridge/manage.mjs approve frank.python.hello --approve
```

The adapter serves only on `127.0.0.1`. Its `/health` returns 503 if
namespace isolation is unavailable, so Bridge does **not** publish the
Python capabilities. Unapproved packages never execute.

`POST /invoke` ignores caller-supplied executable file paths. It resolves the
installed manifest and owner-approved SHA-256 digest itself, validates the
declared action, re-copies the complete package into a private temporary
directory and hashes it again. Bubblewrap mounts that copy read-only at
`/addon`, maps only minimal system directories, unshares networking and
process namespaces, and runs `python3 -I -S /runner.py`. Python code must
expose `handle(action, params)` returning a JSON-serializable result.

## Security boundary

Bubblewrap **must** be installed and allowed by the host. There is no
unprotected fallback on Linux or Windows. Sandbox execution has wall-time,
CPU, virtual-memory, output and file-size limits; it does not yet enforce
per-addon user identity, Linux seccomp syscall policy, cgroup PIDs/CPU,
publisher signatures, dependency supply-chain validation, or immutable
content-addressed installs. Bind-mounted host system directories remain
readable. Treat arbitrary third-party Python as untrusted until these
controls and a separate security review are complete.

Windows execution is deliberately unsupported until a native isolated worker
is supplied. The adapter uses no GPU and does not change classic MAS loading.
Run `node tests/frank_python.test.mjs` for policy tests and an execution smoke
test when Bubblewrap is available.
