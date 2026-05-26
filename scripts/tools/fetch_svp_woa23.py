#!/usr/bin/env python3
"""
fetch_svp_woa23.py — ดึง SVP (Sound Velocity Profile) สัตหีบจาก WOA23

ขั้นตอน:
  1. ดาวน์โหลด WOA23 annual climatology (T, S) เป็น netCDF
     - decav (1981-2010), 1° grid, all-time annual
     - แหล่ง: NCEI (NOAA) - https://www.ncei.noaa.gov/data/oceans/woa/WOA23/
  2. ดึง profile ที่ lat=12.5°N, lng=100.5°E (กลางอ่าวสัตหีบ)
     - ค่าจะ snap ไป grid cell ใกล้สุด
  3. คำนวณ sound speed c(z) ด้วย Mackenzie 1981
     - c = f(T, S, depth)
  4. Output: svp_sattahip.json (depths_m, temp_c, sal_psu, c_ms)

Usage:
    python tools/fetch_svp_woa23.py
    python tools/fetch_svp_woa23.py --lat 12.5 --lng 100.5 --season annual
    python tools/fetch_svp_woa23.py --season summer    # JJA สำหรับ Thailand
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import requests

# Windows console: force UTF-8 stdout (กัน UnicodeEncodeError บน cp1252)
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

try:
    import netCDF4
except ImportError:
    sys.exit("✗ ต้องติดตั้ง netCDF4 ก่อน: pip install netCDF4")

# ── Constants ──────────────────────────────────────────────────
# WOA23 file pattern: woa23_decav_{var}{period:02d}_{res}.nc
#   var: 't' = temperature, 's' = salinity
#   period: 00=annual, 13-16=seasonal (winter/spring/summer/fall),
#           01-12=monthly
#   res:    01 = 1° grid (small), 04 = 1/4° (large)
WOA_BASE = "https://www.ncei.noaa.gov/data/oceans/woa/WOA23/DATA"
PERIODS = {
    "annual": 0,
    "winter": 13,  # JFM
    "spring": 14,  # AMJ
    "summer": 15,  # JAS  ← มรสุมตะวันตกเฉียงใต้
    "fall":   16,  # OND
}
DEFAULT_LAT = 12.5    # กลางอ่าวสัตหีบ
DEFAULT_LNG = 100.5   # (ใกล้ play area แต่ลึกพอที่ WOA จะมีค่า)

CACHE_DIR = Path(__file__).parent / "_woa_cache"
CACHE_DIR.mkdir(exist_ok=True)


def woa_url(var: str, period_idx: int, res: str = "01") -> str:
    """สร้าง URL ของ WOA23 netCDF file
    var:    't' หรือ 's'
    res:    '01' (1°) หรือ '04' (1/4°)
    """
    folder = {"t": "temperature", "s": "salinity"}[var]
    fname = f"woa23_decav_{var}{period_idx:02d}_{res}.nc"
    return f"{WOA_BASE}/{folder}/netcdf/decav/1.00/{fname}"


def download(url: str, dest: Path, force: bool = False) -> Path:
    """ดาวน์โหลดถ้ายังไม่มี cache"""
    if dest.exists() and not force:
        size_mb = dest.stat().st_size / 1e6
        print(f"  ✓ cached: {dest.name} ({size_mb:.1f} MB)")
        return dest
    print(f"  ↓ downloading {url}")
    t0 = time.time()
    with requests.get(url, stream=True, timeout=120) as r:
        r.raise_for_status()
        total = int(r.headers.get("content-length", 0))
        downloaded = 0
        with open(dest, "wb") as f:
            for chunk in r.iter_content(chunk_size=64 * 1024):
                f.write(chunk)
                downloaded += len(chunk)
                if total:
                    pct = downloaded * 100 / total
                    print(f"\r    {downloaded/1e6:5.1f} / {total/1e6:5.1f} MB ({pct:5.1f}%)",
                          end="", flush=True)
        print(f"\n  ✓ saved {dest.name} in {time.time()-t0:.1f}s")
    return dest


def extract_profile(nc_path: Path, var_name: str, lat: float, lng: float,
                    max_search_deg: float = 3.0):
    """ดึง profile ที่ (lat, lng) จาก WOA netCDF — auto-search cell ใกล้สุดที่มีข้อมูล
    คืน (depths_m, values, (cell_lat, cell_lng)) — values อาจมี NaN ถ้าน้ำตื้น
    หมายเหตุ: netCDF4 บน Windows ไม่รองรับ path ภาษาไทย → อ่านเข้า memory
    """
    nc_bytes = nc_path.read_bytes()
    with netCDF4.Dataset("inmem.nc", memory=nc_bytes) as ds:
        lats = ds.variables["lat"][:]
        lngs = ds.variables["lon"][:]
        depths = ds.variables["depth"][:]
        v = ds.variables[var_name]
        fill = getattr(v, "_FillValue", None) or getattr(v, "missing_value", None)

        # หา cell ใกล้สุดก่อน
        i0 = int(np.argmin(np.abs(lats - lat)))
        j0 = int(np.argmin(np.abs(lngs - lng)))

        # spiral search หา cell ที่มี surface data
        # WOA 1° → step 1° ; 1/4° → step 0.25°
        step_la = float(np.abs(lats[1] - lats[0]))
        step_ln = float(np.abs(lngs[1] - lngs[0]))
        max_radius = max(1, int(round(max_search_deg / step_la)))

        best = None
        for r in range(0, max_radius + 1):
            candidates = []
            if r == 0:
                candidates = [(i0, j0)]
            else:
                for di in range(-r, r + 1):
                    for dj in range(-r, r + 1):
                        if max(abs(di), abs(dj)) == r:
                            candidates.append((i0 + di, j0 + dj))
            for i, j in candidates:
                if not (0 <= i < len(lats) and 0 <= j < len(lngs)):
                    continue
                prof = np.array(v[0, :, i, j])
                if fill is not None:
                    prof = np.where(prof == fill, np.nan, prof)
                if not np.isnan(prof[0]):   # surface มีค่า
                    best = (i, j, prof)
                    break
            if best:
                break

        if best is None:
            raise RuntimeError(f"ไม่พบ {var_name} ภายในรัศมี {max_search_deg}° "
                               f"จาก ({lat}, {lng})")
        i, j, prof = best
        cell_lat, cell_lng = float(lats[i]), float(lngs[j])
        dist = ((cell_lat - lat) ** 2 + (cell_lng - lng) ** 2) ** 0.5
        print(f"    grid cell: ({cell_lat:.2f}°N, {cell_lng:.2f}°E)  "
              f"[dist {dist:.2f}° from request]")

        return np.array(depths, dtype=float), prof, (cell_lat, cell_lng)


def mackenzie_sound_speed(T, S, D):
    """Mackenzie 1981 equation for seawater sound speed
        c = 1448.96 + 4.591T - 0.05304 T²  + 2.374e-4 T³
            + 1.340 (S-35) + 0.0163 D + 1.675e-7 D²
            - 0.01025 T (S-35) - 7.139e-13 T D³
    T:  °C        (range  -2 …  30 °C)
    S:  PSU       (range  25 …  40 PSU)
    D:  meters    (range   0 …  8000 m)
    Accuracy ±0.1 m/s in valid range.
    """
    T2 = T * T
    T3 = T2 * T
    D2 = D * D
    return (1448.96
            + 4.591 * T
            - 0.05304 * T2
            + 2.374e-4 * T3
            + 1.340 * (S - 35.0)
            + 0.0163 * D
            + 1.675e-7 * D2
            - 0.01025 * T * (S - 35.0)
            - 7.139e-13 * T * D * D2)


def build_svp(lat: float, lng: float, season: str, out_path: Path):
    period_idx = PERIODS[season]
    print(f"━━━ Fetching WOA23 {season} (period={period_idx:02d}) "
          f"@ ({lat}, {lng}) ━━━")

    t_url = woa_url("t", period_idx, "01")
    s_url = woa_url("s", period_idx, "01")
    t_nc  = download(t_url, CACHE_DIR / f"woa23_t{period_idx:02d}.nc")
    s_nc  = download(s_url, CACHE_DIR / f"woa23_s{period_idx:02d}.nc")

    print("  · extracting profiles…")
    depths_t, T_prof, cell = extract_profile(t_nc, "t_an", lat, lng)
    depths_s, S_prof, _    = extract_profile(s_nc, "s_an", lat, lng)
    assert np.allclose(depths_t, depths_s), "depth grids must match"
    depths = depths_t

    # ตัด levels ที่ต่ำกว่า seafloor (T หรือ S เป็น NaN)
    good = ~(np.isnan(T_prof) | np.isnan(S_prof))
    depths = depths[good]
    T_prof = T_prof[good]
    S_prof = S_prof[good]
    if len(depths) == 0:
        sys.exit("✗ ไม่มีข้อมูล WOA ที่จุดนี้ (อาจเป็นแผ่นดิน) — ลองเลือก lat/lng ใหม่")

    # คำนวณ c(z)
    c_prof = mackenzie_sound_speed(T_prof, S_prof, depths)

    print(f"  · valid depth levels: {len(depths)}  (max {depths[-1]:.0f} m)")
    print(f"    T:  {T_prof.min():.2f} … {T_prof.max():.2f} °C")
    print(f"    S:  {S_prof.min():.2f} … {S_prof.max():.2f} PSU")
    print(f"    c:  {c_prof.min():.1f} … {c_prof.max():.1f} m/s")

    out = {
        "location": {
            "lat": lat, "lng": lng,
            "name": "Sattahip / Upper Gulf of Thailand",
            "woa_cell_lat": cell[0], "woa_cell_lng": cell[1],
        },
        "source": f"WOA23 decav {season} 1° (NOAA NCEI)",
        "fetched_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "formula_c": "Mackenzie 1981",
        "depths_m":      [float(x) for x in depths],
        "temperature_c": [round(float(x), 4) for x in T_prof],
        "salinity_psu":  [round(float(x), 4) for x in S_prof],
        "sound_speed_ms":[round(float(x), 3) for x in c_prof],
    }
    out_path.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"  ✓ wrote {out_path}  ({out_path.stat().st_size/1024:.1f} KB)")
    return out


def print_ascii_chart(svp):
    """Mini ASCII chart ของ c(z) เพื่อตรวจตาเปล่า"""
    d = svp["depths_m"]
    c = svp["sound_speed_ms"]
    cmin, cmax = min(c), max(c)
    W = 40
    print("\n  c(z) profile:")
    print(f"    depth(m)  c(m/s)   {cmin:.1f} ─────────────── {cmax:.1f}")
    for di, ci in zip(d, c):
        frac = (ci - cmin) / (cmax - cmin) if cmax > cmin else 0
        bar = "█" * int(frac * W)
        print(f"    {di:6.1f}    {ci:7.2f}  {bar}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lat", type=float, default=DEFAULT_LAT)
    ap.add_argument("--lng", type=float, default=DEFAULT_LNG)
    ap.add_argument("--season", choices=list(PERIODS), default="annual")
    ap.add_argument("--out", default=None,
                    help="output JSON path (default: svp_sattahip_<season>.json)")
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args()

    out_name = args.out or f"svp_sattahip_{args.season}.json"
    out_path = Path(__file__).parent.parent / out_name

    svp = build_svp(args.lat, args.lng, args.season, out_path)
    if not args.quiet:
        print_ascii_chart(svp)


if __name__ == "__main__":
    main()
