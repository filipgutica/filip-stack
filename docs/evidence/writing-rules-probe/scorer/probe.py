"""Prepare calls and score them locally; this module never calls a model or starts the paid run.

Usage: probe.py RUN {init,calibration,builds,readers,dry-score,calibration-score,paid-plan,judges,score}
Raw replies, full briefs, prompts, arm copies and dispatch reservations live in RUN only.
"""
import argparse
import hashlib
import json
import random
import re
import secrets
import shlex
from datetime import datetime, timezone
from pathlib import Path

from prompts import BUILD, ITEMS, JUDGE, READER, TASK

HERE = Path(__file__).resolve().parent
STUDY = HERE.parent
CAP = 171
ARMS = ("vanilla", "base", "head")
JUDGES = {"sol61": "gpt-6.1-sol", "astra": "gpt-6-astra", "opus": "claude-opus-5-5"}


def load(path):
    return json.loads(Path(path).read_text())


def save(path, data):
    Path(path).write_text(json.dumps(data, indent=2) + "\n")


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def normalize(text):
    text = re.sub(r"(?m)^\s*```[^\n]*$", "", str(text))
    text = re.sub(r"(?m)^\s*\d+[.)]\s+", "", text)
    return " ".join(text.replace("`", "").replace("’", "'").split()).casefold()


def grounded_quote(quote, page):
    """Markdown decoration is not content; explicit omissions must retain fragment order."""
    fragments = [normalize(p) for p in re.split(r"\[\.\.\.\]|…|\.\.\.", quote)]
    fragments = [p for p in fragments if p]
    remaining = normalize(page)
    if not fragments:
        return False
    for fragment in fragments:
        index = remaining.find(fragment)
        if index < 0:
            return False
        remaining = remaining[index + len(fragment):]
    return True


def command_meaning(command):
    """Interpret CLI syntax, not answer phrases: quoting, flag order and = forms are equivalent."""
    text = command.strip().removeprefix("$ ")
    if text.startswith("eval "):
        inner = re.fullmatch(r'''eval\s+["']?\$\((.*?)\)["']?''', text)
        if not inner:
            raise ValueError("unsupported shell activation")
        return ("activate-current-shell", command_meaning(inner[1]))
    tokens = shlex.split(text)
    positional, flags = [], {}
    i = 0
    while i < len(tokens):
        token = tokens[i]
        if token.startswith("--"):
            flag, equal, value = token.partition("=")
            if not equal and i + 1 < len(tokens) and not tokens[i + 1].startswith("-"):
                i += 1
                value = tokens[i]
            if flag in flags:
                raise ValueError("duplicate flag")
            flags[flag] = value or True
        else:
            positional.append(token)
        i += 1
    return tuple(positional), tuple(sorted(flags.items()))


def page_commands(page):
    """Read command syntax from Markdown code and bare command lines without judging prose."""
    candidates = re.findall(r"(?<!`)`([^`\n]+)`(?!`)", page)
    for block in re.findall(r"```[^\n]*\n(.*?)```", page, re.S):
        candidates.extend(block.splitlines())
    candidates.extend(line.strip().removeprefix("Run ").rstrip(".") for line in page.splitlines())
    meanings = set()
    for candidate in candidates:
        try:
            meanings.add(command_meaning(candidate))
        except ValueError:
            continue
    return meanings


def fact_value(value):
    aliases = {"three": "3", "six": "6", "eight": "8", "ninety": "90",
               "two hundred forty": "240", "non-empty": "nonempty", "populated": "nonempty"}
    value = normalize(value)
    return aliases.get(value, value)


def score_reader(page, reply, items):
    """A complete task needs every page-supported semantic action and valid prerequisite order.

    CLI identifiers are exact facts, not prose keys. Reader action prose is unrestricted.
    Field names/values describe observable state; number words and nonempty synonyms count.
    The first occurrence owns an action, preventing a late duplicate from hiding invalid order.
    """
    steps = reply["steps"]
    supported = page_commands(page)
    found, results = {}, []
    for item in items:
        expected = command_meaning(item["command"])
        candidates = []
        for index, step in enumerate(steps):
            try:
                if command_meaning(step["command"]) == expected:
                    candidates.append((index, step))
            except (ValueError, KeyError):
                continue
        reason, grounded = "missing action", False
        if candidates:
            index, step = candidates[0]
            quotes = step.get("quotes", [step.get("quote", "")])
            grounded = bool(quotes) and all(grounded_quote(q, page) for q in quotes)
            observed = step.get("observe", {})
            facts = all(k in observed and fact_value(observed[k]) == fact_value(v)
                        for k, v in item["observe"].items())
            ordered = all(dep in found and found[dep] < index for dep in item["after"])
            reason = "pass" if expected in supported and facts and ordered else (
                "command absent from page" if expected not in supported else
                "missing/wrong observation" if not facts else "prerequisite order")
            if reason == "pass":
                found[item["id"]] = index
        results.append({"item": item["id"], "pass": reason == "pass", "reason": reason,
                        "citationGrounded": grounded})
    return {"pass": all(r["pass"] for r in results), "items": results}


