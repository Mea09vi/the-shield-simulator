#!/usr/bin/env python3
"""
build_tl_grid.py — Pure-Python ray tracer สำหรับ Gulf of Thailand shallow water

Input:
    svp_sattahip_annual.json  (จาก fetch_svp_woa23.py)

Output:
    tl_grid.bin   — Float32 array shape (n_src, n_freq, n_range, n_depth)
    tl_grid.json  — sidecar index (shape, axes, units, metadata)

Algorithm:
  1. Load c(z) จาก SVP → interpolate ลง fine depth grid (dz=0.5 m)
  2. ขยาย profile ลงไป max_depth (50 m) ด้วยค่าก้นทะเล (constant extrapolation)
  3. Ray launch: N=200 rays, angles −20°…+20° (linear)
  4. สำหรับแต่ละ (src_depth, freq):
       trace ray ทีละขั้น dr=10 m
       Snell's law ในชั้น constant-gradient
       เก็บพลังงาน intensity ใน grid cell ที่ ray ผ่าน
       MIN-aggregate TL (brightest path ชนะ)
  5. Spreading: 20 log10(R)  (spherical near-field)
     Absorption: Thorp formula (dB/km)
     Bottom bounce: −3 dB per bounce (sand/mud Gulf of Thailand)
     Surface bounce: pressure-release, ทำให้สูญเสีย ~0.5 dB (small)

Usage:
    python tools/build_tl_grid.py
    python tools/build_tl_grid.py --svp svp_sattahip_annual.json --out tl_grid
"""

import argparse
import json
import struct
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

# ── Default config ───────────────────────────────────────────────
DEF_SVP_PATH    = "svp_sattahip_annual.json"
DEF_OUT_STEM    = "tl_grid"
DEF_FREQS_HZ    = [5_000, 15_000, 30_000]   # 5/15/30 kHz
DEF_SRC_DEPTHS  = [5.0, 15.0, 25.0]          # m  (UDC sensor depths)
DEF_RANGE_MAX_M = 10_000.0                   # 10 km
DEF_DEPTH_MAX_M = 50.0                       # 50 m (Gulf is shallow)
DEF_DR_M        = 25.0                       # range bin
DEF_DZ_M        = 0.5                        # depth bin
DEF_N_RAYS      = 201                        # rays per fan (odd → ray 0°)
DEF_ANG_MAX_DEG = 20.0
DEF_RAY_DS_M    = 5.0                        # ray-march step
DEF_BOTTOM_LOSS_DB = 3.0
DEF_SURFACE_LOSS_DB = 0.5


# ── Acoustic helpers ─────────────────────────────────────────────
def thorp_alpha(f_hz):
    """Thorp absorption (dB/km).  f in kHz."""
    f = f_hz / 1000.0
    f2 = f * f
    return 0.11 * f2 / (1 + f2) + 44 * f2 / (4100 + f2) + 2.75e-4 * f2 + 0.003


def build_c_profile(svp_json, depth_grid):
    """Interpolate SVP onto fine depth grid; extrapolate constant below max sample."""
    z_in = np.array(svp_json["depths_m"], dtype=float)
    c_in = np.array(svp_json["sound_speed_ms"], dtype=float)
    # Linear interp, edge values for out-of-range
    c = np.interp(depth_grid, z_in, c_in, left=c_in[0], right=c_in[-1])
    return c


