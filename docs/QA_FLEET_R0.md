# Mechanicus QA Fleet R0: parallel, read-only PR triage

**Status:** opt-in pilot. No code review, no approval, no merger, no CI bypass.
This is the first scanner for [#173](https://github.com/Garyu-tt/AdamantiumToolBox/issues/173), not a substitute for a separate authenticated AI reviewer and QA executor.

## Function

`tools/qa_fleet.py` fetches all public owner repos (or an explicit authorized allowlist), then the full open PR inventory with capped pagination. A bounded Python thread pool inspects each PR metadata and **check-runs at the exact PR HEAD SHA**. A failed/blocked PR is logged independently; other inspections continue. Runs output machine-readable JSON, every PR record with head/base SHA, explicit provisional state, and URL. No GitHub write calls exist.

Possible provisional states: `draft`, `merge_conflict`, `ci_pending`, `ci_not_green`, `checks_unproven`, `candidate_for_deep_review`. **None are an acceptance/merge verdict.** A HEAD-only green check set does not prove synthetic-merge checks, the required job set, actual code quality, reviewer approval, or current BASE compatibility. Full acceptance requires a separate independently authorized reviewer (see Mojum #712), exact HEAD+BASE, required contexts and repository rulesets.

## Start locally

Use an explicitly authorized, scope-minimal read token, or no token for public repos. Do not pass tokens as command-line arguments; never paste token contents into a PR. Example (public metadata):

```sh
export GITHUB_API_URL="https://api.github.com"
python3 tools/qa_fleet.py --owner "YOUR_GITHUB_OWNER" --threads 8 > qa-fleet.json
python3 -m unittest discover -s tests -p 'test_qa_fleet.py' -v
```

For explicitly authorized repositories, pass `--repos owner/repo owner/repo2`. The built-in discovery path lists **public repos only**, intentionally excluding private ones even if the token can read them. For private repos use a separate private environment/report and an allowlist. GitHub Actions' built-in token usually cannot read your other private repositories.

The opt-in `.github/workflows/qa-fleet-r0.yml` scans public repos on a 15-minute schedule **only after it is accepted and merged on the default branch**. Scheduled workflows may be delayed and are not evidence of continuous workers. It never sends private repo contents, tokens or model prompts to logs. No paid model APIs are invoked.

## Next gates (not yet implemented)

- Persistent per-PR exact-sha leases, failure/backoff, pagination across check-run results, required-context discovery and synthetic-merge parent verification.
- Per-repo bounded deep reviewers: actual diff review, hermetic test runner, repair-as-PR pipeline and independent reviewer account. Each blocker yields a reason and allows another PR to proceed.
- Source-authenticated `started/heartbeat/finished` events delivered to Cezar; no inferred external liveness from ChatGPT schedules or Telegram messages (see Mojum #717).
- Verified throughput: 8/16 active checks, queue age, completed review+merge counts, rate-limit and cost budget. Reserved threads != running model agents.
