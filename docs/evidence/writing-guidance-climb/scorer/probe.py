# Apply the probe's pre-registered decision rule (../prereg.md). Usage: probe.py <run>
# Versions in <run>/ledger.json: vanilla, base, head. A pair is one brief and one attempt index.
import math, sys
from climb import task_rows

MIN_WINS, MIN_DIFF = 15, 1.0


def pair_scores(run, version):
    out = {}
    for r in task_rows(run, version):
        out.setdefault((r['brief'], r['attempt']), []).append(r)
    return {k: (100 * sum(x['score'] for x in v) / len(v), sum(x['pass'] for x in v), v[0]['words']) for k, v in out.items()}


def sign_p(wins, n):
    """One-sided sign test, P(X >= wins) for X ~ Binomial(n, 0.5). Half wins round down."""
    k = math.floor(wins)
    return sum(math.comb(n, i) for i in range(k, n + 1)) / 2 ** n


def wilson(k, n, z=1.96):
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return c - h, c + h


def compare(head, other, label):
    keys = sorted(set(head) & set(other))
    wins, diffs, by_brief = 0.0, [], {}
    for k in keys:
        d = head[k][0] - other[k][0]
        w = 1.0 if d > 0 else 0.5 if d == 0 else 0.0
        wins += w
        diffs.append(d)
        by_brief.setdefault(k[0], []).append(w)
    mean = sum(diffs) / len(diffs)
    ok = wins >= MIN_WINS and mean >= MIN_DIFF
    print(f'head vs {label}: {wins:g}/{len(keys)} wins, mean diff {mean:+.2f}, sign p {sign_p(wins, len(keys)):.3f} -> {"PASS" if ok else "FAIL"}')
    brief_wins = {b: (sum(v), len(v)) for b, v in by_brief.items()}
    print('  wins per brief: ' + ', '.join(f'{b} {w:g}/{n}' for b, (w, n) in brief_wins.items()))
    return ok, brief_wins


def main(run):
    v = {name: pair_scores(run, name) for name in ('vanilla', 'base', 'head')}
    for name, ps in v.items():
        passed, n = sum(x[1] for x in ps.values()), 5 * len(ps)
        lo, hi = wilson(passed, n)
        print(f'{name}: pairs {len(ps)}, score {sum(x[0] for x in ps.values()) / len(ps):.2f}, '
              f'tasks {passed}/{n} (95% {lo:.2f}-{hi:.2f}), mean words {sum(x[2] for x in ps.values()) / len(ps):.0f}')
    r1, wins_base = compare(v['head'], v['base'], 'base')
    r2, _ = compare(v['head'], v['vanilla'], 'vanilla')
    head_pass, base_pass = sum(x[1] for x in v['head'].values()), sum(x[1] for x in v['base'].values())
    per_brief = {}
    for (b, _), x in v['head'].items():
        per_brief.setdefault(b, [0, 0])[0] += x[1]
    for (b, _), x in v['base'].items():
        per_brief.setdefault(b, [0, 0])[1] += x[1]
    r3 = head_pass >= base_pass - 1 and all(h >= bp - 1 for h, bp in per_brief.values())
    print(f'no harm: head {head_pass} vs base {base_pass} tasks; per brief ' +
          ', '.join(f'{b} {h}/{bp}' for b, (h, bp) in per_brief.items()) + f' -> {"PASS" if r3 else "FAIL"}')
    hw = sum(x[2] for x in v['head'].values()) / len(v['head'])
    bw = sum(x[2] for x in v['base'].values()) / len(v['base'])
    print(f'flag length: head {hw:.0f} vs base {bw:.0f} words' + (' -> FLAG' if hw < 0.9 * bw else ''))
    won = sum(1 for w, n in wins_base.values() if w > n / 2)  # a brief counts as won when head wins most of its pairs
    print(f'flag brief-only win: head beats base on {won}/4 briefs' + (' -> FLAG' if won < 3 else ''))
    print('DECISION RULE: ' + ('PASS' if r1 and r2 and r3 else 'FAIL'))


if __name__ == '__main__':
    main(sys.argv[1])
