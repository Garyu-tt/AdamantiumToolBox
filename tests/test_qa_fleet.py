"""Offline PR scanner safety and concurrent-progress regression tests."""
import importlib.util
from pathlib import Path
import threading
import time
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('qa_fleet', Path(__file__).parents[1] / 'tools' / 'qa_fleet.py')
qa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qa)


def pr(num):
    return {'number': num}


def detail(num, draft=False, conflict=None):
    return {'number': num, 'html_url': f'https://github.com/sample/repo/pull/{num}',
            'head': {'sha': 'head' + str(num)}, 'base': {'sha': 'base' + str(num)},
            'draft': draft, 'mergeable': conflict}


class FleetTests(unittest.TestCase):
    def test_ci_green_is_only_candidate_never_approved(self):
        def fake(path):
            if '/check-runs?' in path:
                return {'check_runs': [{'status': 'completed', 'conclusion': 'success', 'head_sha': 'head4'}], 'total_count': 1}
            return detail(4)
        with patch.object(qa, 'fetch', fake):
            out = qa.inspect('sample/repo', pr(4))
        self.assertEqual(out['state'], 'candidate_for_deep_review')
        self.assertIn('not an approval', out['evidence'])

    def test_pending_and_skipped_fail_closed(self):
        for status, conclusion, expected in [('in_progress', None, 'ci_pending'),
                                             ('completed', 'skipped', 'ci_not_green')]:
            def fake(path):
                if '/check-runs?' in path:
                    return {'check_runs': [{'status': status, 'conclusion': conclusion, 'head_sha': 'head7'}]}
                return detail(7)
            with patch.object(qa, 'fetch', fake):
                self.assertEqual(qa.inspect('sample/repo', pr(7))['state'], expected)

    def test_draft_and_conflict_override_green(self):
        for opts, expected in [({'draft': True}, 'draft'), ({'conflict': False}, 'merge_conflict')]:
            def fake(path):
                if '/check-runs?' in path:
                    return {'check_runs': [{'status': 'completed', 'conclusion': 'success', 'head_sha': 'head7'}]}
                return detail(7, **opts)
            with patch.object(qa, 'fetch', fake):
                self.assertEqual(qa.inspect('sample/repo', pr(7))['state'], expected)

    def test_blocked_pr_does_not_stop_others(self):
        lock = threading.Lock()
        active = [0, 0]
        def fake(path):
            if path.startswith('/repos/sample/repo/pulls?'):
                return [pr(1), pr(2), pr(3), pr(4), pr(5), pr(6)]
            if '/check-runs?' in path:
                if 'head1/' in path:
                    raise RuntimeError('rate limit')
                return {'check_runs': []}
            with lock:
                active[0] += 1
                active[1] = max(active)
            time.sleep(0.003)
            with lock:
                active[0] -= 1
            return detail(int(path.split('/')[-1]))
        with patch.object(qa, 'fetch', fake):
            out = qa.run(['sample/repo'], 4, 1)
        self.assertEqual(out['scanned'], 5)
        self.assertEqual(len(out['errors']), 1)
        self.assertGreater(active[1], 1)
        self.assertEqual([p['number'] for p in out['prs']], [2, 3, 4, 5, 6])

    def test_pagination_cap_does_not_return_false_complete(self):
        with patch.object(qa, 'fetch', lambda path: [pr(i) for i in range(100)]):
            with self.assertRaisesRegex(RuntimeError, 'Pagination limit'):
                qa.pages('/repos/sample/repo/pulls?state=open', 1)


if __name__ == '__main__':
    unittest.main()
