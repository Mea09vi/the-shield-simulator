# THE SHIELD 3.0 — UDC Multi-Domain Awareness Simulator
> Underwater Data Center (UDC) · Maritime Domain Awareness simulator สำหรับงานวิจัย กองทัพเรือ (Royal Thai Navy)
> ครอบคลุมพื้นที่อ่าวไทยตอนบนและฐานทัพเรือสัตหีบ

Single-file HTML5 tactical simulator — เปิดในเบราว์เซอร์ได้ทันที ไม่ต้องติดตั้ง/ไม่มี build step

**Live Simulator (GitHub Pages):** <https://mea09vi.github.io/the-shield-simulator/>

**Main Landing Site (GitHub Pages):** <https://mea09vi.github.io/the-shield-simulator/THE_SHIELD_Pitch.html>

---

## Current Version

**v18.7.0 · 7-Domain + AI Staff**

| Version | สิ่งสำคัญ |
|---------|-----------|
| v18.7.0 | **PBR-2 — แสงรอบทิศฉากอวกาศ (PMREM) + แปลง Phong ๔ ตัวสุดท้าย:** ปิดงานที่ PBR-1 เว้นไว้ · **ทั้งไฟล์เหลือ `MeshPhongMaterial` ๐ ตัว** · env ของอวกาศ = ดำรอบด้าน + earthshine จากด้านล่าง + จุดดวงอาทิตย์ (ไล่สีแนวตั้งอย่างเดียวไม่พอ) · ตั้งค่าตามฟิสิกส์รายชิ้น: เมฆกระจายแสงเต็มที่ · ดวงจันทร์ด้าน · **ตัวดาวเทียมหุ้มฟอยล์ MLI จึงเป็นโลหะมันวาว** |
| v18.6.0 | **PBR-1 — วัตถุแข็งในฉากดำน้ำ ๓๙ ชิ้น: Phong → MeshStandard + envMap:** เดิมแคปซูล/อาคาร/เสาอากาศ ใช้โมเดลแสงยุคเก่าที่ไม่สะท้อนสภาพแวดล้อม ดูเป็นพลาสติกลอยน้ำ ทั้งที่ผิวน้ำ/พื้นทรายในฉากเดียวกันใช้ PBR + PMREM อยู่แล้วตั้งแต่ v16.2.0 · แปลง `shininess → roughness` ด้วย `r=√(2/(s+2))` · **ไม่แตะ `MeshBasicMaterial`** เพราะตั้งใจไม่รับแสง (ไฟ marker/เรืองแสง) |
| v18.5.0 | **GFX-1 — ร่องรอยฝ่ายเรา + เกรดสีลูกโลก:** เดิมฝ่ายเราไม่มีร่องรอยเลย (มีแต่แนวกวาดโซนาร์ซึ่งปิดใน ๒ ใน ๓ โหมด) ดูจอแล้วไม่รู้ว่าเรือ "มาจากไหน" · วาดแบบ**ไล่จาง** เก่าสุดจางสุด อ่านทิศทางเวลาออกโดยไม่ต้องมีหัวลูกศร · renderer ลูกโลก ISR ไม่เคยตั้ง tone mapping ภาพจึงสว่างจัดต่างจากฉากดำน้ำ — ตั้ง ACESFilmic + sRGB ให้เป็นชุดเดียวกัน |
| v18.4.0 | **DST-1 — พื้นที่เฝ้า (NAI) + จุดตกลงใจ (Decision Point):** สะพานระหว่างแผน (COA) กับการปฏิบัติ ซึ่งเดิมขาดทั้งเส้น (ทั้งไฟล์มีคำว่า *decision point* ๐ ครั้ง) · คลิกวาง NAI บนแผนที่ → ผูกจุดตกลงใจ "ถ้าฝ่ายแดงเข้า NAI-x **ก่อน**นาทีที่ T → สั่ง Y" → เตือนทันทีที่เงื่อนไขเกิด · กราฟิก: `'lighter'` แสงบวกกัน + radial gradient + เส้นประวิ่ง (เฝ้าอยู่) / เส้นทึบแดง (เกิดแล้ว) |
| v18.3.0 | **TSCRUB-1 — ย้อนเวลา (Time Scrubbing):** ลากแถบเวลาแล้วทั้งจอย้อนตาม · ทำได้เพราะสถาปัตยกรรมเดิมแยก "วาด" ออกจาก "ขยับ" การย้อนเวลาจึงเป็นแค่เขียนตำแหน่งเก่ากลับแล้วสั่งวาดหนึ่งเฟรม **ใช้โค้ดวาดเดิมทั้งหมด** · ring buffer ~๒๐ นาที · ขอบจอเรืองแดงเตือนว่าภาพนี้ไม่ใช่ปัจจุบัน · *เดิม README อ้างฟีเจอร์นี้ไว้ตั้งแต่ v11 แต่ไม่เคยมีโค้ดจริง* |
| v18.2.0 | **SHARE-1 — แชร์สถานการณ์ด้วยลิงก์:** ฝังฉากลงใน URL (`#hash`) ผู้รับกดลิงก์แล้วเห็นภาพเดียวกันทันที · **ไม่ต้องมีเซิร์ฟเวอร์** ใช้บน GitHub Pages ได้เลย · ใช้ `#hash` ไม่ใช่ `?query` เพราะเบราว์เซอร์ไม่ส่ง hash ไปเซิร์ฟเวอร์ แผนวางกำลังจึงไม่โผล่ใน access log · บีบอัด deflate-raw → ฉาก ๑๔ หน่วยได้ลิงก์ ~๔๔๖ ตัวอักษร · *ไม่ใช่ภาพร่วม real-time* |
| v18.1.0 | **SCEN-1 — บันทึก/เรียกคืนสถานการณ์เป็นไฟล์ `.json`:** เดิมปิดแท็บแล้วการวางกำลังหายหมด ซ้อมแผนเดิมซ้ำหรือส่งต่อให้คนอื่นเปิดดูไม่ได้ · แถวคำสั่งใหม่ในแผงวางกำลัง หมวด «💾 สถานการณ์» · เก็บ **สูตรการตั้งฉาก** (ชนิด/พิกัด/รุ่นเรือ + มุมมองแผนที่ + ธีม) ไม่ใช่ snapshot ของวัตถุ — ตอนเรียกคืนวางใหม่ผ่านทางเดียวกับที่ผู้ใช้กดวางเอง ฉากจึงผ่านการตรวจภูมิประเทศเสมอ · เป็น*ฉากตั้งต้น* ไม่ใช่ save game กลางสมรภูมิ |
| v18.0.1 | **FNAME-1 — เปลี่ยนชื่อไฟล์ `UDC_Simulator_17.html` → `UDC_Simulator.html`:** ชื่อใหม่ไม่มีเลขรุ่น จะได้ไม่ต้องไล่แก้ลิงก์อีกทุกครั้งที่ขึ้น major · แก้การอ้างถึง ๔๓ จุดใน ๑๑ ไฟล์ (ลิงก์กดได้จริง ๓ จุด: ปุ่ม Launch ใน Pitch · ปุ่มใน palantir · iframe ในบทที่ ๔) · เหลือไฟล์เดิมไว้เป็น **หน้าเปลี่ยนเส้นทาง** กัน URL ที่บุ๊กมาร์กไว้ 404 |
| v18.0.0 | **ขึ้น major v18 — สิ้นสุดสาย v17 (ยุคงานวิจัย):** v17 ทั้งสาย (v17.0.0 → v17.53.0 · ๕๔ รุ่น) ถูกตรึง major ไว้ที่ 17 โดยเจตนา เพราะเลขรุ่นต้องตรงกับเอกสารวิจัยที่ส่งแล้ว — การอัปเกรดใหญ่จึงถูกยุบเป็น minor ตลอดมา · งานวิจัยสิ้นสุดแล้ว จึงปลดข้อผูกและขึ้น major · v18 = จุดเริ่มช่วง "นำไปใช้จริง" · **เปลี่ยนเฉพาะเลขรุ่นที่แสดง ๗ จุด ไม่แตะพฤติกรรมโปรแกรม** · ชื่อ "THE SHIELD 3.0" (ชื่อ*ตัวแบบ*) ไม่เปลี่ยน |
| v17.53.0 | **TOUCH-1 — ใช้งานบนแท็บเล็ตได้จริง:** การ "ลาก" ทุกจุดรองรับนิ้ว · แปลงตัวฟัง ๓๕ จุดเป็น Pointer Events (เดิม `mousedown/mousemove/mouseup` ซึ่งนิ้วไม่ยิงให้ → ย้ายหน้าต่าง/ปรับช่องแผนที่/หมุนกล้อง ๓ มิติ ไม่ได้เลย) · `pointercancel` ๑๕ จุด กันสถานะลากค้าง · `touch-action:none` ที่จุดจับ ๑๓ ตัว · ขยายพื้นที่แตะตัวแยกช่องเป็น ๒๒px บนอุปกรณ์สัมผัส |
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

