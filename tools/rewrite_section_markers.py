#!/usr/bin/env python3
"""
rewrite_section_markers.py — UDC_Simulator_11.html ตรวจ + เรียบเรียง marker ใหม่
─────────────────────────────────────────────────────────────────────
ผู้อ่านเป้าหมาย : อาจารย์โรงเรียนเสนาธิการทหารเรือ + นทน. หลักสูตร วทร./สธ.ทร.
รูปแบบ         : ภาษากึ่งทางการ ผสมศัพท์โปรแกรมเมอร์ (semi-formal Thai + dev jargon)
แบ่งหมวดสถาปัตย์ : ก ข ค ง จ ฉ ช ซ ฌ  (รวม 9 หมวด, 37 ส่วน)

แต่ละ section แทนที่บล็อก  `// ═══...//  [ส่วนที่ N] title//  ═══...`  เดิม
ด้วยฟอร์แมตมาตรฐาน 7 บรรทัด:

    // ═══════════════════════════════════════════════════════════════
    //  [ส่วนที่ N] หมวด X — <Thai group title>
    //  <Thai sub-title> · <English technical label>
    // ───────────────────────────────────────────────────────────────
    //  วัตถุประสงค์  : ...
    //  หลักการ       : ...
    //  เชื่อมต่อกับ   : ...
    // ═══════════════════════════════════════════════════════════════
"""
import re, sys
from pathlib import Path

SRC = Path(__file__).resolve().parent.parent / "UDC_Simulator_11.html"

# ── ตารางหลัก: เก็บข้อมูลทุก section ตาม "ลำดับใน file" (line order)
# Fields: old_num (string|None), group_letter, group_thai, title_thai, tech_label,
#         purpose, principle, links, anchor_pattern (regex แบบ multi-line ถ้า None=existing marker)
#
# old_num=None  → เป็น section ใหม่ที่ต้องเพิ่ม (ใช้ insert_before)
# anchor_line   → key สำหรับหาตำแหน่งใส่ marker ใหม่

