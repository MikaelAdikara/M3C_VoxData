"""Synthetic sealer-bead images for the st-04 camera model.

One image is the camera crop (ROI) of one seam: a grey e-coat panel with a panel
joint, covered by a sealer bead. Every pixel is a closed-form function of a small
parameter dict, and the noise comes from an integer hash, so the TypeScript twin in
lib/vision/beadsynth.ts renders the same picture from the same parameters (checked by
lib/vision/beadsynth.test.ts against ml/results/parity_fixture.json).

Defect types follow docs/SEED_DATA.md section 3. The "limit" severities below are our
own synthetic spec limits (the smallest deviation that counts as a defect); they are
assumptions for this prototype, not TMMIN standards.
"""
from __future__ import annotations

import math

import numpy as np

W, H = 256, 96

DEFECT_TYPES = ["missing", "break", "thin", "offset", "excess"]
DEFECT_IDS = {
    "missing": "BEAD_MISSING",
    "break": "BEAD_BREAK",
    "thin": "BEAD_THIN",
    "offset": "BEAD_OFFSET",
    "excess": "BEAD_EXCESS",
}
LEAK_CRITICAL = {"missing", "break"}


def seam_id(i: int) -> str:
    side = "L" if (i < 4 or 8 <= i < 12) else "R"
    part = "door" if i < 8 else "roof"
    return f"seam-{side}-{part}-{i + 1:02d}"


SEAM_IDS = [seam_id(i) for i in range(16)]


def seam_geometry(i: int) -> dict:
    """Fixed geometry of seam i (0..15): door seams curve, roof seams run straight and wide."""
    roof = i >= 8
    return {
        "width0": (12.0 if roof else 9.0) + (i % 4) * 0.75,
        "amp": (1.5 if roof else 6.0) + (i % 3) * 1.5,
        "period": (300.0 if roof else 170.0) + (i % 4) * 30.0,
        "phase": i * 0.9,
        "slope": ((i % 5) - 2) * 0.03,
        "panel": 0.40 + (i % 4) * 0.035,
    }


# ---------------------------------------------------------------- hash noise

M32 = 0xFFFFFFFF


def hash01(x: np.ndarray, y: np.ndarray, seed: int, k: int) -> np.ndarray:
    """Integer hash of (x, y, seed, k) mapped to [0, 1). Same bit operations as the TS twin."""
    x = x.astype(np.uint32)
    y = y.astype(np.uint32)
    h = (x * np.uint32(0x9E3779B1)) ^ (y * np.uint32(0x85EBCA77))
    h = h ^ np.uint32((seed * 0xC2B2AE3D) & M32) ^ np.uint32((k * 0x27D4EB2F) & M32)
    h = h ^ (h >> np.uint32(15))
    h = h * np.uint32(0x2C1B3C6D)
    h = h ^ (h >> np.uint32(12))
    h = h * np.uint32(0x297A2D39)
    h = h ^ (h >> np.uint32(15))
    return h.astype(np.float64) / 4294967296.0


def seed_phase(seed: int, k: int) -> float:
    return float(hash01(np.array([k]), np.array([7]), seed, 99)[0]) * 2.0 * math.pi


# ---------------------------------------------------------------- rendering

def _segment(xs: np.ndarray, x0: float, length: float, taper: float) -> np.ndarray:
    a = np.clip((xs - x0) / taper, 0.0, 1.0)
    b = np.clip((x0 + length - xs) / taper, 0.0, 1.0)
    return a * b


TAPER = {"missing": 1.0, "break": 1.0, "thin": 4.0, "offset": 8.0, "excess": 4.0}