def tier():
    # 4pm fixed MST on the study date is 23:00 UTC, not daylight-saving Mountain time.
    return "priority" if datetime.now(timezone.utc) < datetime(2026, 11, 6, 23, tzinfo=timezone.utc) else "default"


def reserve(run, call_id, kind, prompt, model, **metadata):
    ledger = load(run / "calls.json")
    if any(c["id"] == call_id for c in ledger):
        raise ValueError(f"already reserved: {call_id}")
    if len(ledger) >= CAP:
        raise ValueError("call cap exhausted; stop")
    folder = run / secrets.token_hex(8)
    folder.mkdir()
    prompt_path, reply = folder / "prompt.txt", folder / "reply.txt"
    prompt_path.write_text(prompt)
    options = {"effort": "high"} if model.startswith("claude") else {
        "reasoningEffort": "low" if kind == "reader" else "high", "serviceTier": tier()}
    entry = {"id": call_id, "kind": kind, "model": model, "options": options,
             "prompt": str(prompt_path), "reply": str(reply), **metadata}
    entry["task"] = TASK.format(prompt=prompt_path, reply=reply)
    ledger.append(entry)
    save(run / "calls.json", ledger)
    return entry


def judge_prompt(pages):
    return JUDGE.format(items="\n".join(f"{k}: {v}" for k, v in ITEMS.items()),
                        pages="\n\n".join(f"<<<PAGE {label}\n{page}\nPAGE {label}>>>" for label, page in pages))


def key():
    return {b["id"]: b for b in load(HERE / "key.json")["briefs"]}


def initialize(run):
    inputs = load(STUDY / "inputs.json")
    for file, expected in [("briefs.json", inputs["briefsSha256"]), ("base.md", inputs["baseSha256"]),
                           ("head.md", inputs["headSha256"])]:
        if digest(run / file) != expected:
            raise ValueError(f"frozen input mismatch: {file}")
    if not (run / "calls.json").exists():
        save(run / "calls.json", [{"id": "writer", "kind": "writer", "model": "gpt-6.1-sol",
                                  "options": {"reasoningEffort": "high", "serviceTier": "priority"},
                                  "reply": str(run / "briefs.json")}])


def prepare_builds(run, paid=False):
    briefs = load(run / "briefs.json")["briefs"]
    selected = briefs if paid else [b for b in briefs if b["id"] in ("H1", "T1")]
    jobs = [(b, attempt, arm) for b in selected for attempt in range(1, 6 if paid else 3)
            for arm in (ARMS if paid else ("base",))]
    random.Random(20261106 + (1 if paid else 0)).shuffle(jobs)
    batch = "paid" if paid else "dry1"
    if not paid and any(c["id"].startswith("dry1-build") for c in load(run / "calls.json")):
        report = dry_score(run, "dry1")
        if report["passed"] / report["tasks"] <= .8:
            raise ValueError("dry1 is not above 80%; no harder rerun is authorized")
        batch = "dry2"
    harder = batch == "dry2" or (paid and (run / "dry2-summary.json").exists())
    calls = []
    for b, attempt, arm in jobs:
        folder = run / secrets.token_hex(8)
        folder.mkdir()
        guidance = folder / "guidance.md"
        guidance.write_text((run / f"{arm}.md").read_text())
        scenario = b["harderScenario" if harder else "scenario"]
        # Replace the original installed-machine scope when a fresh-machine rerun is required.
        brief = (b["brief"] if not harder else
                 b["brief"].split(" with ", 1)[0].removesuffix(" starting") +
                 f". Teach the same worked case described in the goal. Keep it under {b['wordLimit']} words.")
        brief += f"\nThe page must cover this starting state: {scenario['startingState']}\nGoal: {scenario['goal']}"
        text = BUILD.format(guidance=guidance, brief=brief, sources="\n\n".join(
            s["name"] + "\n" + s["text"] for s in b["sources"]))
        calls.append(reserve(run, f"{batch}-build-{b['id']}-{attempt}-{arm}", "build", text,
                             "gpt-6.1-sol", brief=b["id"], attempt=attempt, arm=arm, batch=batch))
    return calls


