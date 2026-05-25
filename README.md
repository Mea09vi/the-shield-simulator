# The Shield Simulator — UDC v10
> THE SHIELD 1.0 — Underwater Data Center GIS Simulator

Single-file HTML5 tactical simulator สำหรับงานวิจัย Royal Thai Navy
(Underwater Detection & Coastal surveillance) ครอบคลุมพื้นที่อ่าวไทยตอนบน
และฐานทัพเรือสัตหีบ

## Features

- **2D Map** (Leaflet 1.9) — multi-layer base maps, AIS live feed,
  reef/safety/fleet zones, SLOC, cable & landing infrastructure,
  patrol/survey assets, terrain-shadow + sonar-equation overlays
- **3D Dive** (Three.js r128) — DEM-driven terrain (MapTiler Terrain-RGB),
  FFT ocean surface, acoustic ray tracing (4×9 = 36 rays, SVP-aware),
  shadow zones, UDC sensor model
- **Time-replay** — RAM ring buffer (≈ 1 h @ 10 s tick), draggable panel
- **AIS** — AISStream.io (WebSocket) + Kpler REST (via Cloudflare Worker proxy)

## Running

เปิดไฟล์ `UDC_Simulator_10.html` ใน browser ตรง ๆ ได้เลย
(ต้องต่อ internet สำหรับ tile layers + DEM + AIS)

## 🔑 API Keys (ต้องใส่เอง)

โค้ดที่ commit ไว้ใช้ placeholder — ก่อนใช้งานจริงให้แก้ใน
`UDC_Simulator_10.html`:

| ตัวแปร | สมัครฟรีที่ | ใช้ทำอะไร |
|---|---|---|
| `AIS_API_KEY` (บรรทัด ~4719) | https://aisstream.io/ | WebSocket AIS feed |
| `MAPTILER_KEY` (บรรทัด ~7770) | https://maptiler.com/ | Ocean tiles + Terrain DEM |
| `KPLER_PROXY_URL` (บรรทัด ~5308) | self-host Cloudflare Worker | Kpler AIS REST proxy |

Kpler API key อยู่ฝั่ง Cloudflare Worker (เป็น secret) ไม่อยู่ใน client
— ดูตัวอย่าง worker ที่ `cloudflare-worker-ais-proxy.js`

## Data files

| ไฟล์ | คำอธิบาย |
|---|---|
| `bathy_sattahip_dmr.geojson` | DMR bathymetric contours สัตหีบ |
| `bathy_all.geojson` | bathymetry รอบอ่าวไทยตอนบน |
| `eec_region.geojson` | EEC boundary (3 จังหวัด) |
| `land_elevation_sattahip.json` | local DEM cache (fallback) |
| `navy_logo.png` | boot-screen logo (embed เป็น base64 ใน HTML) |
| `cloudflare-worker-ais-proxy.js` | Cloudflare Worker proxy สำหรับ Kpler |

## License

For academic research only. © 2026