SECTIONS = [
    # ── หมวด ก: สถาปัตยกรรมพื้นฐาน + ชั้นภูมิศาสตร์ ─────────────────
    dict(old="1",  g="ก", g_th="สถาปัตยกรรมพื้นฐาน + ชั้นภูมิศาสตร์",
         th="การตั้งค่าแผนที่ Leaflet", en="Leaflet Map + CartoDB Dark Matter Tile",
         purpose="สร้างฉากหลังแผนที่ ๒ มิติ ความละเอียดสูงสำหรับการแสดงสถานการณ์ทางยุทธวิธี",
         principle="Leaflet.js + WGS-84 projection · Dark Tile (เน้น contrast ของ entity เรือดาราศาสตร์ ฝ่ายเรา/ฝ่ายข้าศึก)",
         links="เป็นรากฐานของทุก control/layer overlay ที่ตามมา"),

    dict(old=None, g="ก", g_th="สถาปัตยกรรมพื้นฐาน + ชั้นภูมิศาสตร์",
         th="ระบบ AIS Trajectory Heatmap", en="AIS Heat Map Layer (KDE-style aggregation)",
         purpose="แสดงความหนาแน่นของเส้นทางเรือพาณิชย์/เรือประมง จากข้อมูล AIS ในรอบ ๒๔ ชม.",
         principle="Leaflet.heat plugin · Kernel Density Estimation บน lat/lng ของ AIS contacts",
         links="ช่วยอาจารย์/ผู้บัญชาการมองเห็น 'แนวเสี่ยง' ที่ผู้ก่อภัยอาจซ่อนตัวกลม กลืน",
         anchor="L\\.Control\\.AisHeat = L\\.Control\\.extend"),

    dict(old=None, g="ก", g_th="สถาปัตยกรรมพื้นฐาน + ชั้นภูมิศาสตร์",
         th="ระบบตรวจจับความผิดปกติของ AIS", en="AIS Anomaly Detection (spoof / dark / loiter)",
         purpose="แจ้งเตือนเรือที่มีพฤติกรรมน่าสงสัย ๓ ประเภท: spoofing, dark ship, loitering",
         principle="rule-based heuristics บน velocity discontinuity + signal-loss window + dwell time",
         links="feed ข้อมูลเข้า IFF Threat Display (ส่วนที่ ๒๙)",
         anchor="L\\.Control\\.AisAnomaly = L\\.Control\\.extend"),

    dict(old=None, g="ก", g_th="สถาปัตยกรรมพื้นฐาน + ชั้นภูมิศาสตร์",
         th="กรอบมุมมองกล้อง 3D บนแผนที่ 2D", en="Three.js Camera Frustum Projection",
         purpose="ฉาย field-of-view ของกล้อง 3D Dive View ลงบนแผนที่ ๒ มิติ เพื่อเชื่อม situational awareness",
         principle="Three.js PerspectiveCamera + frustum-to-ground plane projection (4 มุมล่างของ frustum)",
         links="ทำงานคู่กับ 3D Dive View (ส่วนที่ ๓๗) สลับมุมมองได้ทันทีโดยไม่หลงทิศ",
         anchor="L\\.Control\\.CamFrustum = L\\.Control\\.extend"),

    dict(old=None, g="ก", g_th="สถาปัตยกรรมพื้นฐาน + ชั้นภูมิศาสตร์",
         th="แผนที่ความร้อนการสูญเสียเสียงใต้น้ำ", en="TL Heatmap Overlay (WOA23-derived)",
         purpose="แสดงระยะตรวจจับของโซนาร์ active ในรูปคลื่นความร้อน (Transmission Loss < 90 dB = สีน้ำเงิน, > 130 dB = สีแดง)",
         principle="Canvas radial heatmap · sample TL จากตาราง pre-computed (ray-traced WOA23 SVP) · HSL color map",
         links="ผูกกับโมดูล WoaTL (ส่วนที่ ๓๖) — เปลี่ยนความถี่ ๕/๑๕/๓๐ kHz ได้ด้วย right-click",
         anchor="L\\.Control\\.TlHeat = L\\.Control\\.extend"),

    dict(old="2",  g="ก", g_th="สถาปัตยกรรมพื้นฐาน + ชั้นภูมิศาสตร์",
         th="แนวปะการังเทียม", en="Artificial Reef Markers (Acoustic Clutter Zone)",
         purpose="แสดงแนวปะการังเทียมที่กรมประมง/ทร. วางไว้ — เป็นพื้นที่สะท้อนเสียงสูง (clutter) ที่ลด PSR ของโซนาร์",
         principle="GIS Marker จาก dataset ทร. · ทำหน้าที่เป็น acoustic clutter zone ในตอนวิเคราะห์โซนาร์",
         links="ลดประสิทธิภาพ Sonar Sweep (ส่วนที่ ๒๐) และ Guardian UUV passive sonar (ส่วนที่ ๒๗)"),

    dict(old="3",  g="ก", g_th="สถาปัตยกรรมพื้นฐาน + ชั้นภูมิศาสตร์",
         th="เขตปลอดภัยในราชการทหารเรือ", en="Naval Safety Zone (พ.ร.ก. Restricted Area)",
         purpose="กำหนดขอบเขตน่านน้ำที่จำกัดการเข้าออกตามกฎหมาย — เป็นชั้นแรกของ Rules of Engagement (ROE)",
         principle="Leaflet polygon · พิกัดอ้างจาก พ.ร.ก. กำหนดเขตปลอดภัยในราชการทหาร",
         links="trigger ROE level 1 — เมื่อภัยคุกคามล้ำเข้ามา จะเปลี่ยนสีเป็นสีส้ม"),

    dict(old="4",  g="ก", g_th="สถาปัตยกรรมพื้นฐาน + ชั้นภูมิศาสตร์",
         th="พื้นที่กองเรือยุทธการ", en="Fleet Operational Zone (C2 Node + DAS endpoint)",
         purpose="แสดงพื้นที่ฐาน กร./ฐานทัพเรือสัตหีบ — เป็นโหนด Command & Control หลัก",
         principle="Leaflet polygon + DAS Cable 2 anchor point",
         links="เชื่อมกับ DAS Cable #2 (ส่วนที่ ๙) และฐาน อูฯ ตะเภา (ผ่าน Coastal Assets)"),

    dict(old="5b", g="ก", g_th="สถาปัตยกรรมพื้นฐาน + ชั้นภูมิศาสตร์",
         th="สายเคเบิล DAS เส้นที่ ๒ — เส้นทางสำรอง", en="DAS Fiber Optic Cable #2 (Redundancy Path)",
         purpose="สาย Distributed Acoustic Sensing เส้นที่สอง — ป้องกัน single-point-of-failure ของระบบดักฟัง",
         principle="Bezier curve geometry · เส้นทางเลี่ยงเส้นแรกเพื่อ geographic diversity",
         links="ทำงานคู่กับ DAS Cable #1 (ส่วนที่ ๑๘) ผ่านระบบ tripwire เดียวกัน"),

    dict(old="6",  g="ก", g_th="สถาปัตยกรรมพื้นฐาน + ชั้นภูมิศาสตร์",
         th="สายเคเบิลใต้น้ำระหว่างประเทศ", en="International Submarine Cables (ADC/AAG)",
         purpose="แสดงสายเคเบิลสื่อสารระหว่างประเทศ ๒ ระบบ (ADC, AAG) ที่ผ่านน่านน้ำไทย — รับผิดชอบ ~๙๕% ของ internet traffic",
         principle="GIS polyline จากข้อมูลของ CLS (Cable Landing Station) สากล",
         links="เป็นสินทรัพย์เชิงยุทธศาสตร์ที่ UDC ของเราต้องเฝ้าระวัง"),

    dict(old="7",  g="ก", g_th="สถาปัตยกรรมพื้นฐาน + ชั้นภูมิศาสตร์",
         th="SLOC — เส้นทางเดินเรือพาณิชย์", en="Sea Lines of Communication (Threat Approach Vector)",
         purpose="แสดง 'เส้นเลือดใหญ่' ทางเศรษฐกิจ — แหลมฉบัง / มาบตาพุด / สิงคโปร์ — และเป็น vector ที่ภัยคุกคามใช้แฝงตัวเข้ามา",
         principle="Leaflet polyline แบ่ง ๓ corridor (เหนือ-กลาง-ใต้)",
         links="ใช้เป็น 'baseline behavior' ในการตรวจจับ AIS anomaly (ส่วนที่ ๓)"),

    dict(old="8",  g="ก", g_th="สถาปัตยกรรมพื้นฐาน + ชั้นภูมิศาสตร์",
         th="ระบบแบ่งแนวจราจรทางเรือ", en="Traffic Separation Scheme (IMO + กรมเจ้าท่า)",
         purpose="แสดง TSS ตามมาตรฐาน IMO ของกรมเจ้าท่า — แหลมฉบัง, มาบตาพุด, สัตหีบ",
         principle="GIS polygon + heading-restricted lane",
         links="ใช้คัดกรอง AIS contacts ที่ 'ผิดเลน' เพื่อ flag เป็น behavioral anomaly"),

    # ── หมวด ข: ระบบพิกัด + สถานะส่วนกลาง ─────────────────────────
    dict(old="9",  g="ข", g_th="ระบบพิกัด + สถานะส่วนกลาง",
         th="ชั้น Canvas Overlay", en="HTML5 Canvas Layer (over Leaflet)",
         purpose="วาง canvas โปร่งใสซ้อนบน Leaflet — เป็นพื้นที่วาด entity ทั้งหมด (เรือ, UUV, threats, FX)",
         principle="Z-order layering · canvas พิกัด pixel-based · sync กับ Leaflet ผ่าน latLngToContainerPoint",
         links="render-target ของทุก draw*() ในส่วนที่ ๒๑–๓๐"),

    dict(old="10", g="ข", g_th="ระบบพิกัด + สถานะส่วนกลาง",
         th="ระบบพิกัดทางภูมิศาสตร์", en="Geographic Coordinate System (3-way: WGS-84 ↔ nx/ny ↔ pixel)",
         purpose="แปลงพิกัดระหว่าง ๓ ระบบ: lat/lng (สากล), nx/ny (normalized 0–1), pixel (canvas)",
         principle="Haversine formula สำหรับ distance · pxPerNm() สำหรับ scale · geoXY() / pn() เป็น helper หลัก",
         links="ทุก entity ใช้ nx/ny เก็บตำแหน่ง — แปลงเป็น pixel เมื่อต้องวาด"),

    dict(old="11", g="ข", g_th="ระบบพิกัด + สถานะส่วนกลาง",
         th="ตัวแปรสถานะส่วนกลาง", en="Global State Variables (Simulator Memory)",
         purpose="ที่เก็บข้อมูล runtime ของทั้งระบบ — frame counter, arrays ของ entity ทุกประเภท, flag การจำลอง",
         principle="single source of truth pattern · ไม่มี state manager (Redux/Vuex) — ใช้ global variable เพื่อความเร็ว",
         links="อ้างถึงจากทุกฟังก์ชันที่ update/render"),

    # ── หมวด ค: สิ่งแวดล้อมและอากาศยานสนับสนุน ────────────────────
    dict(old="12B",g="ค", g_th="สิ่งแวดล้อมและอากาศยานสนับสนุน",
         th="ระบบ ฮ.ปด.", en="ASW Helicopter System (MH-60S + Sonobuoy + Mk46)",
         purpose="จำลอง ฮ. ปราบเรือดำน้ำ ที่ขึ้นจากฐาน อูฯ ตะเภา — ทิ้ง sonobuoy + ยิง Mk46 ตอร์ปิโดได้",
         principle="state machine: TRANSIT → SONOBUOY DROP → CONTACT → ENGAGE → RTB",
         links="เรียกใช้ทรัพยากร torpedoes (ส่วนที่ ๓๐) และ sonobuoy field (ส่วนที่ ๒๐)"),

    dict(old="12", g="ค", g_th="สิ่งแวดล้อมและอากาศยานสนับสนุน",
         th="การจำลองน้ำขึ้น-ลง + ตัวปรับ Detection", en="Tide Simulation (M2+S2 Harmonics)",
         purpose="จำลองน้ำขึ้น-ลงแบบ semi-diurnal ของอ่าวไทย — ส่งผลต่อ noise level และ thermocline depth",
         principle="M2 (12.42h) + S2 (12.00h) harmonics · ผลิต range factor 0.78–1.10× สำหรับ detection",
         links="ปรับ PSR ของ sonar/passive ทั้งหมด (ส่วนที่ ๒๐ และ ๒๗)"),

    dict(old="5a", g="ค", g_th="สิ่งแวดล้อมและอากาศยานสนับสนุน",
         th="สายเคเบิล DAS เส้นที่ ๑ + ระบบ Tripwire", en="DAS Fiber Optic Cable #1 (Rayleigh Backscatter Tripwire)",
         purpose="สายดักฟังเสียงใต้น้ำเส้นหลัก — ใช้ Rayleigh backscattering แปลงเส้นใยแก้วเป็น hydrophone กระจาย",
         principle="photon-by-photon model · OTDR-style KP localization · triggers alert เมื่อ ΔPhase > threshold",
         links="คู่กับ DAS Cable #2 (ส่วนที่ ๙) เพื่อ redundancy + cross-check ตำแหน่งภัย"),

    # ── หมวด ง: สถาปัตยกรรมการป้องกัน ────────────────────────────
    dict(old="13", g="ง", g_th="สถาปัตยกรรมการป้องกัน",
         th="วงแหวนป้องกันแบบหลายชั้น", en="Layered Defense Zone Rings (Outer / MEZ / Hydro / Sonar)",
         purpose="แสดง concentric defense ring ๔ ชั้นรอบ UDC — Outer 10nm / MEZ 5nm / Hydro / Sonar",
         principle="geographic accuracy (haversine-based) · ไม่ใช่แค่ pixel circle",
         links="แต่ละ ring trigger ROE level ต่างกัน · ทำงานคู่กับ Sonar Sweep (ส่วนที่ ๒๐)"),

    dict(old="14", g="ง", g_th="สถาปัตยกรรมการป้องกัน",
         th="การกวาดโซนาร์แบบ Active", en="Active Sonar Sweep Animation (CIC 360° Display)",
         purpose="จำลองจอ CIC ของ active sonar — กวาด ๓๖๐° รัศมี ๑๑ nm + sweep line + persistent trail",
         principle="radial gradient + sweep line ที่ลบ trail หลังกวาดครบรอบ",
         links="ตรวจจับ threats (ส่วนที่ ๒๙) — call detectionCheck() ทุกการ sweep"),

    # ── หมวด จ: กำลังฝ่ายเรา (Friendly Fleet) ─────────────────────
    dict(old="15", g="จ", g_th="กำลังฝ่ายเรา (Friendly Fleet)",
         th="เรือสำรวจอุทกศาสตร์", en="Hydrographic Survey Vessels (MBES / SSS / MAG / ADCP / SBP / CTD)",
         purpose="เรือสำรวจของ ทร. (ร.ล.พฤหัสบดี / ร.ล.จันทร / ร.ล.สุริยะ) — มี ๘ เซ็นเซอร์อุทกศาสตร์",
         principle="lawn-mower pattern · MBES swath ±60° · CTD cast → SVP boost +2 dB PSR · MAG sweep ตรวจ UUV",
         links="ของใหม่ HSV-Ext (ส่วนที่ ๒๒) ขยาย capability ตาม spec ร.ล.สุริยะ FY69"),

    dict(old=None, g="จ", g_th="กำลังฝ่ายเรา (Friendly Fleet)",
         th="HSV-Ext — ขีดความสามารถจาก ร.ล.สุริยะ", en="HSV Extension Module (HTMS Suriya 2026 PDF-derived)",
         purpose="เพิ่ม ๘ ขีดความสามารถจาก spec ร.ล.สุริยะ ลำใหม่ ปีงบ ๖๙ ลงในแผนที่ ๒ มิติ",
         principle="MBES swath ×5·depth · FLS cone 60°×200m · ADCP current field · SVP/XBT markers · HDG/COG·DGPS · Survey Planner · Dashboard",
         links="ทำงานเสริมส่วนที่ ๒๑ — ไม่ต้องใช้ raw survey data (synthetic ทั้งหมด)",
         anchor="HSV-Ext — PDF-derived capabilities"),

    dict(old="16", g="จ", g_th="กำลังฝ่ายเรา (Friendly Fleet)",
         th="ROV ระยะใกล้", en="ROV — Remotely Operated Vehicle (Close-in Security)",
         purpose="หุ่นยนต์ใต้น้ำควบคุมระยะใกล้ — รักษาความปลอดภัยรอบ UDC ในรัศมีไม่เกิน 0.5 nm",
         principle="tether-limited movement · slow speed (~2 kn) · short-range camera + manipulator",
         links="ทำงานเป็น 'inner perimeter' ก่อน Guardian UUV (ส่วนที่ ๒๗)"),

    dict(old="17", g="จ", g_th="กำลังฝ่ายเรา (Friendly Fleet)",
         th="UDC Capsule (Shanghai-type)", en="Underwater Data Center Capsule (Steel Jacket + Mooring)",
         purpose="แสดงรูปทรงและองค์ประกอบของ UDC — steel jacket, mooring piles, end cap, cylinder body",
         principle="composite geometry · ฝังลึก ๓๐–๔๐ m · ปักหลักด้วย mooring 4-point",
         links="เป็น 'ของที่ต้องป้องกัน' (asset to defend) ของทั้งระบบ"),

    dict(old="18", g="จ", g_th="กำลังฝ่ายเรา (Friendly Fleet)",
         th="เซ็นเซอร์ ADCP รอบ UDC", en="ADCP Sensor Array (6 units, 1.3 nm ring)",
         purpose="ADCP คงที่ ๖ ตัวรอบ UDC วัดกระแสน้ำเป็นชั้นลึก — ใช้คำนวณ drift correction ของ torpedo/UUV",
         principle="hexagonal layout · acoustic Doppler shift · เก็บข้อมูลทุก 30 s",
         links="feed กระแสน้ำเข้าใน FLS Cone (ส่วนที่ ๒๒) และ Patrol drift compensation"),

    dict(old="19", g="จ", g_th="กำลังฝ่ายเรา (Friendly Fleet)",
         th="สินทรัพย์ชายฝั่งบนเกาะคราม", en="Coastal Defense Assets (Radar + EO/IR + Hydrophone + Guard Boat)",
         purpose="หน่วยป้องกันบนเกาะคราม — เรดาร์ผิวน้ำ, EO/IR camera, hydrophone array, guard boat",
         principle="static asset markers + sector coverage cone",
         links="เป็น 'over-the-horizon' layer ก่อน Patrol Vessels (ส่วนที่ ๒๘)"),

    dict(old="20", g="จ", g_th="กำลังฝ่ายเรา (Friendly Fleet)",
         th="Guardian UUV", en="GUUV — Guardian Unmanned Underwater Vehicle",
         purpose="UUV ฝ่ายเรา — passive sonar กวาด ๒๗๐° + FLS active ±๒๒.๕° · ใช้ thermocline ให้เปรียบ",
         principle="potential field steering · PSR = SE = SL - 2TL + TS - (NL-DI) - DT",
         links="กิน TL จาก WoaTL (ส่วนที่ ๓๖) เมื่อโหลด pipe-line ray-traced TL พร้อม"),

    dict(old="21", g="จ", g_th="กำลังฝ่ายเรา (Friendly Fleet)",
         th="เรือลาดตระเวน", en="Patrol Vessels (Race-track Pattern + 3-step ROE)",
         purpose="เรือ ตชด./ลาดตระเวน เดินวน race-track 4 WP — รับผิดชอบ outer ring + Quick Reaction Force",
         principle="waypoint navigation · 3-step ROE: warn → shoulder → engage",
         links="ทำงานเสริม Coastal Assets (ส่วนที่ ๒๖) ปิดช่องว่างนอก radar shore"),

    # ── หมวด ฉ: ภัยคุกคาม + จำแนกฝ่าย ─────────────────────────────
    dict(old="22", g="ฉ", g_th="ภัยคุกคาม + จำแนกฝ่าย",
         th="ระบบจำแนกภัย IFF + Telemetry", en="IFF Threat Display + Telemetry Trail",
         purpose="แสดงเส้น trajectory + DST (Distance·Speed·Time) ของทุก threat · จำแนก friend/foe/unknown",
         principle="trail polyline + state-color (red/yellow/green) · DST label",
         links="รับ contact จาก Sonar Sweep (ส่วนที่ ๒๐) และ AIS Anomaly (ส่วนที่ ๓)"),

    dict(old="23", g="ฉ", g_th="ภัยคุกคาม + จำแนกฝ่าย",
         th="Visual FX การระเบิด/จับเป้า", en="Explosion + Capture Animation (40-frame Ring)",
         purpose="เอฟเฟกต์ภาพเมื่อเกิดเหตุการณ์ทางยุทธวิธี — ระเบิด, จับเป้าสำเร็จ, ยิง Mk46",
         principle="expanding ring + alpha decay · ~40 frames @ 60fps = 0.67s",
         links="trigger จากทุกระบบที่มี engagement (Patrol, GUUV, ASW Heli, ESSM)"),

    # ── หมวด ช: ส่วนแสดงผล + วงรอบจำลอง ──────────────────────────
    dict(old="24", g="ช", g_th="ส่วนแสดงผล + วงรอบจำลอง",
         th="แถบมาตราส่วนแผนที่", en="Scale Bar (5 nm, Zoom-responsive)",
         purpose="แถบมาตราส่วน 5 nm มุมล่างซ้าย — ปรับตามระดับ zoom · เป็นหน่วย nautical mile (สากลการเดินเรือ)",
         principle="dynamic length based on pxPerNm()",
         links="reference สำหรับวัดระยะของ defense rings (ส่วนที่ ๑๙)"),

    dict(old="25", g="ช", g_th="ส่วนแสดงผล + วงรอบจำลอง",
         th="วงรอบการจำลองหลัก", en="Main Animation Loop (requestAnimationFrame · 60 FPS)",
         purpose="หัวใจของ simulator — เรียก update → draw → schedule ของทุก subsystem ที่ 60 FPS",
         principle="game-loop pattern · ลำดับ: physics → AI → render · ใช้ frame counter ทั่วระบบ",
         links="เรียก draw*() ทั้ง 29 ฟังก์ชันต่อเฟรม"),

    dict(old="26", g="ช", g_th="ส่วนแสดงผล + วงรอบจำลอง",
         th="ฟังก์ชันสื่อสารกับผู้ใช้ (HMI)", en="UI Helper Functions (updateStatus / addLog / setSensor / setDomain)",
         purpose="ตัวกลางระหว่าง simulator engine กับ Human-Machine Interface — สี, ไอคอน, log",
         principle="DOM manipulation · severity-color mapping · log ring-buffer 200 รายการ",
         links="ถูกเรียกจากทุก subsystem ที่ต้องแจ้งผู้ใช้"),

    dict(old="27", g="ช", g_th="ส่วนแสดงผล + วงรอบจำลอง",
         th="ระบบ Reset สถานะ", en="Reset System (Emergency Drill Reset)",
         purpose="คืนสถานะระบบทั้งหมดสู่ initial — สำหรับการฝึก/สาธิตซ้ำ",
         principle="clear all entity arrays · cancelAnimationFrame · re-initialize",
         links="callable จากปุ่ม UI หรือ keyboard shortcut"),

    dict(old="28", g="ช", g_th="ส่วนแสดงผล + วงรอบจำลอง",
         th="สถานการณ์ยุทธวิธีจำลอง", en="Tactical Scenarios (4 Pre-built Plays)",
         purpose="๔ สถานการณ์ฝึก — UUV swarm / Surface ROE / Drone / Combined Arms",
         principle="scripted spawn + trigger sequence · ใช้ promise chain คุมจังหวะ",
         links="สาธิตการทำงานของทุก subsystem ในสถานการณ์เสมือนจริง"),

    # ── หมวด ฌ: บูตและเริ่มต้นระบบ ─────────────────────────────────
    # (อยู่ก่อน WoaTL ตามลำดับใน file source)
    dict(old="29", g="ฌ", g_th="บูตและเริ่มต้นระบบ",
         th="การเริ่มต้นระบบเมื่อโหลดหน้า", en="System Initialization (initAssets / updateTide / Pre-frame Setup)",
         purpose="ลำดับการบูตเมื่อเปิดไฟล์ — โหลด tile, เริ่ม clock, init เซ็นเซอร์ทุกตัวก่อน frame แรก",
         principle="async sequential init · เริ่ม animation loop ตอนทุก asset พร้อม",
         links="entry point ของทั้ง simulator"),

    # ── หมวด ซ: ฟิสิกส์เสียงและสมการโซนาร์ (NEW) ──────────────────
    # (อยู่ท้าย file — module นี้นิยามหลัง boot block)
    dict(old=None, g="ซ", g_th="ฟิสิกส์เสียงและสมการโซนาร์",
         th="WOA23 SVP + สมการโซนาร์", en="WOA23 Sound Velocity Profile + Sonar Equation (SE = SL−2TL+TS−(NL−DI)−DT)",
         purpose="โหลด TL grid pre-computed จาก ray-tracer (build_tl_grid.py · WOA23 SVP สัตหีบ ๒๕๖๓)",
         principle="Float32 binary grid 3×3×401×101 + JSON sidecar · bilinear (range,depth) + nearest (src,freq) sampling",
         links="แทนที่ Thorp formula เดิมเมื่อ WoaTL.ready=true — ใช้ใน Sonar Eqn Panel + TL Heatmap (ส่วนที่ ๕)",
         anchor="const WoaTL = \\{"),
]