> Changelog แบบละเอียดอยู่ใน comment ส่วนหัวของ `UDC_Simulator.html` (tag `[vXX.x.x]`)
> — รุ่น v17.39.1 ขึ้นไปมีรายละเอียดเต็ม ส่วนรุ่นเก่ากว่านั้นเป็นบรรทัดสรุป

---

## Page Ecosystem (เอกสารชุด THE SHIELD)

ทุกหน้าเป็นไฟล์ HTML เดี่ยวที่ root และเชื่อมโยงกันด้วย relative link — **อย่าย้ายเข้าโฟลเดอร์ย่อย** มิฉะนั้นลิงก์ข้ามหน้าจะพัง

| ไฟล์ | บทบาท |
|------|-------|
| `index.html` | **จุดเข้า GitHub Pages** — สำเนาตรงของ `UDC_Simulator.html` (byte-identical) |
| `UDC_Simulator.html` | **ตัวจำลองหลัก** (single-file). ปุ่ม PITCH ลิงก์ไป `THE_SHIELD_Pitch.html`. ปุ่ม PITCH ลิงก์ไป `THE_SHIELD_Pitch.html` |
| `THE_SHIELD_Pitch.html` | หน้านำเสนอ (hub) — ลิงก์ไปไดอะแกรม, สรุปเซ็นเซอร์, บทเรียน และบทวิจัย |
| `THE_SHIELD_Ch1.html` … `THE_SHIELD_Ch5.html` | บทวิจัย ๑–๕ (พร้อมภาพประกอบใน `img/` และสื่อ `THE_SHIELD_Ch*.webp/.mp4` ที่ root) |
| `THE_SHIELD_บทเรียนวิจัย_Baltic_Singapore.html` | กรณีศึกษา Baltic / Singapore |
| `THE_SHIELD_SensorSummary.html` | สรุปแหล่งข้อมูล/เซ็นเซอร์ (CNS) — *เดิมชื่อ `Sensor_Summary_CNS.html`* |
| `THE_SHIELD_SystemArchitecture_Cocoon.html` | ไดอะแกรมสถาปัตยกรรม (เลย์เอาต์ Cocoon) — ลิงก์จาก Pitch |
| `THE_SHIELD_Biofouling_Protection.html` | เกราะกันเพรียงทะเล — การปกป้องแคปซูล UDC จาก biofouling |
| `UDC_Simulator_17.html` | *หน้าเปลี่ยนเส้นทาง* → `UDC_Simulator.html` (ชื่อเดิมก่อน v18.0.1) |
| `presentation_palantir.html` | หน้านำเสนอผลงานวิจัย (ธีม Palantir Gotham C4ISR) — มีโหมดสไลด์สำรองสำหรับรอบตอบข้อซักถาม |

