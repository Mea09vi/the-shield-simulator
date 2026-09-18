# THE SHIELD 3.0 — UDC Multi-Domain Awareness Simulator
> Underwater Data Center (UDC) · Maritime Domain Awareness simulator สำหรับงานวิจัย กองทัพเรือ (Royal Thai Navy)
> ครอบคลุมพื้นที่อ่าวไทยตอนบนและฐานทัพเรือสัตหีบ

Single-file HTML5 tactical simulator — เปิดในเบราว์เซอร์ได้ทันที ไม่ต้องติดตั้ง/ไม่มี build step

**Live Simulator (GitHub Pages):** <https://mea09vi.github.io/the-shield-simulator/>

**Main Landing Site (GitHub Pages):** <https://mea09vi.github.io/the-shield-simulator/THE_SHIELD_Pitch.html>

---

## Current Version

**v17.52.0 · 7-Domain + AI Staff**

| Version | สิ่งสำคัญ |
|---------|-----------|
| v17.52.0 | แก้ ๒ จุดจากการทดสอบก่อนนำเสนอ — **COA-PICK** การ์ดหนทางปฏิบัติกดเลือกไม่ได้ (แถวปุ่มติดอยู่ใน `.cbody` ที่ `.collapsed` ซ่อน ตั้งแต่ v17.41.0) · **PVVIEW** ปุ่มสลับ "พื้นที่ตรวจจับ" ๓ ระดับ (เต็ม → เฉพาะวง → ปิด) ในหมวด PATROL VESSELS |
| v17.51.x | popup ๘ ใบเข้าธีม CIC มืด (`.mda-tooltip` ทาสีผิดชั้น) · แถบใหม่ **CCTV เมืองพัทยา** (เกาะล้าน ๕๐ + ชายหาด ๘๕ · deep-link ดูสด) |
| v17.50.0 | **ฉากดำน้ำ ๓ มิติ** — texture ถอดรหัส sRGB · extinction ทั้งฉาก · เทอร์โมไคลน์ตาม SVP |
| v17.47–.49 | แผง **Tidal Monitor** — จัดการแสดงผลใหม่ทั้งแผง (ไม่แตะ logic และ id ที่ JS เขียนถึง) |
| v17.46.0 | **ENV-1** SST จริง + ดวงจันทร์/IWI (ต่อยอด Baan-Pla Link · มจธ.) |
| v17.45.0 | **CCTV-1** แถบเซนเซอร์ "CCTV Street" ในโดเมนฝั่ง-ชายฝั่ง |
| v17.40–.44 | **ธีม GOTHAM** — ถอดบทเรียนงานออกแบบ Palantir Gotham/Blueprint เป็น "ตัวเลือก" ๒ แกน · ความลึกจากแสงด้านบนบนพื้นเกือบดำ · ยกแผงข้าง/แถบก้นจอขึ้นทัดเทียมหัวจอ · เขตแดน EEC/กองเรือเป็นฉากหลัง |
| v17.41–.42 | แผง **หนทางปฏิบัติ (หป.)** อ่านเทียบกันได้ + ซื่อสัตย์ว่า "อะไรที่ยังไม่รู้" · บันไดความรุนแรงแผ่นดินไหวชุดเดียว (`PGA_LADDER`) |
| v17.39.x | **D3** ยกเครื่องแผนที่ ๓ มิติ ๒ รอบ (three.js r128) · SEA-USE legend เป็นกุญแจแผนที่จริง · สีฟ้าบนหัวจอ = "เปิดอยู่" ไม่ใช่ "สำคัญ" |
| v17.32–.38 | **OPERATIONAL CALM** เฟส ๒–๕ (ระนาบความลึก · กริด ๘px · `data-threat` · วงแหวนโฟกัส) · SCENARIO INJECT ยกเครื่องแผงจำลองภัยคุกคาม + ๔ ฉากใหม่ |
| v17.25–.31 | ชั้น **token สี** เต็มระบบ + เขตสงวน SYMBOLOGY · แถบหัวจอจัดเป็น ๓ เขต · อีโมจิ → ไอคอนเส้น SVG · ตาราง IFF · ป้ายบนแผนที่อ่านออกทุกป้าย |
| v17.19–.24 | กระสุนมีวันหมด + นาฬิกา kill-chain · คุณภาพ track ๓ ระดับ + ประตูปล่อยอาวุธ + CEC · WTA/shoot-look-shoot · กล้องชายฝั่ง · AIS Live แบบไร้คีย์ฝังไฟล์ · ThaiLLM (BDI) |
| v17.11–.18 | Audit consolidation (VER/SEC/WORKER/AVI/CYBER) · hardening `fetchViaAnyProxy` · **UDC COMMAND CORE** + SCHEMATIC view · EMSO ในโดเมน Cyber-EM · มติ taxonomy DAS+SEIS → SEA |
| v17.7.x | **HALLMARK REDESIGN** — emoji → Lucide SVG icon system · electric border + boot sequence · circuit breaker กัน retry storm · COA Planner (World State JSON) |
| v17.0–v17.3.5 | **ฝ่ายเสนาธิการ AI (AI Staff Planner)** · ชุด "๙ ข้อสั่งการ" + ขยาย Multi-Domain (ROE · Jurisdiction · Seabed COP · Shared-MDA · PMESII/SWOT/TOWS) · Joint-Pub 3-04 alignment |
| v16.x   | 7-Domain MDA, FXAA/SSAO 3D pipeline, UI regroup (v16.3.1 = ฐานที่ v17.0.0 นำไป copy) |
| v15.x   | ขยาย font set (Thai + HUD), 4D ocean (HYCOM live), Own-Force-Aware Force Deployment |
| v13–v14 | Static seamark/cable snapshots, AI proxy worker, multi-provider LLM router |
| v11–v12 | 3D Dive, SVP acoustic model, time-replay, code cleanup |
| v09–v10 | AIS WebSocket, DEM offline cache |