# จัด format header block (Thai numerals)
TH_DIGITS = '๐๑๒๓๔๕๖๗๘๙'
def thai_num(n):
    return ''.join(TH_DIGITS[int(d)] for d in str(n))

def build_header(idx, sec):
    n_th = thai_num(idx)
    return (
        "// ═══════════════════════════════════════════════════════════════\n"
        f"//  [ส่วนที่ {idx}] หมวด {sec['g']} — {sec['g_th']}\n"
        f"//  {sec['th']} · {sec['en']}\n"
        "// ───────────────────────────────────────────────────────────────\n"
        f"//  วัตถุประสงค์ : {sec['purpose']}\n"
        f"//  หลักการ      : {sec['principle']}\n"
        f"//  เชื่อมต่อกับ  : {sec['links']}\n"
        "// ═══════════════════════════════════════════════════════════════"
    )

def main():
    text = SRC.read_text(encoding='utf-8')
    lines = text.split('\n')
    n_orig = len(lines)

    # ── (1) ลบ marker เดิม + แทรกใหม่ตามตำแหน่ง ────────────────────
    # หา existing markers
    existing = {}    # old_num → (start_line_idx, end_line_idx_inclusive)
    re_marker = re.compile(r'^//\s*\[ส่วนที่\s*(\w+)\]')
    for i, ln in enumerate(lines):
        m = re_marker.match(ln.strip())
        if m:
            num = m.group(1)
            # ขอบเขต block: ═══ ก่อน + ═══ หลัง
            start = i
            if i > 0 and re.match(r'^//\s*═{10,}', lines[i-1].strip()): start = i-1
            end = i
            if i+1 < len(lines) and re.match(r'^//\s*═{10,}', lines[i+1].strip()): end = i+1
            existing[num] = (start, end)

    print(f"[*] Found {len(existing)} existing markers: {sorted(existing.keys())}")

    # หา anchor lines สำหรับ section ใหม่
    new_anchors = {}     # idx → line_idx ที่จะแทรกก่อนหน้า
    for idx, sec in enumerate(SECTIONS, 1):
        if sec['old'] is None:
            anchor_re = re.compile(sec['anchor'])
            found = None
            for i, ln in enumerate(lines):
                if anchor_re.search(ln):
                    # ถ้ามี ═══ block ก่อนหน้าให้ใช้ start ของ block นั้น
                    if i >= 2 and re.match(r'^//\s*═{10,}', lines[i-2].strip()):
                        found = i - 2
                    elif i >= 1 and re.match(r'^//\s*═{10,}', lines[i-1].strip()):
                        found = i - 1
                    else:
                        found = i
                    break
            if found is None:
                print(f"[!] ANCHOR NOT FOUND for new section idx={idx}: {sec['anchor']}")
                sys.exit(1)
            new_anchors[idx] = found
            print(f"[+] New section #{idx} ({sec['th']}) → line {found}")

    # ── (2) สร้างไฟล์ output: เดินจาก line 0..n และแทรก/แทนที่ ──
    # เก็บ instructions: list of (start, end, replacement_text)
    ops = []
    for idx, sec in enumerate(SECTIONS, 1):
        hdr = build_header(idx, sec)
        if sec['old'] is not None:
            if sec['old'] not in existing:
                print(f"[!] Old marker {sec['old']} not found, skip")
                continue
            s, e = existing[sec['old']]
            ops.append((s, e+1, hdr))   # replace [s..e] inclusive
        else:
            anchor = new_anchors[idx]
            # ถ้า anchor ชี้ไปที่ ═══ บรรทัด ให้แทรก "ก่อน" บรรทัดนั้น
            # แต่ถ้า anchor คือ comment block ของ feature นั้นเอง (e.g. HSV-Ext) ต้องระวังให้ insert ก่อน
            ops.append((anchor, anchor, hdr))   # insert before anchor (no removal)

    # sort by start desc เพื่อ apply จากท้ายไปต้น (ไม่ shift index)
    ops.sort(key=lambda o: o[0], reverse=True)

    out = list(lines)
    for s, e, rep in ops:
        rep_lines = rep.split('\n')
        out[s:e] = rep_lines

    new_text = '\n'.join(out)
    SRC.write_text(new_text, encoding='utf-8')
    print(f"[✓] Wrote {SRC}  (lines: {n_orig} → {len(out)})")
    print(f"[✓] Sections total: {len(SECTIONS)}")

if __name__ == '__main__':
    main()
