"""Python replica of finance/LearningLine_Financial_Model.xlsx (5-year NPV) for Monte Carlo and stage-gate analysis.
Validates against the workbook base case, then writes draft/viz/mc_data.json."""
import json, os, random, math

B = os.path.dirname(os.path.abspath(__file__))
os.makedirs(os.path.join(B, "results"), exist_ok=True)
YRS = list(range(2026, 2032))
INV = [3.0, 5.0, 19.0, 15.0, 7.0, 0.0]             # Investment sheet subtotals before contingency
PH1 = [3.0, 5.0, 0, 0, 0, 0]                       # Phase 1 share (2026-27)
RAMP = dict(QUAL=[0, .15, .45, .75, 1, 1], MAINT=[0, 0, .30, .70, 1, 1], NVA=[0, .10, .45, .75, 1, 1], FLEXR=[0, 0, 0, .5, 1, 1])
BASE = dict(CC=560, DR=.10, ESC=.04, S_Q=.08, R_Q=.25, S_M=.12, R_M=.10, COV_M=.60, S_L=.45, OP=.70, DT_OT=.05, R_DT=.23,
            NVA=.08, REAL=.70, MOD=30.0, R_MOD=.20, CONT=.15, OFIX=3.0, OFIX0=1.0, OVAR=.10, MB=1.0, MC=1.0, FLEX=1.0, RESID=1)


def shift(v, k):
    return [0] * k + v[:len(v) - k] if k else v


def npv(p=None, delay=0, levers=("Q", "M", "D", "L", "F"), inv=INV, stop_after_2027=False):
    """delay = years by which everything after the pilot slips (benefit ramps and Phase 2/3 spend)."""
    q = dict(BASE, **(p or {}))
    rq, rm, rn, rf = (shift(RAMP[k], delay) for k in ("QUAL", "MAINT", "NVA", "FLEXR"))
    invs = inv[:2] + shift(inv[2:], delay)[:4] if delay else list(inv)
    if stop_after_2027:
        invs = inv[:2] + [0] * 4
    cum, out = 0.0, 0.0
    for t, y in enumerate(YRS):
        e = (1 + q["ESC"]) ** t
        b = {"Q": q["CC"] * q["S_Q"] * q["R_Q"] * rq[t],
             "M": q["CC"] * q["S_M"] * q["R_M"] * q["COV_M"] * rm[t],
             "D": q["CC"] * q["S_L"] * q["OP"] * q["DT_OT"] * q["R_DT"] * rm[t] * e,
             "L": q["CC"] * q["S_L"] * q["OP"] * q["NVA"] * q["REAL"] * rn[t] * e,
             "F": q["MOD"] * q["R_MOD"] * rf[t] * q["FLEX"]}
        ben = q["MB"] * sum(b[k] for k in levers)
        if stop_after_2027 and t >= 2:
            ben = 0.0
        iv = invs[t] * (1 + q["CONT"])
        cum += iv
        fix = q["OFIX0"] if t == 0 else (q["OFIX"] if not (stop_after_2027 and t >= 2) else 0.0)
        var = q["OVAR"] * cum if not (stop_after_2027 and t >= 2) else 0.0
        resid = 0.0
        if t == 5 and q["RESID"] and not stop_after_2027:
            resid = sum(invs[j] * (1 + q["CONT"]) * max(0, 5 - (2031 - YRS[j])) / 5 for j in range(6))
        net = ben - fix - q["MC"] * var - q["MC"] * iv + q["MC"] * resid
        out += net / (1 + q["DR"]) ** t
    return out


def tri(a, m, b):
    return random.triangular(a, b, m)


DIST = {  # name: (key, low, mode, high, label)
    "S_Q": (.05, .08, .12, "Scrap + rework share"),
    "R_Q": (.15, .25, .35, "Quality cost reduction"),
    "S_L": (.35, .45, .55, "Labour share"),
    "REAL": (.40, .70, .90, "Freed time turned into cash"),
    "FLEX": (0.0, 1.0, 2.0, "Flexibility benefit (x plan)"),
    "MC": (.90, 1.0, 1.40, "Investment (x plan)"),
    "R_M": (.08, .10, .12, "Maintenance saving"),
    "S_M": (.08, .12, .16, "Maintenance share"),
    "R_DT": (.10, .23, .35, "Downtime reduction"),
    "NVA": (.05, .08, .10, "NVA reduction (pp)"),
}
P_DELAY = 0.30


def rank(v):
    o = sorted(range(len(v)), key=lambda i: v[i]); r = [0] * len(v)
    for k, i in enumerate(o):
        r[i] = k
    return r


def spearman(x, y):
    rx, ry = rank(x), rank(y); n = len(x); mx = (n - 1) / 2
    num = sum((a - mx) * (b - mx) for a, b in zip(rx, ry)); den = sum((a - mx) ** 2 for a in rx)
    return num / den


if __name__ == "__main__":
    base = npv()
    print("base NPV", round(base, 3), "(workbook 20.761)")
    assert abs(base - 20.761) < 0.01
    random.seed(2026)
    N = 10000
    draws = {k: [] for k in DIST}; dl = []; res = []
    for _ in range(N):
        p = {k: tri(a, m, b) for k, (a, m, b, _) in DIST.items()}
        d = 1 if random.random() < P_DELAY else 0
        for k in DIST:
            draws[k].append(p[k])
        dl.append(d); res.append(npv(p, delay=d))
    s = sorted(res)
    pct = lambda q: s[int(q * (N - 1))]
    corr = {DIST[k][3]: spearman(draws[k], res) for k in DIST}
    corr["One-year slip after the pilot (30% chance)"] = spearman(dl, res)
    # stage-gate tree
    fail_staged = npv(stop_after_2027=True, levers=())
    fail_allin = npv(levers=("M", "D", "F"))
    fix = npv(delay=1)
    out = dict(N=N, res=res, p10=pct(.10), p50=pct(.50), p90=pct(.90), mean=sum(res) / N,
               p_neg=sum(r < 0 for r in res) / N, corr=corr, base=base,
               delay_npv=fix, fail_staged=fail_staged, fail_allin=fail_allin,
               dist={DIST[k][3]: DIST[k][:3] for k in DIST}, p_delay=P_DELAY)
    json.dump(out, open(os.path.join(B, "results", "mc_data.json"), "w"), indent=0)
    print({k: round(v, 3) for k, v in out.items() if isinstance(v, float)})
    print({k: round(v, 2) for k, v in corr.items()})
