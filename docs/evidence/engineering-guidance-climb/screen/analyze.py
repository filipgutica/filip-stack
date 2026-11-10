"""Pre-registered analysis of the paired screen (prereg.md: Outcomes, Decision rule, Sensitivity).

Correctness and token ratios use PluginBench's own paired summary (task bootstrap, seed 0,
10,000 draws, 90% percentile interval). Judged preference follows the 4-vote pair rule.
Run after `judging-build.py`; the judged section waits for both judge tallies.

Usage: PYTHONPATH=<pluginbench src> python analyze.py
"""

import json
import random
from math import comb
import statistics
from pathlib import Path

from pluginbench.compare import _paired_summary, sign_test

HERE = Path(__file__).resolve().parent
RESULTS = HERE.parent / "results"
TUNED = {"adaptix-name-mapping-aliases", "csstree-shorthand-expansion-compression"}
PASSING = {"pass", "overlap_pass"}
CANDIDATE, AGAINST = "workflow-lean", "baseline"


def tokens() -> dict[tuple[str, str, str], float]:
    """Input plus output tokens per (run, task, arm), as the report's token metrics count them."""
    found = {}
    for run in ("screen", "screen-topup"):
        for path in (RESULTS / run / "evidence/records").glob("*.json"):
            record = json.loads(path.read_text())
            used = (record["stages"][0].get("work") or {}).get("tokens") or {}
            if isinstance(used.get("input_tokens"), int) and isinstance(used.get("output_tokens"), int):
                found[run, record["task_id"], record["arm"]] = used["input_tokens"] + used["output_tokens"]
    return found


def correctness(rows: list[dict]) -> dict:
    differences = {
        row["task"]: float(row["correctness"][CANDIDATE] in PASSING)
        - float(row["correctness"][AGAINST] in PASSING)
        for row in rows
    }
    summary = _paired_summary(differences, {})
    return {
        "tasks": len(differences),
        "pass_rate": {
            arm: sum(row["correctness"][arm] in PASSING for row in rows) / len(rows)
            for arm in (CANDIDATE, AGAINST)
        },
        "difference": summary.value,
        "interval_90": summary.interval,
        "sign_test_p": sign_test(list(differences.values())),
        "discordant": {task: value for task, value in differences.items() if value},
    }


def token_ratio(rows: list[dict], used: dict) -> dict:
    ratios, missing = {}, {}
    for row in rows:
        sides = [used.get((row["run"], row["task"], arm)) for arm in (CANDIDATE, AGAINST)]
        if None in sides or min(sides) <= 0:
            missing[row["task"]] = "missing token total"
            continue
        ratios[row["task"]] = sides[0] / sides[1]
    summary = _paired_summary(ratios, missing, ratio=True)
    return {"geomean_ratio": summary.value, "interval_90": summary.interval, "missing": missing}


def judged(rows: list[dict]) -> dict | None:
    """4 votes per judged pair; 3 of 4 wins it, anything else is 0.5 (prereg addition 6)."""
    votes: dict[str, list[str]] = {}
    for name in ("standard", "filip"):
        directory = HERE / "judging" / name
        key = json.loads((directory / "key.json").read_text())
        verdict_files = sorted(directory.glob("results/*/task-*.json"))
        if not verdict_files:
            return None
        for path in verdict_files:
            verdict = json.loads(path.read_text())
            folder = path.stem
            entry = key["tasks"].get(folder)
            if entry is None:
                continue
            preferred = verdict["pairs"][0]["preferred"]
            arm = "tie" if preferred == "tie" else entry["pairs"]["1"][preferred]["arm"]
            votes.setdefault(entry["task"], []).append(arm)
    wanted = {row["task"] for row in rows}
    votes = {task: cast for task, cast in votes.items() if task in wanted}
    if set(votes) != wanted:
        return {"error": f"no verdicts for {sorted(wanted - set(votes))}"}
    scores = {}
    for task, cast in votes.items():
        if len(cast) != 4:
            return {"error": f"{task} has {len(cast)} votes, expected 4"}
        lean = cast.count(CANDIDATE)
        vanilla = cast.count(AGAINST)
        scores[task] = 1.0 if lean >= 3 else 0.0 if vanilla >= 3 else 0.5
    values = [scores[task] for task in sorted(scores)]
    rng = random.Random(0)
    draws = sorted(statistics.mean(rng.choices(values, k=len(values))) for _ in range(10_000))
    decisive = [value for value in values if value != 0.5]
    wins = sum(value == 1.0 for value in decisive)
    n = len(decisive)
    p_one_sided = sum(comb(n, k) for k in range(wins, n + 1)) / 2**n if n else None
    return {
        "pairs": len(values),
        "mean_score": statistics.mean(values),
        "lower_bound_5pct": draws[499],
        "decisive": n,
        "candidate_wins": wins,
        "binomial_p_one_sided": p_one_sided,
        "votes": votes,
        "scores": scores,
    }


def main() -> None:
    admission = json.loads((HERE / "judging/admission.json").read_text())["tasks"]
    admitted = [row for row in admission if row["admitted"]]
    used = tokens()
    result = {}
    for label, rows in (
        ("all", admitted),
        ("without_tuned", [row for row in admitted if row["task"] not in TUNED]),
    ):
        result[label] = {
            "correctness": correctness(rows),
            "tokens": token_ratio(rows, used),
            "judged": judged([row for row in rows if row["judged"]]),
        }
    result["drops"] = {row["task"]: row["drop_reason"] for row in admission if not row["admitted"]}
    (HERE / "judging/analysis.json").write_text(json.dumps(result, indent=2, default=list))
    print(json.dumps({k: v for k, v in result.items()}, indent=1, default=list)[:4000])


if __name__ == "__main__":
    main()