def prepare_readers(run):
    calls = load(run / "calls.json")
    out = []
    for build in calls:
        if build["kind"] != "build" or any(c["id"] == build["id"].replace("-build-", "-reader-") for c in calls):
            continue
        b = key()[build["brief"]]
        scenario = b["harderScenario" if build["batch"] == "dry2" or (
            build["batch"] == "paid" and (run / "dry2-summary.json").exists()) else "scenario"]
        text = READER.format(page=Path(build["reply"]).read_text(), **scenario)
        out.append(reserve(run, build["id"].replace("-build-", "-reader-"), "reader", text,
                           "gpt-5.6-sol", build=build["id"], brief=b["id"], batch=build["batch"],
                           attempt=build["attempt"], arm=build["arm"]))
    return out


def scored_rows(run, batch):
    calls = load(run / "calls.json")
    lookup = {c["id"]: c for c in calls}
    rows = []
    harder = batch == "dry2" or (batch == "paid" and (run / "dry2-summary.json").exists())
    for reader in calls:
        if reader["kind"] != "reader" or reader["batch"] != batch:
            continue
        build = lookup[reader["build"]]
        page = Path(build["reply"]).read_text()
        result = score_reader(page, load(reader["reply"]), key()[reader["brief"]]["items"][
            "harderChecklist" if harder else "checklist"])
        rows.append({"brief": reader["brief"], "attempt": reader["attempt"], "arm": reader["arm"],
                     "words": len(page.split()), **result})
    return rows


def dry_score(run, batch):
    rows = scored_rows(run, batch)
    if {(r["brief"], r["attempt"]) for r in rows} != {(b, a) for b in ("H1", "T1") for a in (1, 2)}:
        raise ValueError("incomplete dry run; all four tasks are required")
    report = {"batch": batch, "passed": sum(r["pass"] for r in rows), "tasks": len(rows), "rows": rows}
    save(run / f"{batch}-summary.json", report)
    return report


def prepare_calibration(run):
    corpus = load(run / "calibration.json")
    out = []
    for name, model in JUDGES.items():
        for page in corpus:
            variants = list(page["variants"].items())
            random.Random(f"20261106-{name}-{page['id']}").shuffle(variants)
            labels = {chr(65 + i): variant for i, (variant, _) in enumerate(variants)}
            out.append(reserve(run, f"calibration-{name}-{page['id']}", "calibration",
                               judge_prompt([(chr(65 + i), text) for i, (_, text) in enumerate(variants)]),
                               model, judge=name, exemplar=page["id"], labels=labels))
    return out


def calibration_score(run):
    corpus = {p["id"]: p for p in load(run / "calibration.json")}
    rates = {name: {item: {"caught": 0, "cleanFalseAlarms": 0, "eligible": False} for item in ITEMS}
             for name in JUDGES}
    calls = [c for c in load(run / "calls.json") if c["kind"] == "calibration"]
    if len(calls) != 6:
        raise ValueError("six calibration calls required")
    for call in calls:
        answers = {p["label"]: p for p in load(call["reply"])["pages"]}
        if set(answers) != set(call["labels"]) or len(answers) != len(load(call["reply"])["pages"]):
            raise ValueError("missing/duplicate calibration label")
        for item in ITEMS:
            rate = rates[call["judge"]][item]
            for label, variant in call["labels"].items():
                answer = answers[label][item]
                if not isinstance(answer["defect"], bool):
                    raise ValueError("defect must be boolean")
                if variant == "clean":
                    rate["cleanFalseAlarms"] += answer["defect"]
                elif variant == item:
                    text = corpus[call["exemplar"]]["variants"][variant]
                    rate["caught"] += bool(answer["defect"] and normalize(answer["quote"]) and
                                           normalize(answer["quote"]) in normalize(text))
    for by_item in rates.values():
        for rate in by_item.values():
            rate["eligible"] = rate["caught"] == 2 and rate["cleanFalseAlarms"] == 0
    save(run / "calibration-summary.json", rates)
    return rates


def prepare_judges(run):
    calls = load(run / "calls.json")
    out = []
    for brief in key():
        pages = {c["arm"]: Path(c["reply"]).read_text() for c in calls if c["kind"] == "build"
                 and c["batch"] == "paid" and c["brief"] == brief and c["attempt"] == 1}
        if set(pages) != set(ARMS):
            raise ValueError("all attempt-1 paid builds required before judges")
        for name, model in JUDGES.items():
            order = ["head", "base"]
            random.Random(f"20261106-{name}-{brief}").shuffle(order)
            out.append(reserve(run, f"judge-{name}-{brief}", "judge",
                               judge_prompt([(chr(65 + i), pages[arm]) for i, arm in enumerate(order)]),
                               model, judge=name, brief=brief, labels=dict(zip(("A", "B"), order))))
    return out


