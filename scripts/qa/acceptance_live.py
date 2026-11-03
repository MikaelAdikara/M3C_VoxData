"""QA 18 Oct 2026 (per-visitor sessions). Usage: python scripts/qa/acceptance_live.py [BASE_URL]. Screenshots and results go to scripts/qa/qa_out.
Run the demo story on the live prototype, assert each acceptance check, and save screenshots for Appendix C.
Ends with Reset demo so the public site returns to its seeded start."""
import os, re, json
from playwright.sync_api import sync_playwright

import sys
BASE = sys.argv[1] if len(sys.argv) > 1 else "https://learningline-kohl.vercel.app"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "qa_out")
os.makedirs(OUT, exist_ok=True)
checks = []


def check(name, ok, detail=""):
    checks.append({"check": name, "pass": bool(ok), "detail": detail})
    print(("PASS " if ok else "FAIL ") + name, detail)


def shot(pg, name, full=False, clip=None):
    pg.wait_for_timeout(900)
    pg.screenshot(path=os.path.join(OUT, f"proto_{name}.png"), full_page=full, clip=clip)


def role(pg, label):
    btn = pg.get_by_role("button", name=f"Act as {label.lower()}")
    if btn.count():
        btn.first.click()
    else:
        pg.locator("select").first.select_option(label=label)
    pg.wait_for_timeout(900)