# ── Ray tracer ───────────────────────────────────────────────────
def trace_ray(theta0_rad, src_z, c_of_z, z_grid, max_depth, max_range,
              ds, surface_loss, bottom_loss):
    """Trace one ray.  Returns arrays (r, z, bounces) sampled at step ds.
    Uses Snell invariant cos(θ)/c = const; reflects at z=0 and z=max_depth.
    """
    # current state
    r = 0.0
    z = src_z
    theta = theta0_rad   # angle from horizontal, positive = downward
    n_steps = int(max_range / ds) + 1
    out_r = np.empty(n_steps)
    out_z = np.empty(n_steps)
    out_bnc = np.empty(n_steps)   # accumulated reflection loss in dB
    bnc_db = 0.0

    # Snell invariant at launch
    c0 = float(np.interp(src_z, z_grid, c_of_z))
    p = np.cos(theta) / c0   # ray parameter

    for k in range(n_steps):
        out_r[k] = r
        out_z[k] = z
        out_bnc[k] = bnc_db
        if r >= max_range:
            out_r = out_r[:k+1]; out_z = out_z[:k+1]; out_bnc = out_bnc[:k+1]
            break

        # sample c at current depth
        c = float(np.interp(np.clip(z, 0, max_depth), z_grid, c_of_z))
        # recover angle from Snell invariant (preserve sign of vertical motion)
        arg = p * c
        if arg > 1.0:   # turning point
            theta = 0.0
            # reverse vertical direction
            # easiest: flip sign via small perturbation
            # we'll handle by reflecting theta sign below
        else:
            theta_mag = np.arccos(min(1.0, max(-1.0, arg)))
            theta = np.sign(theta) * theta_mag if theta != 0 else theta_mag

        # advance by ds along ray
        dr = ds * np.cos(theta)
        dz = ds * np.sin(theta)
        r += dr
        z += dz

        # surface reflection
        if z < 0:
            z = -z
            theta = -theta
            bnc_db += surface_loss
        # bottom reflection
        if z > max_depth:
            z = 2 * max_depth - z
            theta = -theta
            bnc_db += bottom_loss

    return out_r, out_z, out_bnc


def trace_field(svp_json, src_depths, freqs_hz, range_max, depth_max,
                dr, dz, n_rays, ang_max_deg, ray_ds,
                surface_loss, bottom_loss):
    """Build TL grid for all (src_depth, freq) combos."""
    # Axes
    range_axis = np.arange(0, range_max + dr * 0.5, dr)
    depth_axis = np.arange(0, depth_max + dz * 0.5, dz)
    nR, nZ = len(range_axis), len(depth_axis)

    # Sound speed profile on fine grid
    z_fine = np.arange(0, depth_max + dz * 0.5, dz)
    c_fine = build_c_profile(svp_json, z_fine)

    # Launch angles
    angles = np.linspace(-ang_max_deg, ang_max_deg, n_rays) * np.pi / 180.0

    n_src = len(src_depths)
    n_f = len(freqs_hz)
    # TL stored as Float32; init to large value (≈ no signal)
    TL = np.full((n_src, n_f, nR, nZ), 200.0, dtype=np.float32)

    alpha = [thorp_alpha(f) for f in freqs_hz]   # dB/km

    print(f"  · Tracing  rays={n_rays}  src={n_src}  freqs={n_f}  "
          f"grid={nR}×{nZ}  (≈ {n_src*n_f*n_rays} rays)")

    t0 = time.time()
    for si, src_z in enumerate(src_depths):
        for ai, th0 in enumerate(angles):
            r_arr, z_arr, bnc_arr = trace_ray(
                th0, src_z, c_fine, z_fine, depth_max, range_max,
                ray_ds, surface_loss, bottom_loss)
            # arc length ≈ index * ray_ds  (since |step|=ds)
            for fi, f_hz in enumerate(freqs_hz):
                a_db_per_km = alpha[fi]
                for k in range(len(r_arr)):
                    R = (k * ray_ds)   # arc length
                    if R < 1.0:
                        continue
                    tl = 20.0 * np.log10(R) + a_db_per_km * R / 1000.0 + bnc_arr[k]
                    # map (r,z) → grid index
                    ri = int(r_arr[k] / dr + 0.5)
                    zi = int(z_arr[k] / dz + 0.5)
                    if 0 <= ri < nR and 0 <= zi < nZ:
                        if tl < TL[si, fi, ri, zi]:
                            TL[si, fi, ri, zi] = tl
        print(f"    src_z={src_z:5.1f} m  done  ({time.time()-t0:5.1f}s elapsed)")

    return TL, range_axis, depth_axis


