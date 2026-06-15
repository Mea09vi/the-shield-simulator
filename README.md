# THE SHIELD 3.0 — UDC Multi-Domain Awareness Simulator
> Underwater Data Center (UDC) · Maritime Domain Awareness simulator สำหรับงานวิจัย กองทัพเรือ (Royal Thai Navy)
> ครอบคลุมพื้นที่อ่าวไทยตอนบนและฐานทัพเรือสัตหีบ

Single-file HTML5 tactical simulator — เปิดในเบราว์เซอร์ได้ทันที ไม่ต้องติดตั้ง/ไม่มี build step

**Live (GitHub Pages):** <https://mea09vi.github.io/the-shield-simulator/>

---

## Current Version

**v17.3.5 · 7-Domain + AI Staff**

| Version | สิ่งสำคัญ |
|---------|-----------|
| v17.3.5 | เติม changelog เชิงบรรยาย **v16 + v17** กลับเข้า comment ส่วนหัวของ `UDC_Simulator_17.html` (เดิมหยุดที่ v15) · เอกสารล้วน ไม่แตะ logic |
| v17.3.4 | อัปเดต comment ให้ตรงเอกสารวิจัย (บท ๓–๔) · bug audit ครบ ๙ ข้อสั่งการ · แก้ป้ายเวอร์ชันค้าง v16.0 → v17.3.4 |
| v17.3.1–3 | UI ซีกขวา: ย้าย **LAYERS & TOOLS** ขึ้น header (ข้าง THEME) + ทำเป็น pop-up panel · เก็บกวาดป้าย/กรอบ DEPLOY ที่ค้าง |
| v17.3.0 | **ชุดใหญ่ — ๙ ข้อสั่งการ + ขยาย Multi-Domain:** ROE Panel (ผ่าครึ่ง Threat-Vector Timeline · บันได EOF SHOUT→SHOW→SHOVE→SHOOT) · Plan Status Indicator · Jurisdiction & Legal-Authority · Underwater/Seabed COP + Sonar Grid · Shared-MDA (IFC-SG / ศรชล. Joint COP) · Strategic Analysis (PMESII/SWOT/TOWS · บทที่ ๓) · แก้ HERO/SONAR ปิดไม่ได้ · แก้ Copperhead 3D ค้าง · declutter ซีกขวา (default collapsed) |
| v17.2.5 | ปุ่ม **PITCH** ใน header → ลิงก์กลับหน้านำเสนอ `THE_SHIELD_Pitch.html` |
| v17.2.4 | ปรับยศผู้พัฒนาในส่วนหัวไฟล์ |
| v17.0.0 | **ฝ่ายเสนาธิการ AI (AI Staff Planner)** — ผู้ช่วยวางแผนเชิงยุทธการ |
| v16.x   | 7-Domain MDA, FXAA/SSAO 3D pipeline, UI regroup |
| v15.x   | ขยาย font set (Thai + HUD), 4D ocean (HYCOM live) |
| v13–v14 | Static seamark/cable snapshots, AI proxy worker |
| v11–v12 | 3D Dive, SVP acoustic model, time-replay, code cleanup |
| v09–v10 | AIS WebSocket, DEM offline cache |

> Changelog แบบละเอียดอยู่ใน comment ส่วนหัวของ `UDC_Simulator_17.html` (tag `[vXX.x.x]`)

---

## Page Ecosystem (เอกสารชุด THE SHIELD)

ทุกหน้าเป็นไฟล์ HTML เดี่ยวที่ root และเชื่อมโยงกันด้วย relative link — **อย่าย้ายเข้าโฟลเดอร์ย่อย** มิฉะนั้นลิงก์ข้ามหน้าจะพัง