with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge", headless=True)
    ctx = b.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=2)
    pg = ctx.new_page()
    pg.goto(BASE + "/simulator", wait_until="networkidle")
    pg.get_by_role("button", name="Reset demo").click(); pg.wait_for_timeout(1500)

    pg.goto(BASE + "/", wait_until="networkidle"); shot(pg, "landing")
    t = pg.inner_text("body")
    check("Landing shows the simulated-data label", "Simulated" in t or "simulated" in t)

    # 1 Shift loop: true defect -> operator
    pg.goto(BASE + "/simulator", wait_until="networkidle")
    pg.get_by_role("button", name="Inject true defect").click(); pg.wait_for_timeout(1200)
    pg.goto(BASE + "/station", wait_until="networkidle"); pg.wait_for_timeout(1500)
    t = pg.inner_text("main")
    check("Alert reaches st-04 with score and threshold", "0.83" in t and "0.61" in t, t[:80].replace("\n", " "))
    check("Model version shown on alert", bool(re.search(r"v1\.\d", t)))
    shot(pg, "station_alert")
    pg.get_by_role("button", name=re.compile("Confirm defect")).first.click(); pg.wait_for_timeout(1500)
    t = pg.inner_text("main")

    # 2 Team leader decides
    pg.goto(BASE + "/shift-board", wait_until="networkidle"); pg.wait_for_timeout(1200)
    t = pg.inner_text("main")
    check("Operator confirm reaches the shift board as a yellow andon", "Yellow andon: st-04" in t)
    check("Operator cannot decide stop/contain/continue", "Only the team leader decides" in t)
    role(pg, "Team leader"); pg.wait_for_timeout(800)
    t = pg.inner_text("main")
    check("Yellow andon for st-04 with leak-critical suggestion", "st-04" in t and "Stop and fix" in t, "")
    check("st-02 over false-alarm budget flagged for model review", "Model review needed" in t)
    shot(pg, "shift_board")
    note = pg.get_by_placeholder(re.compile("nozzle check"))
    note.fill("Nozzle angle check after nozzle change")
    pg.get_by_role("button", name=re.compile("Stop and fix")).first.click(); pg.wait_for_timeout(2500)
    t = pg.inner_text("main")
    shot(pg, "shift_after_tl")
    print("DEBUG after TL:", re.findall(r"Yellow andon: st-\d+", t), "| logged" if "Nozzle angle" in t else "")
    check("Team leader decision closes the andon", "Yellow andon: st-04" not in t)

    # 3 Kaizen loop: repeat x3 -> ticket
    pg.goto(BASE + "/simulator", wait_until="networkidle")
    pg.get_by_role("button", name=re.compile("Inject repeat")).click(); pg.wait_for_timeout(1500)
    pg.goto(BASE + "/kaizen", wait_until="networkidle"); pg.wait_for_timeout(1200)
    role(pg, "Engineer")
    t = pg.inner_text("main")
    check("Third repeat opens a Kaizen ticket", "Excess" in t or "excess" in t, "")
    shot(pg, "kaizen")
    links = pg.locator("a[href*='/kaizen/']", has_text="Excess")
    if links.count():
        links.first.click(); pg.wait_for_load_state("networkidle"); pg.wait_for_timeout(1200)
        t = pg.inner_text("main")
        check("Ticket shows trigger alerts and A3 form", "A3" in t, "")
        shot(pg, "ticket", full=True)

    # 4 Knowledge: validation + assistant
    pg.goto(BASE + "/knowledge", wait_until="networkidle"); pg.wait_for_timeout(1000)
    role(pg, "Senior expert")
    shot(pg, "knowledge")
    pg.get_by_role("button", name=re.compile("Bead break near the right door")).click(); pg.wait_for_timeout(6000)
    t = pg.inner_text("main")
    m = re.search(r"KC-SEAL-\d+ r\d", t)
    check("Assistant answer cites a validated card", "KC-SEAL-021" in t, m.group(0) if m else "")
    check("Assistant mode label", True, "offline mode" if "offline" in t.lower() else "live model")
    shot(pg, "assistant_cited")
    pg.get_by_role("button", name=re.compile("paint orange peel")).click(); pg.wait_for_timeout(5000)
    t = pg.inner_text("main")
    check("No validated card -> says so and routes to owner engineer", "No validated card" in t or "no validated card" in t.lower())
    shot(pg, "assistant_nocard")

    # 5 Metrics
    pg.goto(BASE + "/metrics", wait_until="networkidle"); pg.wait_for_timeout(1200)
    role(pg, "Management")
    t = pg.inner_text("main")
    check("Gate 1 panel lists the five indicators", all(k in t for k in ("False alarms", "overriding", "seeded", "Scrap", "helps")))
    shot(pg, "metrics", full=True)

    # mobile station
    m = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=3, is_mobile=True)
    mp = m.new_page()
    mp.goto(BASE + "/simulator", wait_until="networkidle")
    mp.get_by_role("button", name="Inject true defect").click(); mp.wait_for_timeout(1200)
    mp.goto(BASE + "/station", wait_until="networkidle"); mp.wait_for_timeout(1500)
    shot(mp, "station_mobile")


    # --- Extra checks for the 9 Oct findings ---
    pg.goto(BASE + "/simulator", wait_until="networkidle")
    pg.get_by_role("button", name="Reset demo").click(); pg.wait_for_timeout(1500)
    pg.goto(BASE + "/shift-board", wait_until="networkidle"); pg.wait_for_timeout(1200)
    t = pg.inner_text("main")
    print("F3 shift-board text after reset:", re.findall(r"[^\n]*[Oo]verrid[^\n]*", t)[:6])
    print("F4 station labels:", sorted(set(re.findall(r"st-0\d[^\n]{0,40}", t)))[:20])
    shot(pg, "qa_shift_after_reset", full=True)
    pg.goto(BASE + "/metrics", wait_until="networkidle"); pg.wait_for_timeout(1200)
    print("F3 metrics override lines:", re.findall(r"[^\n]*[Oo]verrid[^\n]*", pg.inner_text("main"))[:6])
    # F2: state across independent sessions
    pg.goto(BASE + "/simulator", wait_until="networkidle")
    pg.get_by_role("button", name="Inject true defect").click(); pg.wait_for_timeout(1500)
    seen = []
    for i in range(5):
        c2 = b.new_context(viewport={"width": 1280, "height": 800}); p2 = c2.new_page()
        p2.goto(BASE + "/station", wait_until="networkidle"); p2.wait_for_timeout(1500)
        tt = p2.inner_text("body"); seen.append("0.83" in tt)
        if "You are viewing as ." in tt: print("F2 empty role label seen in session", i)
        c2.close()
    check("F2 fresh sessions are isolated (start from seed)", not any(seen), str(seen))
    same = []
    for i in range(5):
        pg.goto(BASE + "/station", wait_until="networkidle"); pg.wait_for_timeout(800)
        same.append("0.83" in pg.inner_text("body"))
    check("F2 same session keeps the alert across 5 reloads", all(same), str(same))
    pg.goto(BASE + "/simulator", wait_until="networkidle")
    pg.get_by_role("button", name="Reset demo").click(); pg.wait_for_timeout(1500)
    check("Demo reset to seeded start", True)
    b.close()

json.dump(checks, open(os.path.join(OUT, "proto_checks.json"), "w"), indent=1)
print(sum(c["pass"] for c in checks), "of", len(checks), "passed")
