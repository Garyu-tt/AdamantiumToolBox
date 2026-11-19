# Dante World microplugin R1 — deterministic CPU fixture

Status: **DRAFT / test provider**, not a persistent simulated life and not Genesis.

## Separation
- `apps/danteworld` is a self-contained MAS app: independently starts with Core and does **not** import other applications, the Leonardo UI, Noosphere, or external SDKs.
- `engine.mjs` is a self-contained copy of the deterministic fixture algorithm from draft PR #55, bundled so signed plugin installation and Core+App isolation do not depend on a repository-wide SDK. This deliberate temporary duplication should be replaced by a reviewed packaging/versioned library mechanism later.
- The provider graph publishes `dante.world.observe.v1` and `dante.world.apply.v1` with `fixture:true`. Dante's composite app R0 (#85) must mark these as **simulated**, not live.
- `danteworld.snapshot`/`restore` round-trip state *in memory*. They do **not** write a persistent checkpoint. Separate checkpoint PR #49 is still required.
- `danteworld.read` and `danteworld.control` are independent permissions. Control must be granted explicitly. The service binds only to loopback.

## Run focused regression locally

```bash
node --test tests/danteworld_contract.test.mjs tests/danteworld_provider.test.mjs
```

Then in the full repository, independently check:

```bash
node tools/mas-check.mjs
node tests/isolation.test.mjs
python tools/architecture-check.py
```

The standalone smoke covers authenticated Graph/Invoke routes, schema validity,
a successful step, stale tick rejection, safe snapshot/restore, bad snapshot rejection,
unknown action denial and file limits.

## Future integration gates

1. Independent review of PR #55 and confirmation this fixture passes Core+App isolation.
2. Composition in #85 through capability graph — never by hardcoded direct app imports.
3. Reliable sensor delivery with ACK/replay (#46 currently lacks these guarantees).
4. Independent atomic checkpoint/restart QA (#49).
5. **Verified persistent real Genesis** before any activation claim.
6. Signed lifecycle, manual activation approval, Windows smoke and readback.

A missing Genesis is a blocking diagnostic, not an invitation to replace it with a scripted agent.