> **`UDC_Simulator_17.html` (v18.0.1):** ไม่ใช่ตัวจำลองแล้ว — เป็น **หน้าเปลี่ยนเส้นทาง** ขนาด ~1.4 KB
> ที่พาไป `UDC_Simulator.html` ด้วย `<meta http-equiv="refresh">` (ทำงานแม้ปิด JS) มีไว้กัน URL เดิมที่มีผู้
> บุ๊กมาร์ก/ส่งต่อไปแล้ว 404 · **ลบทิ้งได้ทุกเมื่อ**ถ้ายอมให้ลิงก์เก่าตาย · ชื่อใหม่ไม่มีเลขรุ่นโดยตั้งใจ
> จะได้ไม่ต้องเปลี่ยนชื่อและไล่แก้ลิงก์อีกตอนขึ้น v19

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
- **Scenario save/load** (v18.1.0) — บันทึกการวางกำลัง + มุมมอง + ธีม เป็นไฟล์ `.json` ส่งต่อกันได้
- **Scenario share link** (v18.2.0) — ฝังฉากใน URL ส่งลิงก์ให้กันเปิดดูภาพเดียวกัน ไม่ต้องมีเซิร์ฟเวอร์
- **NAI + Decision Points** (v18.4.0) — พื้นที่เฝ้าและจุดตกลงใจตามหลัก MDMP · เตือนเมื่อฝ่ายแดงเข้าพื้นที่ภายในกรอบเวลา
- **Time scrubbing** (v18.3.0) — ย้อนดูภาพการเคลื่อนที่ย้อนหลัง ~20 นาที (ring buffer, บันทึกทุก ~0.5 วิ)
  *เก็บตำแหน่ง/หัวเรือ/สถานะของหน่วย ไม่ใช่ย้อน state ทั้งระบบ*
