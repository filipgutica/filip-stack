"""Boundary checks for failure modes that invalidated earlier writing studies."""
import copy
import unittest

from probe import command_meaning, decision, grounded_quote, key, score_reader


class ScoringTests(unittest.TestCase):
    def fixture(self, brief="H1", harder=False):
        items = key()[brief]["items"]["harderChecklist" if harder else "checklist"]
        steps = [{"action": "Any synonymous description", "command": i["command"],
                  "observe": i["observe"], "quote": i["command"]} for i in items]
        return "\n".join(i["command"] for i in items), {"steps": steps, "notStated": []}, items

    def test_plan_filename_is_preserved_across_the_entire_path(self):
        # Independent CLI invariant: renewal must use the file that preview actually created.
        for brief in key().values():
            for items in brief["items"].values():
                commands = {i["id"]: i["command"].split() for i in items}
                preview = commands["preview"]
                plan = preview[preview.index("--out") + 1]
                for action in ("inspect", "approve", "execute", "recover"):
                    if action in commands:
                        self.assertEqual(commands[action][-1], plan, (brief["id"], action))

    def test_complete_paths_and_alternative_independent_order(self):
        for brief in key():
            for harder in (False, True):
                page, reply, items = self.fixture(brief, harder)
                self.assertTrue(score_reader(page, reply, items)["pass"])
                start = 1 if harder else 0
                reply["steps"][start:start + 3] = reversed(reply["steps"][start:start + 3])
                self.assertTrue(score_reader(page, reply, items)["pass"])

    def test_missing_authentication_persistence_and_confirmation_fail(self):
        for missing in ("auth", "persist", "verify"):
            page, reply, items = self.fixture()
            reply["steps"] = [s for s, i in zip(reply["steps"], items) if i["id"] != missing]
            self.assertFalse(score_reader(page, reply, items)["pass"])

    def test_execution_before_approval_cannot_be_hidden_by_duplicate(self):
        page, reply, items = self.fixture()
        execute = next(s for s in reply["steps"] if "plan execute" in s["command"])
        reply["steps"].insert(0, copy.deepcopy(execute))
        self.assertFalse(score_reader(page, reply, items)["pass"])

    def test_acknowledgment_is_not_completion_and_citations_are_diagnostic(self):
        page, reply, items = self.fixture()
        reply["steps"][-1]["observe"] = {"submission": "accepted"}
        self.assertFalse(score_reader(page, reply, items)["pass"])
        page, reply, items = self.fixture()
        reply["steps"][0]["quote"] = "This is not on the page"
        result = score_reader(page, reply, items)
        self.assertTrue(result["pass"])
        self.assertFalse(result["items"][0]["citationGrounded"])
        self.assertFalse(score_reader(page.replace(items[0]["command"], ""), reply, items)["pass"])

    def test_semantic_syntax_and_number_words(self):
        self.assertEqual(command_meaning("tool preview --out x --days 90"),
                         command_meaning("tool preview --days=90 --out='x'"))
        page, reply, items = self.fixture("T1")
        for step in reply["steps"]:
            step["observe"] = {k: "six" if v == "6" else v for k, v in step["observe"].items()}
        self.assertTrue(score_reader(page, reply, items)["pass"])

    def test_citations_across_markdown_and_explicit_omissions(self):
        page = '1. Run `tool login`.\n2. Confirm ready.\n\n```zsh\ntool preview\n```\nInspect the plan.'
        self.assertTrue(grounded_quote('Run tool login. Confirm ready.', page))
        self.assertTrue(grounded_quote('Confirm ready. [...] Inspect the plan.', page))
        self.assertTrue(grounded_quote('tool preview Inspect the plan.', page))
        self.assertFalse(grounded_quote('Inspect the plan. [...] Confirm ready.', page))
        self.assertFalse(grounded_quote('Confirm authorized. [...] Inspect the plan.', page))
        self.assertFalse(grounded_quote('[...]', page))

    def test_literal_binary_gate_and_incomplete_data(self):
        rows = [{"brief": b, "attempt": a, "arm": arm, "pass": arm == "head", "words": 400}
                for b in key() for a in range(1, 6) for arm in ("base", "head", "vanilla")]
        calibration = {j: {item: {"eligible": True} for item in ("entry", "path")}
                       for j in ("astra", "sol61", "opus")}
        votes = [{"brief": b, "judge": j, "item": item, "preference": "head"}
                 for b in key() for j in calibration for item in ("entry", "path")]
        self.assertTrue(decision(rows, votes, calibration)["pass"])
        tutorial_only = [{**v, "preference": "tie" if v["brief"].startswith("H") else "head"}
                         for v in votes]
        self.assertFalse(decision(rows, tutorial_only, calibration)["supportedItems"]["path"])
        with self.assertRaises(ValueError):
            decision(rows[:-1], votes, calibration)
        rows[0]["pass"] = True  # One base success makes mean improvement < 1 task.
        self.assertFalse(decision(rows, votes, calibration)["pass"])


if __name__ == "__main__":
    unittest.main()
