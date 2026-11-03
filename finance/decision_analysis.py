"""Break-even thresholds per driver, correlated vs independent Monte Carlo, and the value of Gate 1 as an
information gate. Uses the validated replica in mc_model.py. Writes finance/results/da_data.json."""
import json, os, random
from mc_model import npv, DIST, BASE, P_DELAY

HERE = os.path.dirname(os.path.abspath(__file__))
os.makedirs(os.path.join(HERE, "results"), exist_ok=True)
base = npv()


def solve(key, lo, hi, it=60):
    """value of `key` where NPV = 0 (bisection), others at base."""
    f = lambda v: npv({key: v})
    a, b = lo, hi
    fa = f(a)
    for _ in range(it):
        m = (a + b) / 2
        if (f(m) > 0) == (fa > 0):
            a, fa = m, f(m)
        else:
            b = m
    return (a + b) / 2


BE = [("S_Q", "Scrap and rework share of conversion cost", .0, .08, "pct"),
      ("R_Q", "Quality cost reduction at run-rate", .0, .25, "pct"),
      ("REAL", "Freed operator time turned into cash", .0, .70, "pct"),
      ("S_L", "Labour share of conversion cost", .0, .45, "pct"),
      ("NVA", "Operator NVA reduction (pp)", .0, .08, "pp"),
      ("MC", "Investment versus plan", 1.0, 3.0, "x"),
      ("MB", "All benefits versus plan", .0, 1.0, "pct")]
be = []
for k, lab, lo, hi, u in BE:
    v = solve(k, lo, hi)
    be.append(dict(key=k, label=lab, base=BASE[k] if k != "MB" else 1.0, breakeven=v, unit=u))
    print(f"{lab:45s} base {BASE.get(k, 1):.3f}  break-even {v:.4f}")

# Monte Carlo: independent vs fully correlated (one quantile for all, oriented so low u = bad)
BAD_HIGH = {"MC"}
GATE_KEYS = ("S_Q", "R_Q", "NVA", "REAL")   # measured in the pilot / by finance before Gate 1
fail_staged = npv(stop_after_2027=True, levers=())


def tri_q(a, m, b, u):
    c = (m - a) / (b - a) if b > a else 0.5
    import math
    return a + math.sqrt(u * (b - a) * (m - a)) if u < c else b - math.sqrt((1 - u) * (b - a) * (b - m))


def run(correlated, n=10000, seed=2026):
    random.seed(seed)
    full, staged, stops = [], [], 0
    for _ in range(n):
        u0 = random.random()
        p = {}
        for k, (a, m, b, _) in DIST.items():
            u = u0 if correlated else random.random()
            if k in BAD_HIGH:
                u = 1 - u
            p[k] = tri_q(a, m, b, u)
        slip = (u0 < P_DELAY) if correlated else (random.random() < P_DELAY)
        d = 1 if slip else 0
        v = npv(p, delay=d)
        full.append(v)
        seen = npv({k: p[k] for k in GATE_KEYS}, delay=d)  # what Gate 1 can see; others at plan
        if seen < 0:
            staged.append(fail_staged); stops += 1
        else:
            staged.append(v)
    def summ(x):
        s = sorted(x); q = lambda f: s[int(f * (len(s) - 1))]
        neg = [min(0, v) for v in x]
        return dict(p10=q(.1), p50=q(.5), p90=q(.9), mean=sum(x) / len(x), p_pos=sum(v > 0 for v in x) / len(x),
                    exp_loss=-sum(neg) / len(x))
    return dict(full=summ(full), staged=summ(staged), stop_rate=stops / n, full_sorted=sorted(full)[::50], staged_sorted=sorted(staged)[::50])


res = {"independent": run(False), "correlated": run(True)}
for k, r in res.items():
    print(k, {kk: round(vv, 2) for kk, vv in r["full"].items()}, "| staged", {kk: round(vv, 2) for kk, vv in r["staged"].items()}, "| stop", r["stop_rate"])
json.dump(dict(base=base, breakeven=be, mc=res, fail_staged=fail_staged), open(os.path.join(HERE, "results", "da_data.json"), "w"), indent=0)
