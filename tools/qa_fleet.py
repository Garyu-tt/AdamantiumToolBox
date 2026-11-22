#!/usr/bin/env python3
"""Bounded, read-only, evidence-first GitHub PR scanner. Never approves or merges."""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import os
import re
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

API = os.environ.get('GITHUB_API_URL', '').rstrip('/')

def fetch(path):
    headers = {'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28'}
    token = os.getenv('GITHUB_TOKEN')
    if token:
        headers['Authorization'] = 'Bearer ' + token
    if not API.startswith('https://'):
        raise RuntimeError('GITHUB_API_URL must be configured with HTTPS')
    req = Request(API + path, headers=headers)
    try:
        with urlopen(req, timeout=12) as res:
            return json.load(res)
    except (HTTPError, URLError, TimeoutError, ValueError) as err:
        raise RuntimeError('GitHub read failed at ' + path.split('?')[0] + ': ' + type(err).__name__) from err

def pages(path, limit):
    items = []
    for page in range(1, limit + 1):
        part = fetch(path + ('&' if '?' in path else '?') + 'per_page=100&page=' + str(page))
        if not isinstance(part, list):
            raise ValueError('GitHub pagination response was not an array')
        items.extend(part)
        if len(part) < 100:
            return items
    raise RuntimeError('Pagination limit reached; result may be incomplete')


def public_repos(owner, max_pages):
    rows = pages('/users/' + quote(owner, safe='') + '/repos?type=owner', max_pages)
    return [r['full_name'] for r in rows if not r.get('archived') and not r.get('private')]


def inspect(repo, pr):
    number = pr['number']
    detail = fetch('/repos/' + repo + '/pulls/' + str(number))
    head = detail['head']['sha']
    base = detail['base']['sha']
    runs = fetch('/repos/' + repo + '/commits/' + head + '/check-runs?per_page=100')
    checks = runs.get('check_runs', [])
    if runs.get('total_count', len(checks)) > len(checks):
        decision = 'checks_unproven'
    elif not checks or any(c.get('head_sha') != head for c in checks):
        decision = 'checks_unproven'
    elif any(c.get('status') != 'completed' for c in checks):
        decision = 'ci_pending'
    elif any(c.get('conclusion') != 'success' for c in checks):
        decision = 'ci_not_green'
    else:
        decision = 'candidate_for_deep_review'
    if detail.get('draft'):
        decision = 'draft'
    if detail.get('mergeable') is False:
        decision = 'merge_conflict'
    # No positive QA verdict: merge commits, base movement, required jobs and reviews
    # require separate exact-revision verification by an independent reviewer.
    return {'repo': repo, 'number': number, 'url': detail['html_url'],
            'head_sha': head, 'base_sha': base, 'state': decision,
            'checks_on_head': len(checks), 'draft': bool(detail.get('draft')),
            'evidence': 'head-only metadata; not an approval'}


def run(repos, threads, max_pages):
    # Public default; private repos require explicit authorization and allowlist.
    todo, errors = [], []
    for repo in sorted(set(repos)):
        try:
            for pr in pages('/repos/' + repo + '/pulls?state=open', max_pages):
                todo.append((repo, pr))
        except (RuntimeError, KeyError, ValueError) as err:
            errors.append({'repo': repo, 'error': str(err)})
    results = []
    with ThreadPoolExecutor(max_workers=threads) as pool:
        futures = {pool.submit(inspect, repo, pr): (repo, pr['number']) for repo, pr in todo}
        for future in as_completed(futures):
            repo, number = futures[future]
            try:
                results.append(future.result())
            except (RuntimeError, KeyError, ValueError) as err:
                errors.append({'repo': repo, 'number': number, 'error': str(err)})
    results.sort(key=lambda p: (p['repo'], p['number']))
    return {'schema': 'mechanicus.qa-fleet.scan/1', 'parallel_limit': threads,
            'scanned': len(results), 'errors': errors, 'prs': results,
            'mode': 'read_only_triage_no_merge_no_approval'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--owner', default=os.environ.get('GITHUB_REPOSITORY_OWNER'))
    parser.add_argument('--repos', nargs='*', help='Explicit authorized full repo names')
    parser.add_argument('--threads', type=int, default=8)
    parser.add_argument('--max-pages', type=int, default=3)
    args = parser.parse_args()
    if not 1 <= args.threads <= 16 or not 1 <= args.max_pages <= 10:
        parser.error('threads must be 1..16 and max-pages 1..10')
    if not args.repos and not args.owner:
        parser.error('Specify --owner or --repos')
    repos = args.repos if args.repos is not None else public_repos(args.owner, args.max_pages)
    if any(not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', repo) for repo in repos):
        parser.error('Repository names must be in owner/name form')
    data = run(repos, args.threads, args.max_pages)
    json.dump(data, sys.stdout, ensure_ascii=False, sort_keys=True)
    print()
    return 1 if data['errors'] else 0


if __name__ == '__main__':
    sys.exit(main())
