# The Shield Simulator — UDC v12
> THE SHIELD — Underwater Data Center GIS Simulator

Single-file HTML5 tactical simulator สำหรับงานวิจัย Royal Thai Navy  
ครอบคลุมพื้นที่อ่าวไทยตอนบนและฐานทัพเรือสัตหีบ

---

## Current Version

**v12.7.0** — code cleanup + folder reorganization  
- `var → const` ทั่วไฟล์, ลบ MapTiler orphan references  
- เพิ่ม comment convention guide ใน file header  
- จัดโครงสร้าง folder ใหม่ (`data/`, `assets/`, `infrastructure/`, `docs/`, `scripts/`)

| Version | สิ่งสำคัญ |
|---------|-----------|
| v12.7.0 | Code cleanup + folder reorg |
| v12.6.6 | ZULU clock ย้ายเข้า header (sticky) |
| v12.6.5 | Layers & Tools panel ลง 60px จาก top |
| v12.6.4 | ลบ MapTiler mode ออก (3 modes → 2 modes) |
| v12.6.4a | Fix boot screen hang (missing `}` after MapTiler removal) |
| v11–v12 | 3D Dive, SVP acoustic model, time-replay |
| v10 | DEM offline cache, land elevation pre-baked |
| v09 | AIS WebSocket (AISStream.io) integration |

---

## Features

- **2D Map** (Leaflet 1.9) — multi-layer basemaps (Esri Ocean / GEBCO 2023),
  AIS live feed, reef/safety/fleet zones, SLOC, cable & landing infrastructure,
  patrol/survey assets, sonar-equation overlays
- **3D Dive** (Three.js r128) — DEM-driven terrain (offline cache),
  FFT ocean surface, acoustic ray tracing (4×9 = 36 rays, SVP-aware),
  shadow zones, UDC sensor model
- **Time-replay** — RAM ring buffer (≈ 1 h @ 10 s tick), draggable panel
- **AIS** — AISStream.io (WebSocket) + Kpler REST (via Cloudflare Worker proxy)
- **Nautical Chart** — 2-mode cycle: OFF → Esri Ocean → GEBCO 2023 → OFF
- **SVP / Sound Speed** — WOA23 annual profile สัตหีบ

---

## Repository Structure

```
01_Simulator/
├── UDC_Simulator_12.html     ← main simulator (single file, ~21,000 lines)
├── index.html                ← GitHub Pages entry point
├── README.md
├── .gitignore
│
├── data/
│   ├── gis/
│   │   ├── bathy_all.geojson              ← bathymetry รอบอ่าวไทยตอนบน
│   │   ├── bathy_sattahip_dmr.geojson     ← DMR bathymetric contours สัตหีบ
│   │   └── eec_region.geojson             ← EEC boundary (3 จังหวัด)
│   ├── dem/
│   │   ├── land_elevation_sattahip.json   ← local DEM cache (fallback offline)
│   │   └── cache/                         ← (gitignored) MapTiler Terrain-RGB tiles
│   └── ocean/
│       ├── svp_sattahip_annual.json       ← WOA23 annual SVP profile
│       ├── tl_grid.json                   ← transmission loss grid (metadata)
│       └── tl_grid.bin                    ← transmission loss grid (binary)
│
├── assets/
│   └── navy_logo.png                      ← boot-screen logo
│
├── infrastructure/
│   ├── cloudflare-worker-ais-proxy.js     ← Cloudflare Worker (Kpler proxy)
│   └── OpenApiSpec-AIS.json               ← AISStream.io API spec
│
├── docs/
│   └── UDC_Research_Summary.md            ← research context + decisions
│
└── scripts/
    └── tools/
        ├── build_tl_grid.py               ← สร้าง TL grid จาก SVP
        ├── fetch_svp_woa23.py             ← ดึง SVP data จาก WOA23
        └── rewrite_section_markers.py     ← utility: standardize section dividers
```

---

## Running

เปิดไฟล์ `UDC_Simulator_12.html` ใน browser ตรงๆ ได้เลย  
(ต้องต่อ internet สำหรับ tile layers + AIS WebSocket)

GitHub Pages: `https://mea09vi.github.io/the-shield-simulator/`

---

## API Keys

โค้ดที่ commit ไว้ใช้ **placeholder เท่านั้น** — ก่อนใช้งานจริงให้แก้ใน `UDC_Simulator_12.html`:

| ตัวแปร | สมัครฟรีที่ | ใช้ทำอะไร |
|--------|------------|-----------|
| `AIS_API_KEY` | https://aisstream.io/ | WebSocket AIS live feed |
| `KPLER_PROXY_URL` | self-host Cloudflare Worker | Kpler AIS REST proxy |

> **Kpler API key** เก็บเป็น secret ฝั่ง Cloudflare Worker เท่านั้น — ไม่อยู่ใน client code  
> ดูตัวอย่าง worker ที่ `infrastructure/cloudflare-worker-ais-proxy.js`

---

## Code Conventions

### Comment Style
```javascript
// ═══════════════════════════════════════  ← Major section
// ───────────────────────────────────────  ← Sub-section
[v09] / [v10] / [v11]    // "Added in version X" — historical marker
/* v12.x.x — desc */     // "Changed in v12.x.x" — inline change note
```

### Version Tagging
- Feature เพิ่มครั้งแรกใน version ไหน → tag `[vXX]` ไว้ใกล้ declaration
- การแก้ไขใน v12+ → `/* v12.x.x — สิ่งที่เปลี่ยน */` ต่อท้าย line ที่แก้

### Tech Stack
- **Leaflet 1.9** — 2D map engine
- **Three.js r128** — 3D Dive visualization
- **Chart.js 4.4.1** — SVP / TL graphs
- **AISStream.io** — WebSocket AIS feed
- **Cloudflare Worker** — Kpler API proxy (server-side key)
- **DEM data** — pre-baked offline (© MapTiler Terrain-RGB v2, decoded at v10)

---

## Architecture Decisions

| ข้อตัดสินใจ | เหตุผล |
|------------|--------|
| Single HTML file | GitHub Pages ไม่มี build step — deploy ง่าย, portable |
| Cloudflare Worker proxy | ซ่อน Kpler API key จาก client; CORS-safe |
| DEM pre-baked offline | MapTiler quota จำกัด; ใช้ฟรีไม่ได้ใน production |
| 2-mode nautical chart (Esri/GEBCO) | ลบ MapTiler tile layer ออก (v12.6.4) เพื่อไม่ใช้ API key ใน public repo |
| Leaflet ไม่ใช้ MapLibre | codebase เริ่มต้นด้วย Leaflet; 3D ใช้ Three.js แยก |

---

## License

For academic research only. © 2026 Royal Thai Naval Academy