# ── I/O ──────────────────────────────────────────────────────────
def save_outputs(TL, range_axis, depth_axis, src_depths, freqs_hz,
                 svp_json, stem: Path):
    bin_path  = stem.with_suffix(".bin")
    json_path = stem.with_suffix(".json")
    # binary: little-endian Float32, C-order
    TL.astype("<f4").tofile(bin_path)

    meta = {
        "format": "Float32 little-endian, C-order",
        "shape": list(TL.shape),
        "dims":  ["src_depth", "freq", "range", "depth"],
        "axes": {
            "src_depth_m": [float(x) for x in src_depths],
            "freq_hz":     [int(x) for x in freqs_hz],
            "range_m":     [float(x) for x in range_axis],
            "depth_m":     [float(x) for x in depth_axis],
        },
        "tl_range_db": [float(TL.min()), float(TL.max())],
        "svp_source":  svp_json.get("source", "?"),
        "svp_location": svp_json.get("location", {}),
        "generated_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "bin_file": bin_path.name,
        "notes": "TL=200 dB indicates shadow / no ray coverage. "
                 "Spreading=20log10(R), absorption=Thorp, "
                 "reflections=surface 0.5dB + bottom 3dB.",
    }
    json_path.write_text(json.dumps(meta, indent=2, ensure_ascii=False),
                         encoding="utf-8")
    return bin_path, json_path


def print_summary(TL, range_axis, depth_axis, src_depths, freqs_hz):
    print("\n  TL grid summary:")
    for si, sz in enumerate(src_depths):
        for fi, f in enumerate(freqs_hz):
            sub = TL[si, fi]
            covered = (sub < 200).sum()
            total = sub.size
            tl_min = sub.min()
            tl_p50 = np.percentile(sub[sub < 200], 50) if covered else float("nan")
            print(f"    src={sz:5.1f}m  f={f/1000:5.1f}kHz  "
                  f"cov={covered/total*100:5.1f}%  "
                  f"TL min={tl_min:6.1f}dB  median={tl_p50:6.1f}dB")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--svp", default=DEF_SVP_PATH)
    ap.add_argument("--out", default=DEF_OUT_STEM)
    ap.add_argument("--range-max", type=float, default=DEF_RANGE_MAX_M)
    ap.add_argument("--depth-max", type=float, default=DEF_DEPTH_MAX_M)
    ap.add_argument("--dr", type=float, default=DEF_DR_M)
    ap.add_argument("--dz", type=float, default=DEF_DZ_M)
    ap.add_argument("--n-rays", type=int, default=DEF_N_RAYS)
    ap.add_argument("--ang-max", type=float, default=DEF_ANG_MAX_DEG)
    ap.add_argument("--ray-ds", type=float, default=DEF_RAY_DS_M)
    args = ap.parse_args()

    root = Path(__file__).parent.parent
    svp_path = (root / args.svp) if not Path(args.svp).is_absolute() else Path(args.svp)
    out_stem = (root / args.out) if not Path(args.out).is_absolute() else Path(args.out)

    print(f"━━━ Building TL grid ━━━")
    print(f"  SVP:    {svp_path}")
    print(f"  Output: {out_stem}.bin / .json")

    svp_json = json.loads(svp_path.read_text(encoding="utf-8"))
    print(f"  · SVP loaded:  {len(svp_json['depths_m'])} levels, "
          f"c={min(svp_json['sound_speed_ms']):.1f}…"
          f"{max(svp_json['sound_speed_ms']):.1f} m/s")

    TL, ra, za = trace_field(
        svp_json, DEF_SRC_DEPTHS, DEF_FREQS_HZ,
        args.range_max, args.depth_max, args.dr, args.dz,
        args.n_rays, args.ang_max, args.ray_ds,
        DEF_SURFACE_LOSS_DB, DEF_BOTTOM_LOSS_DB)

    bin_path, json_path = save_outputs(
        TL, ra, za, DEF_SRC_DEPTHS, DEF_FREQS_HZ, svp_json, out_stem)

    print_summary(TL, ra, za, DEF_SRC_DEPTHS, DEF_FREQS_HZ)
    print(f"\n  ✓ wrote {bin_path.name}  "
          f"({bin_path.stat().st_size/1024:.1f} KB)")
    print(f"  ✓ wrote {json_path.name}  "
          f"({json_path.stat().st_size/1024:.1f} KB)")


if __name__ == "__main__":
    main()