| ไฟล์ | บทบาท |
|------|-------|
| `index.html` | **จุดเข้า GitHub Pages** — สำเนาตรงของ `UDC_Simulator_17.html` (byte-identical) |
| `UDC_Simulator_17.html` | **ตัวจำลองหลัก** (single-file). ปุ่ม PITCH ลิงก์ไป `THE_SHIELD_Pitch.html` |
| `THE_SHIELD_Pitch.html` | หน้านำเสนอ (hub) — ลิงก์ไปไดอะแกรม, สรุปเซ็นเซอร์, บทเรียน และบทวิจัย |
| `THE_SHIELD_Ch1.html` / `THE_SHIELD_Ch2.html` | บทวิจัย 1–2 (พร้อมภาพประกอบใน `img/`) |
| `THE_SHIELD_บทเรียนวิจัย_Baltic_Singapore.html` | กรณีศึกษา Baltic / Singapore |
| `THE_SHIELD_SensorSummary.html` | สรุปแหล่งข้อมูล/เซ็นเซอร์ (CNS) — *เดิมชื่อ `Sensor_Summary_CNS.html`* |
| `THE_SHIELD_SystemArchitecture.html` | ไดอะแกรมสถาปัตยกรรมระบบ (standalone) |
| `THE_SHIELD_SystemArchitecture_Cocoon.html` | ไดอะแกรมสถาปัตยกรรม (เลย์เอาต์ Cocoon) — ลิงก์จาก Pitch |
| `THE_SHIELD_KnowledgeFlowchart.html` | ผังความรู้/กระบวนการ (standalone) |

> **หมายเหตุการเปลี่ยนชื่อ (v17.2.5 reorg):** หน้าที่ deploy ทั้งหมดใช้ prefix `THE_SHIELD_` มาตรฐานแล้ว
> (เดิม `TheShield_*` และ `Sensor_Summary_CNS.html`). ลิงก์ภายในทุกจุดถูกแก้ตามแล้ว
> URL สาธารณะของหน้าที่เปลี่ยนชื่อจะเปลี่ยนตามไปด้วย

---

## Features

- **2D Map** (Leaflet 1.9.4) — basemaps หลายชั้น (Esri Ocean / GEBCO 2023), AIS live feed,
  reef/safety/fleet zones, SLOC, สายเคเบิลใต้น้ำ + landing, patrol/survey assets, sonar-equation overlays
- **3D Dive** (Three.js r128) — terrain จาก DEM (offline cache), FFT ocean surface,
  acoustic ray tracing (SVP-aware), shadow zones, UDC sensor model · post-FX: Bloom + SSAO + FXAA
- **AI Staff Planner** (v17) — ฝ่ายเสนาธิการ AI ผ่าน proxy worker (Cloudflare Workers AI / Google Gemini)
- **Time-replay** — RAM ring buffer (≈ 1 ชม. @ 10 วิ/tick)
- **AIS** — AISStream.io (WebSocket) + Kpler REST (ผ่าน Cloudflare Worker proxy)
- **4D Ocean** — HYCOM ESPC-D live (ผ่าน `ocean4d_live_server.js`) → sound speed (Mackenzie 1981),
  มี baked snapshot สำรองในตัว
- **SVP / Sound Speed** — WOA23 annual profile สัตหีบ

---

## Repository Structure

```
01_Simulator/
├── index.html                       ← GitHub Pages entry (สำเนา UDC_Simulator_17.html)
├── UDC_Simulator_17.html            ← ตัวจำลองหลัก (single file)
├── THE_SHIELD_*.html                ← เอกสารชุด (ดู Page Ecosystem ด้านบน)
├── cables-static.js                 ← ข้อมูลสายเคเบิลใต้น้ำ (สร้างจาก scripts/cables/)
├── seamarks-static.js               ← ข้อมูล IALA seamark (offline fallback)
├── ocean4d_live_server.js           ← Node helper: serve folder + /ocean4d (HYCOM live)
├── README.md   ·   .gitignore
│
├── data/
│   ├── gis/        bathy_all · bathy_sattahip_dmr · eec_region (.geojson)
│   ├── dem/        land_elevation_sattahip.json (+ cache/ — gitignored)
│   ├── ocean/      svp_sattahip_annual.json · tl_grid.json/.bin
│   └── AIS (SeaVision)/   searches-export-*.json
│
├── assets/         navy_logo.png (boot-screen logo)
├── img/            ภาพประกอบบทวิจัย (Baltic cable damage, Eagle S, HTMS Bhumibol ฯลฯ)
│
├── infrastructure/ cloudflare-worker-ais-proxy.js · OpenApiSpec-AIS.json   (Kpler/AIS proxy)
├── workers/        ai-proxy.js · wrangler.toml · DEPLOY.md                  (AI Staff proxy)
│
├── docs/           UDC_Research_Summary.md
│
├── scripts/
│   ├── cables/     ไปป์ไลน์ข้อมูลสายเคเบิล (ดู scripts/cables/README.md)
│   │               _convert_tg.ps1 (ACTIVE, TeleGeography) · _convert_cables.ps1 (LEGACY, Overpass)
│   │               + raw JSON inputs + สคริปต์ตรวจสอบ (_filter_tg / _check_gulf / _inspect)
│   └── tools/      build_tl_grid.py · fetch_svp_woa23.py · rewrite_section_markers.py
│                   check_js_syntax.js (ตรวจ syntax ของ inline <script> ทุกบล็อก)
│
└── (gitignored)    _scratch/ · _เวอร์ชันเก่า/ · _bathy/ · _data_raw/
```

