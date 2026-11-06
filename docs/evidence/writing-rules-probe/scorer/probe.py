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
from pathlib import Path

from prompts import BUILD, ITEMS, JUDGE, PAID_ITEMS, BATCH_JUDGE, READER, TASK

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
    # The approved amendment requires default for every new Codex call.
    return "default"


def active_calls(run):
    calls = load(run / "calls.json")
    replaced = {c["replaces"] for c in calls if "replaces" in c}
    return [c for c in calls if c["id"] not in replaced]


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
    for number, (b, attempt, arm) in enumerate(jobs, 1):
        call_id = f"p{number:02d}" if paid else f"{batch}-build-{b['id']}-{attempt}-{arm}"
        if any(c["id"] == call_id for c in load(run / "calls.json")):
            continue
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
        calls.append(reserve(run, call_id, "build", text,
                             "gpt-6.1-sol", brief=b["id"], attempt=attempt, arm=arm, batch=batch))
    return calls


def prepare_readers(run):
    calls = active_calls(run)
    out = []
    for build in calls:
        if build["kind"] != "build":
            continue
        if any(c.get("build") == build["id"] for c in calls if c["kind"] == "reader"):
            continue
        b = key()[build["brief"]]
        scenario = b["harderScenario" if build["batch"] in ("dry2", "paid") else "scenario"]
        text = READER.format(page=Path(build["reply"]).read_text(), **scenario)
        logical_id = build.get("replaces", build["id"])
        call_id = "r" + logical_id[1:] if build["batch"] == "paid" else build["id"].replace("-build-", "-reader-")
        out.append(reserve(run, call_id, "reader", text, "gpt-5.6-sol", build=build["id"],
                           brief=b["id"], batch=build["batch"], attempt=build["attempt"], arm=build["arm"]))
    return out


def scored_rows(run, batch):
    calls = active_calls(run)
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
    calls = active_calls(run)
    builds = {(c["brief"], c["attempt"], c["arm"]): c for c in calls
              if c["kind"] == "build" and c["batch"] == "paid"}
    expected = {(b, a, arm) for b in key() for a in range(1, 6) for arm in ARMS}
    if set(builds) != expected:
        raise ValueError("all sixty paid builds required before judges")
    briefs = {b["id"]: b for b in load(run / "briefs.json")["briefs"]}
    jobs = [(b, j, comparison) for b in key() for j in JUDGES for comparison in ("base", "vanilla")]
    random.Random(20261108).shuffle(jobs)
    out = []
    for number, (brief, judge, comparison) in enumerate(jobs, 1):
        call_id = f"j{number:02d}"
        if any(c["id"] == call_id for c in load(run / "calls.json")):
            continue
        pairs, labels = [], {}
        for attempt in range(1, 6):
            order = ["head", comparison]
            random.Random(f"20261108-{judge}-{brief}-{comparison}-{attempt}").shuffle(order)
            labels[str(attempt)] = dict(zip(("A", "B"), order))
            pages = [(label, Path(builds[brief, attempt, arm]["reply"]).read_text())
                     for label, arm in labels[str(attempt)].items()]
            pairs.append(f"PAIR q{attempt}\n" + "\n\n".join(
                f"<<<DRAFT {label}\n{page}\nDRAFT {label}>>>" for label, page in pages))
        b = briefs[brief]
        context = (b["brief"].split(" with ", 1)[0].removesuffix(" starting") +
                   ".\n" + json.dumps(b["harderScenario"]) + "\nSources:\n" +
                   "\n\n".join(x["name"] + "\n" + x["text"] for x in b["sources"]))
        prompt = BATCH_JUDGE.format(context=context, items="\n".join(f"{k}: {v}" for k, v in PAID_ITEMS.items()),
                                    pairs="\n\n".join(pairs))
        out.append(reserve(run, call_id, "judge", prompt, JUDGES[judge], batch="paid",
                           judge=judge, brief=brief, comparison=comparison, pairs=labels))
    return out


def majority_counts(votes, eligible, item, comparison):
    outcomes = []
    for brief in key():
        for attempt in range(1, 6):
            chosen = [v["preference"] for v in votes if v["judge"] in eligible and
                      (v["brief"], v["attempt"], v["item"], v["comparison"]) ==
                      (brief, attempt, item, comparison)]
            head = chosen.count("head") > len(eligible) / 2
            other = chosen.count(comparison) > len(eligible) / 2
            outcomes.append({"brief": brief, "attempt": attempt,
                             "outcome": "head" if head else comparison if other else "tie"})
    wins = sum(x["outcome"] == "head" for x in outcomes)
    losses = sum(x["outcome"] == comparison for x in outcomes)
    ties = len(outcomes) - wins - losses
    return {"wins": wins + .5 * ties, "headWins": wins, "comparisonWins": losses,
            "ties": ties, "pairs": len(outcomes), "outcomes": outcomes}