def decision(rows, votes, calibration):
    expected = {(b, a, arm) for b in key() for a in range(1, 6) for arm in ARMS}
    if len(rows) != 60 or {(r["brief"], r["attempt"], r["arm"]) for r in rows} != expected:
        raise ValueError("incomplete/duplicate paid cells; no verdict")
    outcomes = {(r["brief"], r["attempt"], r["arm"]): int(r["pass"]) for r in rows}
    comparisons = {}
    for arm in ("base", "vanilla"):
        diffs = [outcomes[b, a, "head"] - outcomes[b, a, arm] for b in key() for a in range(1, 6)]
        wins = sum(1 if d > 0 else .5 if d == 0 else 0 for d in diffs)
        comparisons[arm] = {"wins": wins, "meanDifference": sum(diffs) / 20,
                            "pass": wins >= 15 and sum(diffs) / 20 >= 1}
    harm = {b: sum(outcomes[b, a, "head"] - outcomes[b, a, "base"] for a in range(1, 6)) for b in key()}
    support, judge_gate = {}, {}
    for item in ITEMS:
        eligible = [j for j in JUDGES if calibration[j][item]["eligible"]]
        selected = [v for v in votes if v["item"] == item and v["judge"] in eligible]
        if {(v["judge"], v["brief"]) for v in selected} != {(j, b) for j in eligible for b in key()} or len(
                selected) != 4 * len(eligible):
            raise ValueError("incomplete/duplicate judge cells")
        # A base preference blocks; a rule needs at least one head preference to be supported.
        judge_gate[item] = bool(eligible) and not any(v["preference"] == "base" for v in selected)
        support[item] = judge_gate[item] and any(v["preference"] == "head" and (
            item != "path" or key()[v["brief"]]["type"] == "how-to") for v in selected)
    means = {arm: sum(r["words"] for r in rows if r["arm"] == arm) / 20 for arm in ARMS}
    return {"comparisons": comparisons, "noHarm": all(d >= -1 for d in harm.values()),
            "briefDifferences": harm, "supportedItems": support, "judgeGate": judge_gate, "meanWords": means,
            "lengthFlag": abs(means["head"] / means["base"] - 1) > .10,
            "pass": all(c["pass"] for c in comparisons.values()) and all(d >= -1 for d in harm.values())
                    and all(judge_gate.values())}


def collect_votes(run):
    calls = load(run / "calls.json")
    judges = [c for c in calls if c["kind"] == "judge"]
    if len(judges) != 12:
        raise ValueError("twelve judge calls required")
    pages = {(c["brief"], c["arm"]): Path(c["reply"]).read_text() for c in calls
             if c["kind"] == "build" and c["batch"] == "paid" and c["attempt"] == 1}
    votes = []
    for call in judges:
        response = load(call["reply"])["pages"]
        answers = {p["label"]: p for p in response}
        if set(answers) != {"A", "B"} or len(response) != 2:
            raise ValueError("invalid judge labels")
        by_arm = {arm: answers[label] for label, arm in call["labels"].items()}
        for item in ITEMS:
            for arm, answer in by_arm.items():
                finding = answer[item]
                if not isinstance(finding["defect"], bool):
                    raise ValueError("defect must be boolean")
                if finding["defect"] and not (normalize(finding["quote"]) and
                    normalize(finding["quote"]) in normalize(pages[call["brief"], arm])):
                    raise ValueError("ungrounded judge finding")
            head, base = (by_arm[arm][item]["defect"] for arm in ("head", "base"))
            preference = "tie" if head == base else "base" if head else "head"
            votes.append({"brief": call["brief"], "judge": call["judge"], "item": item,
                          "preference": preference})
    return votes


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("run", type=Path)
    parser.add_argument("stage", choices=("init", "calibration", "builds", "readers", "dry-score",
                                          "calibration-score", "paid-plan", "judges", "score"))
    args = parser.parse_args()
    run, stage = args.run.resolve(), args.stage
    if stage == "init":
        initialize(run)
        result = {"initialized": True, "cap": CAP}
    elif stage == "calibration":
        result = prepare_calibration(run)
    elif stage in ("builds", "paid-plan"):
        result = prepare_builds(run, paid=stage == "paid-plan")
    elif stage == "readers":
        result = prepare_readers(run)
    elif stage == "dry-score":
        batch = "dry2" if any(c.get("batch") == "dry2" for c in load(run / "calls.json")) else "dry1"
        result = dry_score(run, batch)
    elif stage == "calibration-score":
        result = calibration_score(run)
    elif stage == "judges":
        result = prepare_judges(run)
    else:
        result = decision(scored_rows(run, "paid"), collect_votes(run),
                          load(run / "calibration-summary.json"))
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
