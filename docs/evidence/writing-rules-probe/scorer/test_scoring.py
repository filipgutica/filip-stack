"""Boundary checks for failure modes that invalidated earlier writing studies."""
import copy
import unittest
import json
import re
import tempfile
from pathlib import Path

from probe import command_meaning, decision, grounded_quote, key, score_reader, prepare_builds, reserve


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

    def experiment(self, targets=None):
        targets = targets or {"R1": 15, "R2": 16, "C": 12}
        rows = [{"brief": b, "attempt": a, "arm": arm, "pass": True, "words": 400}
                for b in key() for a in range(1, 6) for arm in ("base", "head", "vanilla")]
        calibration = {j: {item: {"eligible": True} for item in ("entry", "path")}
                       for j in ("astra", "sol61", "opus")}
        votes = [{"brief": b, "attempt": a, "judge": j, "item": item, "comparison": comp,
                  "preference": "head" if index < targets[item] else comp}
                 for index, (b, a) in enumerate((b, a) for b in key() for a in range(1, 6))
                 for j in calibration for item in targets for comp in ("base", "vanilla")]
        return rows, votes, calibration

    def test_per_rule_specificity_with_no_reader_gain(self):
        rows, votes, calibration = self.experiment()
        result = decision(rows, votes, calibration)
        self.assertTrue(result["noHarm"])
        self.assertEqual(result["rules"]["R1"]["baseWins"], 15)
        self.assertEqual(result["rules"]["R1"]["controlDifference"], 3)
        self.assertEqual(result["rules"]["R1"]["verdict"], "not supported")
        self.assertEqual(result["rules"]["R2"]["controlDifference"], 4)
        self.assertEqual(result["rules"]["R2"]["verdict"], "supported")

    def test_majority_ties_count_half(self):
        rows, votes, calibration = self.experiment({"R1": 10, "R2": 10, "C": 11})
        for vote in votes:
            if vote["item"] != "C" and vote["preference"] != "head":
                vote["preference"] = {"astra": "head", "sol61": vote["comparison"], "opus": "tie"}[vote["judge"]]
        result = decision(rows, votes, calibration)
        for rule in ("R1", "R2"):
            self.assertEqual(result["counts"][rule]["base"]["ties"], 10)
            self.assertEqual(result["counts"][rule]["base"]["wins"], 15)
            self.assertEqual(result["rules"][rule]["verdict"], "supported")

    def test_control_fifteen_blocks_both_and_vanilla_is_required(self):
        rows, votes, calibration = self.experiment({"R1": 20, "R2": 20, "C": 15})
        result = decision(rows, votes, calibration)
        self.assertTrue(result["controlBlocksBoth"])
        self.assertTrue(all(r["verdict"] == "not supported" for r in result["rules"].values()))
        rows, votes, calibration = self.experiment({"R1": 20, "R2": 20, "C": 0})
        for vote in votes:
            if vote["comparison"] == "vanilla" and (vote["brief"], vote["attempt"]) in {
                    ("T1", 5), *(('T2', a) for a in range(1, 6))}:
                vote["preference"] = "vanilla"
        result = decision(rows, votes, calibration)
        self.assertEqual(result["rules"]["R1"]["vanillaWins"], 14)
        self.assertEqual(result["rules"]["R1"]["verdict"], "not supported")

    def test_no_harm_needs_overall_and_each_brief(self):
        rows, votes, calibration = self.experiment({"R1": 20, "R2": 20, "C": 0})
        for row in rows:
            if (row["brief"], row["arm"]) in (("H1", "head"), ("H2", "base")) and row["attempt"] <= 2:
                row["pass"] = False
        result = decision(rows, votes, calibration)
        self.assertEqual(result["overallDifference"], 0)
        self.assertFalse(result["noHarm"])
        rows, votes, calibration = self.experiment({"R1": 20, "R2": 20, "C": 0})
        for row in rows:
            if row["arm"] == "head" and row["attempt"] == 1:
                row["pass"] = False
        result = decision(rows, votes, calibration)
        self.assertTrue(all(x == -1 for x in result["briefDifferences"].values()))
        self.assertFalse(result["noHarm"])

    def test_incomplete_or_duplicate_cells_have_no_verdict(self):
        rows, votes, calibration = self.experiment()
        for r, v in ((rows[:-1], votes), (rows, votes[:-1]), (rows, votes[:-1] + votes[:1])):
            with self.assertRaises(ValueError):
                decision(r, v, calibration)

    def test_paid_dispatches_are_neutral_and_default_tier(self):
        with tempfile.TemporaryDirectory() as folder:
            run = Path(folder)
            (run / "calls.json").write_text("[]")
            (run / "briefs.json").write_text(json.dumps({"briefs": [
                {"id": b, "type": "how-to", "wordLimit": 400, "brief": "Write a guide with one example.",
                 "harderScenario": {"startingState": "New machine", "goal": "Finish the example"},
                 "sources": [{"name": "Manual", "text": "Use the fictional CLI."}]} for b in key()]}))
            (run / "dry2-summary.json").write_text("{}")
            for arm, text in (("head", "Sentence A"), ("base", "Sentence B"), ("vanilla", "")):
                (run / (arm + ".md")).write_text(text)
            calls = prepare_builds(run, paid=True)
            self.assertEqual(len(calls), 60)
            self.assertEqual(len({(c['brief'], c['attempt'], c['arm']) for c in calls}), 60)
            for call in calls:
                self.assertRegex(call["id"], r"^p[0-9]{2}$")
                self.assertEqual(call["options"]["serviceTier"], "default")
                for visible in (call["task"], call["prompt"], call["reply"], Path(call["prompt"]).read_text()):
                    self.assertIsNone(re.search(r"\b(head|base|vanilla)\b", visible, re.I))
            self.assertEqual(prepare_builds(run, paid=True), [])
            (run / "calls.json").write_text(json.dumps([{"id": str(i)} for i in range(171)]))
            with self.assertRaises(ValueError):
                reserve(run, "p61", "build", "text", "gpt-6.1-sol")


if __name__ == "__main__":
    unittest.main()