- **AIS** — AISStream.io (WebSocket) + Kpler REST (ผ่าน Cloudflare Worker proxy)
- **4D Ocean** — HYCOM ESPC-D live (ผ่าน `ocean4d_live_server.js`) → sound speed (Mackenzie 1981),
  มี baked snapshot สำรองในตัว
- **SVP / Sound Speed** — WOA23 annual profile สัตหีบ

---

## Repository Structure

```
01_Simulator/
├── index.html                       ← GitHub Pages entry (สำเนา UDC_Simulator.html)
├── UDC_Simulator.html            ← ตัวจำลองหลัก (single file)
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
│                   smoke_test.js     (เปิดจริงในเบราว์เซอร์ · จับ error ตอนรัน)
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

เปิดไฟล์ `UDC_Simulator.html` (หรือ `index.html`) ในเบราว์เซอร์ได้โดยตรง
(ต้องต่ออินเทอร์เน็ตสำหรับ tile layers + AIS WebSocket + AI Staff)

ฟีเจอร์ที่ต้องมี server ฝั่งหลังบ้าน:
- **AI Staff Planner** → deploy `workers/ai-proxy.js` (ดู `workers/DEPLOY.md`)
- **AIS / Kpler proxy** → deploy `infrastructure/cloudflare-worker-ais-proxy.js`
- **4D Ocean live** → รัน `node ocean4d_live_server.js` แล้วเปิดผ่าน localhost (same-origin)
  — ไฟล์นี้เป็น local-only (ดูตารางท้าย Repository Structure) ถ้าไม่มีจะใช้ baked snapshot แทน

---

## Testing

ไม่มีชุดทดสอบอัตโนมัติ — มีสคริปต์ตรวจ ๒ ชั้น รันก่อน commit ทุกครั้งที่แก้ `UDC_Simulator.html`:

```bash
node scripts/tools/check_js_syntax.js UDC_Simulator.html   # ชั้น ๑ — ไวยากรณ์ JS ทุกบล็อก
npm i playwright-core                                          # (ครั้งเดียว)
node scripts/tools/smoke_test.js                               # ชั้น ๒ — บูตจริงในเบราว์เซอร์
node scripts/tools/smoke_test.js --shot /tmp/shot.png          # + เก็บภาพหน้าจอ
```

`check_js_syntax.js` ผ่านได้ทั้งที่แอปพังตอนรัน (ตรวจแค่ไวยากรณ์) — `smoke_test.js`
จึงเปิดไฟล์จริงแล้วรายงาน uncaught error · ไฟล์ที่โหลดไม่สำเร็จ · จำนวน DOM/canvas/panel · เวลาบูต

> ⚠ `smoke_test.js` **ต้องต่อเน็ตถึง CDN ได้** (Leaflet · Three.js · Chart.js โหลดจาก CDN)
> ถ้าเน็ตถูกบล็อกจะเห็น `ReferenceError: L is not defined` เป็นทอด ๆ ซึ่งเป็นผลจากเน็ต
> ไม่ใช่บั๊กของตัวจำลอง — สคริปต์ตรวจจับกรณีนี้แล้วเตือนให้เอง

> สองสคริปต์นี้ตรวจว่า "ยังบูตขึ้น" เท่านั้น **ไม่ได้** ตรวจว่าฟีเจอร์ทำงานถูก
> หรือสีถูกตามหลักนิยม IFF — ส่วนนั้นยังต้องดูด้วยตา

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