def decision(rows, votes, calibration):
    cells = {(b, a, arm) for b in key() for a in range(1, 6) for arm in ARMS}
    if len(rows) != 60 or {(r["brief"], r["attempt"], r["arm"]) for r in rows} != cells:
        raise ValueError("incomplete/duplicate paid reader cells; no verdict")
    vote_cells = {(b, a, j, item, comp) for b in key() for a in range(1, 6)
                  for j in JUDGES for item in PAID_ITEMS for comp in ("base", "vanilla")}
    actual = {(v["brief"], v["attempt"], v["judge"], v["item"], v["comparison"]) for v in votes}
    if len(votes) != len(vote_cells) or actual != vote_cells:
        raise ValueError("incomplete/duplicate judge votes; no verdict")
    counts = {}
    for item in PAID_ITEMS:
        calibration_item = {"R1": "entry", "R2": "path"}.get(item)
        eligible = [j for j in JUDGES if calibration_item is None or calibration[j][calibration_item]["eligible"]]
        if not eligible:
            raise ValueError("no eligible judges for " + item)
        counts[item] = {comp: majority_counts(votes, eligible, item, comp) for comp in ("base", "vanilla")}
    outcomes = {(r["brief"], r["attempt"], r["arm"]): int(r["pass"]) for r in rows}
    harm = {b: sum(outcomes[b, a, "head"] - outcomes[b, a, "base"] for a in range(1, 6)) for b in key()}
    no_harm = sum(harm.values()) >= -1 and all(d >= -1 for d in harm.values())
    control_wins = counts["C"]["base"]["wins"]
    rules = {}
    for item in ("R1", "R2"):
        base, vanilla = (counts[item][c]["wins"] for c in ("base", "vanilla"))
        specific = base - control_wins >= 4 and control_wins < 15
        rules[item] = {"baseWins": base, "vanillaWins": vanilla, "controlDifference": base - control_wins,
                       "specificityPass": specific,
                       "verdict": "supported" if base >= 15 and vanilla >= 15 and specific and no_harm else "not supported"}
    means = {arm: sum(r["words"] for r in rows if r["arm"] == arm) / 20 for arm in ARMS}
    return {"rules": rules, "counts": counts, "noHarm": no_harm, "briefDifferences": harm,
            "overallDifference": sum(harm.values()), "readerTotals": {
                arm: sum(r["pass"] for r in rows if r["arm"] == arm) for arm in ARMS},
            "meanWords": means, "lengthFlag": abs(means["head"] / means["base"] - 1) > .10,
            "controlBlocksBoth": control_wins >= 15}


def collect_votes(run):
    calls = active_calls(run)
    judges = [c for c in calls if c["kind"] == "judge" and c.get("batch") == "paid"]
    if len(judges) != 24:
        raise ValueError("twenty-four judge batches required")
    builds = {(c["brief"], c["attempt"], c["arm"]): Path(c["reply"]).read_text() for c in calls
              if c["kind"] == "build" and c["batch"] == "paid"}
    votes = []
    for call in judges:
        response = load(call["reply"])["pairs"]
        answers = {p["id"]: p for p in response}
        if set(answers) != {f"q{a}" for a in range(1, 6)} or len(response) != 5:
            raise ValueError("invalid judge pair ids: " + call["id"])
        for attempt in range(1, 6):
            labels = call["pairs"][str(attempt)]
            for item in PAID_ITEMS:
                answer = answers[f"q{attempt}"][item]
                preference = answer["preference"].strip()
                if preference not in ("A", "B", "tie"):
                    raise ValueError("invalid preference: " + call["id"])
                if not all(isinstance(answer[k], str) for k in ("A_quote", "B_quote", "reason")):
                    raise ValueError("invalid judge evidence schema: " + call["id"])
                grounded = {label: grounded_quote(answer[label + "_quote"], builds[call["brief"], attempt, arm])
                            for label, arm in labels.items()}
                votes.append({"brief": call["brief"], "attempt": attempt, "judge": call["judge"], "item": item,
                              "comparison": call["comparison"], "preference": labels.get(preference, "tie"),
                              "citationGrounded": grounded})
    return votes


def retry(run, call_id):
    ledger = load(run / "calls.json")
    call = next(c for c in active_calls(run) if c["id"] == call_id)
    if call.get("batch") != "paid":
        raise ValueError("only the approved paid stages have a spare")
    if Path(call["reply"]).exists() and not (run / "invalid" / (call_id + ".json")).exists():
        raise ValueError("response exists; record its schema failure before a retry")
    if any(c.get("replaces") and c["kind"] == call["kind"] for c in ledger):
        raise ValueError("stage spare already used; stop")
    metadata = {k: v for k, v in call.items() if k not in
                ("id", "kind", "model", "options", "prompt", "reply", "task")}
    metadata["replaces"] = call_id
    return reserve(run, call_id + "x", call["kind"], Path(call["prompt"]).read_text(), call["model"], **metadata)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("run", type=Path)
    parser.add_argument("stage", choices=("init", "calibration", "builds", "readers", "dry-score",
                                          "calibration-score", "paid-plan", "judges", "score", "retry"))
    parser.add_argument("call_id", nargs="?")
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
    elif stage == "retry":
        result = retry(run, args.call_id)
    else:
        result = decision(scored_rows(run, "paid"), collect_votes(run),
                          load(run / "calibration-summary.json"))
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
