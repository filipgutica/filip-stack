"""Exercise collection scope and coverage reporting without contacting GitHub."""

import contextlib
import datetime as dt
import importlib.util
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock


SCRIPT = Path(__file__).resolve().parents[2] / "skills/pr-review-churn/scripts/collect_review_threads.py"
spec = importlib.util.spec_from_file_location("collector", SCRIPT)
collector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(collector)


class CollectorTests(unittest.TestCase):
    def test_missing_scope_is_rejected_before_github_access(self):
        for args in [[], ["--repo", "example/widgets"], ["--since-days", "30"]]:
            with self.subTest(args=args), mock.patch.object(sys, "argv", [str(SCRIPT), *args]):
                with mock.patch.object(collector, "infer_author", side_effect=AssertionError("Identity queried before scope was validated")) as identity:
                    with mock.patch.object(collector, "run_gh", side_effect=AssertionError("GitHub queried before scope was validated")) as api:
                        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit) as error:
                            collector.main()
                        self.assertEqual(error.exception.code, 2)
                        identity.assert_not_called()
                        api.assert_not_called()

    def test_explicit_scope_drives_queries_and_preserves_partial_coverage(self):
        successful_pr = {"number": 7, "reviewThreads": {"nodes": []}}

        def api_response(args):
            query = args[args.index("-F") + 1]
            if "repo:example/private" in query:
                raise RuntimeError("repository access denied")
            return {"data": {"search": {
                "issueCount": 1,
                "pageInfo": {"hasNextPage": False, "endCursor": None},
                "nodes": [successful_pr],
            }}}

        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "report.json"
            args = [str(SCRIPT), "--author", "review-author", "--repo", "example/widgets",
                    "--repo", "example/private", "--since-days", "17", "--output", str(output)]
            with mock.patch.object(sys, "argv", args), mock.patch.object(collector, "infer_author") as identity:
                with mock.patch.object(collector, "run_gh", side_effect=api_response) as api:
                    self.assertEqual(collector.main(), 0)
                    identity.assert_not_called()
            report = json.loads(output.read_text())

        cutoff = (dt.datetime.fromisoformat(report["generatedAt"]) - dt.timedelta(days=17)).date().isoformat()
        self.assertEqual(report["sinceDate"], cutoff)
        self.assertEqual(report["repos"], ["example/widgets", "example/private"])
        self.assertEqual(report["author"], "review-author")
        queries = [call.args[0][call.args[0].index("-F") + 1] for call in api.call_args_list]
        self.assertEqual(queries, [
            f"searchQuery=repo:{repo} is:pr author:review-author created:>={cutoff}"
            for repo in report["repos"]
        ])
        good, failed = report["results"]
        self.assertEqual(good["pullRequests"], [successful_pr])
        self.assertEqual(good["status"], "ok")
        self.assertEqual(failed["status"], "error")
        self.assertIn("access denied", failed["error"])
        self.assertTrue(failed["limitations"])

    def test_pagination_limit_and_nested_truncation_are_reported(self):
        page = {"data": {"search": {
            "issueCount": 100,
            "pageInfo": {"hasNextPage": True, "endCursor": "next-page"},
            "nodes": [{"number": 7, "reviewThreads": {
                "pageInfo": {"hasNextPage": True},
                "nodes": [{"comments": {"pageInfo": {"hasNextPage": True}}}],
            }}],
        }}}
        with mock.patch.object(collector, "run_gh", return_value=page) as api:
            report = collector.collect_repo("example/widgets", "author", "2026-01-01", 2)
        self.assertEqual(api.call_count, 2)
        self.assertIn("after=next-page", api.call_args_list[1].args[0])
        self.assertEqual(report["issueCount"], 100)
        self.assertTrue(any("2 search pages" in text for text in report["limitations"]))
        self.assertTrue(any("thread pagination" in text for text in report["limitations"]))
        self.assertTrue(any("comment pagination" in text for text in report["limitations"]))


if __name__ == "__main__":
    unittest.main()