> Changelog แบบละเอียดอยู่ใน comment ส่วนหัวของ `UDC_Simulator_17.html` (tag `[vXX.x.x]`)
> — รุ่น v17.39.1 ขึ้นไปมีรายละเอียดเต็ม ส่วนรุ่นเก่ากว่านั้นเป็นบรรทัดสรุป

---

## Page Ecosystem (เอกสารชุด THE SHIELD)

ทุกหน้าเป็นไฟล์ HTML เดี่ยวที่ root และเชื่อมโยงกันด้วย relative link — **อย่าย้ายเข้าโฟลเดอร์ย่อย** มิฉะนั้นลิงก์ข้ามหน้าจะพัง

| ไฟล์ | บทบาท |
|------|-------|
| `index.html` | **จุดเข้า GitHub Pages** — สำเนาตรงของ `UDC_Simulator_17.html` (byte-identical) |
| `UDC_Simulator_17.html` | **ตัวจำลองหลัก** (single-file). ปุ่ม PITCH ลิงก์ไป `THE_SHIELD_Pitch.html` |
| `THE_SHIELD_Pitch.html` | หน้านำเสนอ (hub) — ลิงก์ไปไดอะแกรม, สรุปเซ็นเซอร์, บทเรียน และบทวิจัย |
| `THE_SHIELD_Ch1.html` … `THE_SHIELD_Ch5.html` | บทวิจัย ๑–๕ (พร้อมภาพประกอบใน `img/` และสื่อ `THE_SHIELD_Ch*.webp/.mp4` ที่ root) |
| `THE_SHIELD_บทเรียนวิจัย_Baltic_Singapore.html` | กรณีศึกษา Baltic / Singapore |
| `THE_SHIELD_SensorSummary.html` | สรุปแหล่งข้อมูล/เซ็นเซอร์ (CNS) — *เดิมชื่อ `Sensor_Summary_CNS.html`* |
| `THE_SHIELD_SystemArchitecture_Cocoon.html` | ไดอะแกรมสถาปัตยกรรม (เลย์เอาต์ Cocoon) — ลิงก์จาก Pitch |
| `THE_SHIELD_Biofouling_Protection.html` | เกราะกันเพรียงทะเล — การปกป้องแคปซูล UDC จาก biofouling |
| `presentation_palantir.html` | หน้านำเสนอผลงานวิจัย (ธีม Palantir Gotham C4ISR) — มีโหมดสไลด์สำรองสำหรับรอบตอบข้อซักถาม |

> **หมายเหตุ:** ไดอะแกรมสถาปัตยกรรมมีฉบับเดียวคือ `_Cocoon` (ไม่เคยมีไฟล์ `THE_SHIELD_SystemArchitecture.html`
> แบบ standalone ในรีโป) · `THE_SHIELD_KnowledgeFlowchart.html` เคยมีแต่ถูกถอดออกในคอมมิต `8afbc3e` (folder reorg)

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
├── presentation_palantir.html       ← หน้านำเสนอ (ธีม Palantir Gotham)
├── README.md   ·   .gitignore
│
├── data/
│   ├── gis/        bathy_all · bathy_sattahip_dmr · eec_region (.geojson)
│   ├── dem/        land_elevation_sattahip.json (+ cache/ — gitignored)
│   ├── ocean/      svp_sattahip_annual.json · tl_grid.json/.bin
│   └── AIS (SeaVision)/   searches-export-*.json  (gitignored)
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

> **ไฟล์ที่ไม่ได้อยู่ในรีโป (local-only)** — ถูกถอดออกในคอมมิต `8afbc3e` (folder reorg) และต้องสร้าง/วางเองที่ root
> เมื่อต้องการใช้ฟีเจอร์ที่เกี่ยวข้อง ตัวจำลองโหลดแบบ best-effort จึงเปิดใช้งานได้ตามปกติแม้ไม่มีไฟล์เหล่านี้:
>
> | ไฟล์ | ใช้ทำอะไร | ถ้าไม่มี |
> |------|-----------|---------|
> | `cables-static.js` | สแนปช็อตสายเคเบิลใต้น้ำ (สร้างจาก `scripts/cables/`) | เตือนใน console → โหมด Overpass อย่างเดียว |
> | `seamarks-static.js` | สแนปช็อต IALA seamark (offline fallback) | เตือนใน console → ปิด offline fallback |
> | `ocean4d_live_server.js` | Node helper: serve folder + `/ocean4d` (HYCOM live) | ใช้ baked snapshot ที่ฝังในตัวจำลอง |

---

## Running

เปิดไฟล์ `UDC_Simulator_17.html` (หรือ `index.html`) ในเบราว์เซอร์ได้โดยตรง
(ต้องต่ออินเทอร์เน็ตสำหรับ tile layers + AIS WebSocket + AI Staff)

ฟีเจอร์ที่ต้องมี server ฝั่งหลังบ้าน:
- **AI Staff Planner** → deploy `workers/ai-proxy.js` (ดู `workers/DEPLOY.md`)
- **AIS / Kpler proxy** → deploy `infrastructure/cloudflare-worker-ais-proxy.js`
- **4D Ocean live** → รัน `node ocean4d_live_server.js` แล้วเปิดผ่าน localhost (same-origin)
  — ไฟล์นี้เป็น local-only (ดูตารางท้าย Repository Structure) ถ้าไม่มีจะใช้ baked snapshot แทน

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

For academic research only. © 2026 Naval Command and Staff College