def render(p: dict) -> np.ndarray:
    """Render parameters p to an H x W x 3 uint8 image."""
    g = seam_geometry(p["seam"])
    xs = np.arange(W, dtype=np.float64)
    ys = np.arange(H, dtype=np.float64)

    d = p.get("defect") or {"type": "none"}
    dtype = d["type"]
    t = _segment(xs, d["x0"], d["length"], TAPER[dtype]) if dtype != "none" else np.zeros(W)
    width_factor = np.ones(W)
    offset = np.zeros(W)
    if dtype in ("missing", "break"):
        width_factor = 1.0 - t
    elif dtype == "thin":
        width_factor = 1.0 - t * (1.0 - d["severity"])
    elif dtype == "excess":
        width_factor = 1.0 + t * (d["severity"] - 1.0)
    elif dtype == "offset":
        offset = t * d["severity"]

    p1, p2, p3 = seed_phase(p["seed"], 1), seed_phase(p["seed"], 2), seed_phase(p["seed"], 3)
    c0 = (H / 2 + p["shiftY"] + g["slope"] * (xs - W / 2)
          + g["amp"] * np.sin(2 * math.pi * (xs + p["shiftX"]) / g["period"] + g["phase"]))
    c = c0 + offset
    w = g["width0"] * p["widthScale"] * width_factor * (1.0 + 0.04 * np.sin(0.19 * xs + p3))
    half = w / 2

    Y = ys[:, None]
    X = xs[None, :]
    dy = Y - c[None, :]
    dist = np.abs(dy)
    hw = half[None, :]
    cov = np.clip(hw - dist + 0.5, 0.0, 1.0)
    safe = np.maximum(hw, 1e-3)
    r = np.clip(dist / safe, 0.0, 1.0)
    hgt = np.sqrt(1.0 - r * r)
    side = np.clip(dy / safe, -1.0, 1.0)
    bead = p["sealerTone"] * (0.72 + 0.28 * hgt) + 0.10 * np.exp(-((side - 0.45 * p["light"]) / 0.28) ** 2) * hgt

    panel = g["panel"] * (1.0 + p["gradX"] * (X / W - 0.5) * 2 + p["gradY"] * (Y / H - 0.5) * 2)
    panel = panel + 0.012 * np.sin(0.045 * X + p1) * np.sin(0.06 * Y + p2)
    panel = panel - 0.10 * np.exp(-(((Y - c0[None, :]) / 1.1) ** 2))
    edge = np.maximum(dist - hw, 0.0)
    panel = panel - 0.06 * np.exp(-((edge / 2.0) ** 2)) * np.minimum(hw / 2.0, 1.0)

    glare = np.zeros((H, W))
    if p.get("glare", 0.0) > 0:
        gx, gy, gr = p["glareX"], p["glareY"], p["glareR"]
        glare = p["glare"] * np.exp(-((X - gx) ** 2 + (Y - gy) ** 2) / (2 * gr * gr))

    out = np.empty((H, W, 3))
    xi = np.broadcast_to(np.arange(W)[None, :], (H, W))
    yi = np.broadcast_to(np.arange(H)[:, None], (H, W))
    panel_tint = (0.97, 0.99, 1.04)
    bead_tint = (1.02, 1.00, 0.95)
    s6 = math.sqrt(6.0)
    for ch in range(3):
        mix = panel * panel_tint[ch] * (1.0 - cov) + bead * bead_tint[ch] * cov
        u = hash01(xi, yi, p["seed"], 2 * ch) + hash01(xi, yi, p["seed"], 2 * ch + 1) - 1.0
        out[:, :, ch] = p["gain"] * mix + glare + u * p["noise"] * s6
    return np.clip(np.floor(out * 255.0 + 0.5), 0, 255).astype(np.uint8)


# ---------------------------------------------------------------- sampling

def limit_severity(dtype: str, seam: int) -> tuple[float, float]:
    """(length px, severity) at our synthetic spec limit for each defect type."""
    w0 = seam_geometry(seam)["width0"]
    return {
        "missing": (24.0, 0.0),
        "break": (4.0, 0.0),
        "thin": (20.0, 0.6),
        "offset": (30.0, 0.5 * w0 + 2.0),
        "excess": (15.0, 1.5),
    }[dtype]


def random_severity(rng: np.random.Generator, dtype: str, seam: int) -> tuple[float, float]:
    w0 = seam_geometry(seam)["width0"]
    if dtype == "missing":
        return rng.uniform(24, 90), 0.0
    if dtype == "break":
        return rng.uniform(4, 16), 0.0
    if dtype == "thin":
        return rng.uniform(20, 70), rng.uniform(0.35, 0.6)
    if dtype == "offset":
        sign = 1.0 if rng.random() < 0.5 else -1.0
        return rng.uniform(30, 80), sign * rng.uniform(0.5 * w0 + 2.0, 1.2 * w0)
    if dtype == "excess":
        return rng.uniform(15, 50), rng.uniform(1.5, 2.2)
    raise ValueError(dtype)


def sample_params(rng: np.random.Generator, seam: int, defect: str = "none", level: str = "random",
                  strong_glare: bool = False) -> dict:
    """Normal process variation (lighting, noise, registration, bead width), plus an optional defect."""
    p = {
        "seam": int(seam),
        "seed": int(rng.integers(1, 2**31 - 1)),
        "gain": float(rng.uniform(0.8, 1.2)),
        "gradX": float(rng.uniform(-0.15, 0.15)),
        "gradY": float(rng.uniform(-0.15, 0.15)),
        "light": float(rng.uniform(-1, 1)),
        "noise": float(rng.uniform(0.006, 0.025)),
        "shiftX": float(rng.uniform(-6, 6)),
        "shiftY": float(rng.uniform(-3, 3)),
        "widthScale": float(rng.uniform(0.93, 1.07)),
        "sealerTone": float(rng.uniform(0.78, 0.86)),
        "glare": 0.0, "glareX": 0.0, "glareY": 0.0, "glareR": 1.0,
        "defect": {"type": "none"},
    }
    if strong_glare:
        p.update(glare=float(rng.uniform(0.15, 0.30)), glareR=float(rng.uniform(6, 14)))
    elif rng.random() < 0.15:  # mild reflections are part of normal variation
        p.update(glare=float(rng.uniform(0.03, 0.08)), glareR=float(rng.uniform(4, 10)))
    if p["glare"] > 0:
        p.update(glareX=float(rng.uniform(10, W - 10)), glareY=float(rng.uniform(10, H - 10)))
    if defect != "none":
        length, sev = limit_severity(defect, seam) if level == "limit" else random_severity(rng, defect, seam)
        x0 = float(rng.uniform(20, W - 20 - length))
        p["defect"] = {"type": defect, "x0": x0, "length": float(length), "severity": float(sev)}
    return p


def render_batch(params: list[dict]) -> np.ndarray:
    return np.stack([render(p) for p in params])
