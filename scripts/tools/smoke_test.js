/**
 * smoke_test.js — ตรวจว่า "ตัวจำลองยังบูตขึ้น" หลังแก้ไฟล์
 * ══════════════════════════════════════════════════════════════
 * UDC_Simulator_17.html เป็นไฟล์เดียว ๕๖,๐๐๐ บรรทัด ไม่มีชุดทดสอบ
 * check_js_syntax.js ตรวจได้แค่ไวยากรณ์ — ผ่านได้ทั้งที่แอปพังตอนรัน
 * สคริปต์นี้เปิดไฟล์จริงในเบราว์เซอร์ แล้วรายงาน error ตอนรัน
 *
 * ── ใช้อย่างไร ──────────────────────────────────────────────
 *   npm i playwright-core          (ครั้งเดียว)
 *   node scripts/tools/smoke_test.js
 *   node scripts/tools/smoke_test.js --shot out.png    (เก็บภาพหน้าจอ)
 *
 * ── ข้อกำหนด ────────────────────────────────────────────────
 * ★ ต้องต่ออินเทอร์เน็ตถึง CDN ได้ (unpkg / cdnjs / jsdelivr / fonts)
 *   เพราะ Leaflet · Three.js · Chart.js โหลดจาก CDN ถ้าเน็ตถูกบล็อก
 *   จะได้ ReferenceError: L is not defined เป็นทอด ๆ ซึ่งเป็นผลจาก
 *   เน็ต ไม่ใช่บั๊กของแอป — สคริปต์จะเตือนให้เมื่อเจอรูปแบบนี้
 *
 * ── สิ่งที่ตรวจได้ / ไม่ได้ ──────────────────────────────────
 *   ตรวจได้  : uncaught error ตอนบูต · ไฟล์ที่โหลดไม่สำเร็จ · จำนวน
 *              DOM/canvas/panel ที่ประกอบขึ้นจริง · เวลาบูต · heap
 *   ตรวจไม่ได้: "สวยหรือไม่" · สีถูกตามหลักนิยมหรือไม่ · ฟีเจอร์ทำงานถูกไหม
 *              (ต้องดูด้วยตาหรือเขียน assertion เพิ่มเอง)
 */
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const TARGET = process.env.SMOKE_TARGET || 'index.html';
const SETTLE = Number(process.env.SMOKE_SETTLE || 12000);   // รอ boot sequence
const shotIdx = process.argv.indexOf('--shot');
const SHOT = shotIdx > -1 ? process.argv[shotIdx + 1] : null;

let chromium;
try { ({ chromium } = require('playwright-core')); }
catch { console.error('ต้องติดตั้งก่อน:  npm i playwright-core'); process.exit(2); }

(async () => {
  const launch = { args: ['--no-sandbox', '--disable-dev-shm-usage'] };
  if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;

  const browser = await chromium.launch(launch);
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  const errors = [], failed = [], warns = [];
  page.on('console', m => {
    const t = m.text().slice(0, 200);
    if (m.type() === 'error') errors.push(t);
    else if (m.type() === 'warning') warns.push(t);
  });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + String(e).slice(0, 200)));
  page.on('requestfailed', r => failed.push(r.url().slice(0, 110)));

  const t0 = Date.now();
  await page.goto('file://' + path.join(ROOT, TARGET), { waitUntil: 'domcontentloaded', timeout: 60000 });
  const domReady = Date.now() - t0;
  await page.waitForTimeout(SETTLE);

  const s = await page.evaluate(() => ({
    version: (typeof APP_VERSION !== 'undefined') ? APP_VERSION : 'n/a',
    dom: document.getElementsByTagName('*').length,
    canvases: document.querySelectorAll('canvas').length,
    panels: document.querySelectorAll('.panel').length,
    theme: document.body.getAttribute('data-theme') || '(default)',
    heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
  }));

  const uniq = a => [...new Set(a)];
  console.log(`--- ${TARGET} ---`);
  console.log(`  APP_VERSION     : ${s.version}`);
  console.log(`  domcontentloaded: ${domReady} ms`);
  console.log(`  DOM / canvas / panel : ${s.dom} / ${s.canvases} / ${s.panels}`);
  console.log(`  theme           : ${s.theme}`);
  if (s.heap != null) console.log(`  JS heap         : ${s.heap} MB`);

  const uErr = uniq(errors), uFail = uniq(failed);
  // แยก error ที่เกิดเพราะ CDN ถูกบล็อก ออกจากบั๊กจริง
  const cdnBlocked = uFail.some(u => /unpkg|cdnjs|jsdelivr|fonts\.googleapis/.test(u));

  console.log(`\n  console errors  : ${uErr.length}`);
  uErr.slice(0, 20).forEach(e => console.log('    ! ' + e));
  console.log(`  failed requests : ${uFail.length}`);
  uFail.slice(0, 20).forEach(f => console.log('    x ' + f));
  if (warns.length) {
    console.log(`  warnings        : ${uniq(warns).length}`);
    uniq(warns).slice(0, 10).forEach(w => console.log('    ~ ' + w));
  }

  if (SHOT) { await page.screenshot({ path: SHOT, fullPage: false }); console.log(`\n  ภาพหน้าจอ -> ${SHOT}`); }
  await browser.close();

  if (cdnBlocked) {
    console.log('\n⚠  เข้าถึง CDN ไม่ได้ — error ตอนรันข้างบนส่วนใหญ่เป็นผลสืบเนื่อง');
    console.log('   (L / THREE / Chart ไม่ถูกนิยาม) ไม่ใช่บั๊กของตัวจำลอง');
    console.log('   รันใหม่บนเครื่องที่ต่อเน็ตได้จึงจะสรุปผลได้');
    process.exit(0);
  }
  if (uErr.length) { console.log('\n✗ พบ error ตอนรัน'); process.exit(1); }
  console.log('\n✓ บูตผ่าน ไม่มี error ตอนรัน');
})().catch(e => { console.error('สคริปต์ล้มเหลว:', e.message); process.exit(2); });