---

## Running

เปิดไฟล์ `UDC_Simulator_17.html` (หรือ `index.html`) ในเบราว์เซอร์ได้โดยตรง
(ต้องต่ออินเทอร์เน็ตสำหรับ tile layers + AIS WebSocket + AI Staff)

ฟีเจอร์ที่ต้องมี server ฝั่งหลังบ้าน:
- **AI Staff Planner** → deploy `workers/ai-proxy.js` (ดู `workers/DEPLOY.md`)
- **AIS / Kpler proxy** → deploy `infrastructure/cloudflare-worker-ais-proxy.js`
- **4D Ocean live** → รัน `node ocean4d_live_server.js` แล้วเปิดผ่าน localhost (same-origin)

---

## Regenerating data files

| ไฟล์ที่ root | สร้างจาก | คำสั่ง |
|-------------|---------|-------|
| `cables-static.js` | `scripts/cables/tg-cables-raw.json` (TeleGeography) | `pwsh scripts/cables/_convert_tg.ps1` |
| `data/ocean/tl_grid.*` | SVP profile | `python scripts/tools/build_tl_grid.py` |

> ⚠️ converter ของ cable เขียนทับ `cables-static.js` ที่ root — อย่ารัน LEGACY (`_convert_cables.ps1`)
> เว้นแต่ตั้งใจกลับไปใช้ข้อมูล Overpass. รายละเอียดใน `scripts/cables/README.md`

---

## API Keys & Secrets

โค้ดที่ commit ใช้ **placeholder เท่านั้น** — secret จริงเก็บฝั่ง Worker หรือ local เสมอ:

| ตัวแปร / secret | อยู่ที่ | ใช้ทำอะไร |
|------------------|--------|-----------|
| `AIS_API_KEY` | client (placeholder) | WebSocket AIS live feed (aisstream.io) |
| Kpler key | Cloudflare Worker secret | Kpler AIS REST proxy |
| AI provider key | Cloudflare Worker secret | AI Staff (Workers AI / Gemini) |

> ไฟล์ credential/บัญชี (`*Account*.pdf`, `*credentials*.json`, `*.env`, `.wrangler/`) และ PDF ทั้งหมด
> ถูก **gitignore** ไว้ — ห้าม commit เด็ดขาด

---

## Tech Stack

Leaflet 1.9.4 · Three.js r128 (+Bloom/SSAO/FXAA) · Chart.js 4.4.1 · augmented-ui 2.0.0 · Leaflet.heat ·
AISStream.io (WebSocket) · Cloudflare Workers (Kpler + AI proxy) · HYCOM ESPC-D (4D ocean) ·
DEM pre-baked offline (© MapTiler Terrain-RGB, decoded v10)

**Fonts** — Thai: Sarabun / Prompt / Kanit / IBM Plex Sans Thai / Noto Sans Thai / Chakra Petch ·
HUD/mono: Share Tech Mono / Saira / Orbitron / JetBrains Mono / Rajdhani / Audiowide

**Theme** — Combat Information Center (CIC) dark theme: น้ำเงินเข้ม = ทะเล · เขียว = ปลอดภัย · เหลือง/ส้ม = เตือน · แดง = ภัยคุกคาม

---

## Code Conventions

```javascript
// ═══════════════════════════════════════  ← Major section
// ───────────────────────────────────────  ← Sub-section
[v09] / [v16] / [v17]    // "Added in version X" — historical marker
/* v17.x.x — desc */     // "Changed in v17.x.x" — inline change note
```
- Feature เพิ่มครั้งแรกใน version ไหน → tag `[vXX]` ไว้ใกล้ declaration
- การแก้ไข → `/* vXX.x.x — สิ่งที่เปลี่ยน */` ต่อท้าย line ที่แก้

---

## License

For academic research only. © 2026 Royal Thai Naval Academy
