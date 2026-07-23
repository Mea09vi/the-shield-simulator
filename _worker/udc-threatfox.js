/* ════════════════════════════════════════════════════════════════════════
   UDC_Simulator — Cyber-EM + Aviation + OSINT multi-feed relay + geocode
   (Cloudflare Worker · keyless · v7 — ?feed=threatfox | feodo | urlhaus | kev
    | aviation | ransomware | gdelt)
   ────────────────────────────────────────────────────────────────────────
   วัตถุประสงค์ : relay ฟีดสาธารณะ (keyless) ฝั่ง server ให้ UDC_Simulator
                 (file://) เรียกข้ามโดเมนได้ + batch-geocode ให้ปักหมุด "ทันที"
                 dispatch ตาม query ?feed= :
                   • threatfox (default) — ThreatFox export → ip:port + geo  (ข้าวหลามตัด/จารกรรม)
                   • feodo               — Feodo Tracker botnet C2 + geo      (สามเหลี่ยม/บอตเน็ต)
                   • urlhaus             — URLhaus malware URL + geo          (ดาว/มัลแวร์ URL)
                   • kev                 — CISA KEV (CVE ถูกโจมตีจริง)         (ticker/drawer · ไม่ geo)
                   • aviation            — adsb.lol ADS-B เครื่องบิน (v17.11.0)  (ไม่ geo · relay ตรง)
                   • ransomware (v17.11.0 CYBER-2) — ransomware.live TH victims + geo (วงกลมกุหลาบ)
                   • gdelt      (v17.11.0 CYBER-2) — GDELT DOC 2.0 ข่าวความมั่นคงทางทะเล (ไม่ geo)
   ความปลอดภัย : Worker "ไม่มี" API key/ความลับ — ThreatFox / Feodo / URLhaus /
                 CISA KEV / ip-api / adsb.lol / ransomware.live / GDELT / Cloudflare DoH
                 (cloudflare-dns.com · v7) เป็น endpoint สาธารณะ keyless ทั้งหมด. ปลอด deploy สาธารณะ
   แคช         : edge cache แยกต่อ feed (caches.default) → browser poll ซ้ำไม่ยิง upstream ใหม่
   เชื่อมโยง    : ตั้ง MDA.cfg.threatfoxProxy = '<worker-url>' ใน UDC_Simulator_17.html
                 (feodo/urlhaus/kev/aviation/ransomware/gdelt ต่อ ?feed= เองจาก base เดียวกัน —
                 ไม่ต้องตั้งค่าเพิ่ม)
   หมายเหตุ v5 (CYBER-2) : GDACS/Celestrak/thaiwater(tide,surge,wave) "ไม่" ย้ายมา Worker — ตรวจ
                 CORS response header จริงแล้วพบ Access-Control-Allow-Origin:* (GDACS/Celestrak) หรือ
                 สะท้อน Origin ทั้ง http/null (thaiwater) → direct fetch ฝั่ง client ใช้งานได้จริงอยู่แล้ว
                 ไม่ใช่ปัญหาที่ต้องแก้ (ตรวจด้วย curl -H Origin ก่อนตัดสินใจ ไม่ย้ายมั่ว)
   ════════════════════════════════════════════════════════════════════════ */

const TF_UPSTREAM = 'https://threatfox.abuse.ch/export/json/recent/';
const FEODO_CSV   = 'https://feodotracker.abuse.ch/downloads/ipblocklist_aggressive.csv';
const URLHAUS_CSV = 'https://urlhaus.abuse.ch/downloads/csv_recent/';
const KEV_JSON    = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';
const GEO_API     = 'http://ip-api.com/batch?fields=status,lat,lon,city,countryCode,isp,query';
// centerLat/centerLon = จุดกึ่งกลาง MDA.cfg.bbox (indochina/อ่าวไทย-อันดามัน lamin5.6/lomin95/lamax21/lomax108)
// ต้องตรงกับค่าที่ UDC_Simulator_17.html คำนวณเอง (MDA.Aviation) — เปลี่ยน bbox ที่นั่นต้องแก้ที่นี่ด้วย
const AVIATION_URL = 'https://api.adsb.lol/v2/lat/13.30/lon/101.50/dist/250';
// [v17.11.0 CYBER-2] ransomware.live ไม่ส่ง Access-Control-Allow-Origin เลย (ตรวจด้วย curl -H Origin จริง) → ต้อง relay
const RANSOM_URL   = 'https://api.ransomware.live/v2/countryvictims/TH';
// [v17.11.0 CYBER-2] GDELT: CORS เปิดแต่โดน 429 rate-limit เมื่อเรียกตรงถี่ๆ → รวมแคช edge ที่ Worker แทน
const GDELT_QUERY = '(sourcecountry:TH OR sourcecountry:VM OR sourcecountry:CB OR sourcecountry:BM OR sourcecountry:MY) (navy OR maritime OR military OR naval)';
const GDELT_URL   = 'https://api.gdeltproject.org/api/v2/doc/doc?query=' + encodeURIComponent(GDELT_QUERY) + '&mode=ArtList&format=json&maxrecords=25&sort=DateDesc';

const TF_N        = 150;   // ThreatFox: ip:port ล่าสุดที่ geocode (browser classify+plot ≤60)
const FEODO_DAYS  = 540;   // Feodo: เก็บเฉพาะ C2 ที่ last_online ภายใน ~18 เดือน (+ online ทั้งหมด)
const FEODO_N     = 80;    // Feodo: เพดานหมุดหลัง filter (browser plot ≤60)
const URLHAUS_N   = 120;   // URLhaus: มัลแวร์ URL ล่าสุดที่ geocode (online ก่อน · browser plot ≤80)
const KEV_N       = 60;    // KEV: จำนวน CVE ล่าสุดที่ส่งให้ drawer
const RANSOM_N    = 40;    // Ransomware TH: เหยื่อล่าสุดที่ geocode (ตรงกับ client MAX_PLOT เดิม)

const TF_TTL       = 900;    // 15 นาที (ThreatFox อัปเดต ~5 นาที)
const FEODO_TTL    = 3600;   // 1 ชม. (Feodo อัปเดตช้า)
const URLHAUS_TTL  = 600;    // 10 นาที (URLhaus อัปเดตถี่ ~5 นาที)
const KEV_TTL      = 3600;   // 1 ชม. (CISA KEV อัปเดต ~รายวัน)
const AVIATION_TTL = 45;     // 45 วิ (เครื่องบินเคลื่อนไว · client poll ทุก 60 วิ)
const RANSOM_TTL   = 1700;   // ~28 นาที (client poll 30 นาที)
const GDELT_TTL    = 280;    // ~4.7 นาที (client poll 5 นาที)

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS, ...extra },
  });
}

// ── ip-api batch geocode (ก้อนละ 100) → { ip: {lat,lon,city,cc,isp} }
async function geocodeAll(ips) {
  const map = {};
  for (let i = 0; i < ips.length; i += 100) {
    const chunk = ips.slice(i, i + 100);
    try {
      const gr = await fetch(GEO_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk),
      });
      if (!gr.ok) continue;
      const ga = await gr.json();
      for (const g of (Array.isArray(ga) ? ga : [])) {
        if (g && g.status === 'success' && typeof g.lat === 'number') {
          map[g.query] = { lat: g.lat, lon: g.lon, city: g.city || '', cc: g.countryCode || '', isp: g.isp || '' };
        }
      }
    } catch (_) { /* ก้อนนี้พลาด → ข้าม */ }
  }
  return map;
}

// [v17.19.1 CYBER-3] แปลงชื่อโฮสต์ → IPv4 ด้วย DNS-over-HTTPS ของ Cloudflare (keyless ไม่มี API key)
//   เหตุผล : ip-api /batch "รับเฉพาะ IP" ไม่รับชื่อโดเมน — ของเดิมยิงชื่อโดเมนเข้า /batch ตรง ๆ
//            ทำให้ทุกระเบียนได้ status:"fail" → geo ว่าง → buildRansomware ตัดทิ้งหมด → คืน []
//            ทั้งที่ต้นทางมีเหยื่อไทยจริง 179 ราย (ตรวจ 23 ก.ค. 69 · ล่าสุด 2026-07-01)
//   คืนค่า  : { host → ip } เฉพาะที่ resolve สำเร็จ (พลาด = ไม่ใส่คีย์ ให้ผู้เรียกตัดสินใจเอง)
async function resolveHosts(hosts) {
  const map = {};
  const one = async (h) => {
    try {
      const r = await fetch('https://cloudflare-dns.com/dns-query?type=A&name=' + encodeURIComponent(h),
        { headers: { 'Accept': 'application/dns-json' } });
      if (!r.ok) return;
      const j = await r.json();
      const a = (j && Array.isArray(j.Answer)) ? j.Answer.find(x => x && x.type === 1 && x.data) : null;
      if (a) map[h] = String(a.data).trim();
    } catch (_) { /* โฮสต์นี้ resolve ไม่ได้ (โดเมนถูกถอด/NXDOMAIN) → ข้าม */ }
  };
  for (let i = 0; i < hosts.length; i += 10) {          // ยิงทีละ 10 กัน subrequest burst
    await Promise.all(hosts.slice(i, i + 10).map(one));
  }
  return map;
}

/* ─────────────── FEED: threatfox (จารกรรม · ข้าวหลามตัด) ─────────────── */

// ThreatFox export = object-keyed (id → [ioc,...]) → array แบน
function flatten(j) {
  if (Array.isArray(j)) return j;
  const out = [];
  if (j && typeof j === 'object') {
    for (const k in j) {
      const v = j[k];
      if (Array.isArray(v)) out.push(...v);
      else if (v) out.push(v);
    }
  }
  return out;
}

async function buildThreatfox() {
  const up = await fetch(TF_UPSTREAM, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'UDC-Simulator/17 (+threatfox-relay)' },
    cf: { cacheTtl: TF_TTL, cacheEverything: true },
  });
  if (!up.ok) return json({ status: 'error', error: 'upstream ' + up.status }, 502);

  const raw = await up.json();
  const recs = flatten(raw)
    .filter(x => x && x.ioc_type === 'ip:port' && x.ioc_value)
    .sort((a, b) => String(b.first_seen_utc || b.last_seen_utc || '')
                      .localeCompare(String(a.first_seen_utc || a.last_seen_utc || '')))
    .slice(0, TF_N)
    .map(x => ({
      ioc_type:          x.ioc_type,
      ioc_value:         x.ioc_value,
      malware:           x.malware || '',
      malware_printable: x.malware_printable || '',
      confidence_level:  x.confidence_level,
      first_seen_utc:    x.first_seen_utc || '',
      tags:              Array.isArray(x.tags) ? x.tags.slice(0, 8) : [],
      reference:         x.reference || '',
    }));

  const ips = [...new Set(recs.map(r => String(r.ioc_value).split(':')[0].trim()).filter(Boolean))];
  const geo = await geocodeAll(ips);

  const out = [];
  for (const r of recs) {
    const ip = String(r.ioc_value).split(':')[0].trim();
    const g = geo[ip];
    if (g) { r.geo = g; out.push(r); }
  }
  return json(out, 200, {
    'Cache-Control': 'public, max-age=' + TF_TTL,
    'X-Relay-Count': String(out.length),
  });
}

/* ─────────────── FEED: feodo (บอตเน็ต C2 · สามเหลี่ยม) ─────────────── */

// CSV → แถวๆ (ตัด comment/header · แยกด้วย comma · ถอด quote)
function parseFeodoCsv(text) {
  const rows = [];
  for (const line0 of text.split('\n')) {
    const line = line0.trim();
    if (!line || line[0] === '#') continue;
    if (line.indexOf('first_seen_utc') !== -1) continue;   // header
    const c = line.split(',').map(s => s.replace(/^"|"$/g, '').trim());
    if (c.length < 6 || !c[1]) continue;
    rows.push({ first_seen: c[0], ip: c[1], port: c[2], status: c[3], last_online: c[4], malware: c[5] });
  }
  return rows;
}

async function buildFeodo() {
  const up = await fetch(FEODO_CSV, {
    headers: { 'Accept': 'text/csv', 'User-Agent': 'UDC-Simulator/17 (+feodo-relay)' },
    cf: { cacheTtl: FEODO_TTL, cacheEverything: true },
  });
  if (!up.ok) return json({ status: 'error', error: 'upstream ' + up.status }, 502);

  const rows = parseFeodoCsv(await up.text());
  const cutoff = Date.now() - FEODO_DAYS * 86400_000;
  const recs = rows
    .filter(r => {
      if ((r.status || '').toLowerCase() === 'online') return true;   // online เก็บเสมอ
      const t = Date.parse((r.last_online || '').replace(' ', 'T') + 'Z');
      return !isNaN(t) && t >= cutoff;
    })
    .sort((a, b) => String(b.last_online || '').localeCompare(String(a.last_online || '')))
    .slice(0, FEODO_N);

  const ips = [...new Set(recs.map(r => String(r.ip).trim()).filter(Boolean))];
  const geo = await geocodeAll(ips);

  const out = [];
  let online = 0;
  for (const r of recs) {
    const g = geo[String(r.ip).trim()];
    if (!g) continue;
    if ((r.status || '').toLowerCase() === 'online') online++;
    out.push({
      ip: r.ip, port: r.port, malware: r.malware, status: r.status,
      first_seen: r.first_seen, last_online: r.last_online, geo: g,
    });
  }
  return json(out, 200, {
    'Cache-Control': 'public, max-age=' + FEODO_TTL,
    'X-Relay-Count':  String(out.length),
    'X-Online-Count': String(online),
  });
}

/* ─────────────── FEED: urlhaus (มัลแวร์ URL · ดาว) ─────────────── */

// URLhaus recent CSV — ทุก field ครอบ double-quote · header เป็น comment (# id,dateadded,url,...)
// อ่าน index จาก header comment → ทนต่อการสลับ/เพิ่มคอลัมน์
function parseUrlhausCsv(text) {
  let idx = null;
  const rows = [];
  for (const line0 of text.split('\n')) {
    const line = line0.replace(/\r$/, '');
    if (!line) continue;
    if (line[0] === '#') {
      const h = line.replace(/^#\s*/, '');
      if (idx === null && h.indexOf('dateadded') !== -1 && h.indexOf('url') !== -1) {
        idx = {};
        h.split(',').forEach((k, i) => { idx[k.trim()] = i; });
      }
      continue;
    }
    if (!idx) continue;
    const c = line.replace(/^"/, '').replace(/"$/, '').split('","');   // field ครอบ quote → split บน ","
    const get = (k) => { const i = idx[k]; return (i != null && i < c.length) ? c[i] : ''; };
    const url = get('url');
    if (!url) continue;
    rows.push({
      id:          get('id'),
      dateadded:   get('dateadded'),
      url,
      status:      get('url_status'),
      last_online: get('last_online'),
      threat:      get('threat'),
      tags:        get('tags'),
      reporter:    get('reporter'),
    });
  }
  return rows;
}

async function buildUrlhaus() {
  const up = await fetch(URLHAUS_CSV, {
    headers: { 'Accept': 'text/csv', 'User-Agent': 'UDC-Simulator/17 (+urlhaus-relay)' },
    cf: { cacheTtl: URLHAUS_TTL, cacheEverything: true },
  });
  if (!up.ok) return json({ status: 'error', error: 'upstream ' + up.status }, 502);

  const rows = parseUrlhausCsv(await up.text());
  for (const r of rows) {
    try { r.host = new URL(r.url).hostname.replace(/^\[|\]$/g, ''); }   // ตัดวงเล็บ IPv6
    catch (_) { r.host = ''; }
  }
  const recs = rows
    .filter(r => r.host)
    .sort((a, b) => {
      const ao = (a.status || '').toLowerCase() === 'online' ? 0 : 1;
      const bo = (b.status || '').toLowerCase() === 'online' ? 0 : 1;
      if (ao !== bo) return ao - bo;                                     // online ก่อน
      return String(b.dateadded || '').localeCompare(String(a.dateadded || '')); // แล้วใหม่สุด
    })
    .slice(0, URLHAUS_N);

  const hosts = [...new Set(recs.map(r => r.host).filter(Boolean))];     // ip-api /batch รับ domain (resolve ให้)
  const geo = await geocodeAll(hosts);

  const out = [];
  let online = 0;
  for (const r of recs) {
    const g = geo[r.host];
    if (!g) continue;
    if ((r.status || '').toLowerCase() === 'online') online++;
    out.push({
      url:         String(r.url).slice(0, 200),
      host:        r.host,
      status:      r.status,
      threat:      r.threat,
      tags:        String(r.tags || '').slice(0, 80),
      dateadded:   r.dateadded,
      last_online: r.last_online,
      geo:         g,
    });
  }
  return json(out, 200, {
    'Cache-Control': 'public, max-age=' + URLHAUS_TTL,
    'X-Relay-Count':  String(out.length),
    'X-Online-Count': String(online),
  });
}

/* ─────────────── FEED: kev (CISA KEV · CVE ถูกโจมตีจริง) ─────────────── */

async function buildKev() {
  const up = await fetch(KEV_JSON, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'UDC-Simulator/17 (+kev-relay)' },
    cf: { cacheTtl: KEV_TTL, cacheEverything: true },
  });
  if (!up.ok) return json({ status: 'error', error: 'upstream ' + up.status }, 502);

  const raw  = await up.json();
  const vulns = Array.isArray(raw.vulnerabilities) ? raw.vulnerabilities : [];
  const cutoff = Date.now() - 30 * 86400_000;
  let count30d = 0, ransomTotal = 0;
  for (const v of vulns) {
    const t = Date.parse(v.dateAdded);
    if (!isNaN(t) && t >= cutoff) count30d++;
    if ((v.knownRansomwareCampaignUse || '') === 'Known') ransomTotal++;
  }

  const items = vulns
    .slice()
    .sort((a, b) => String(b.dateAdded || '').localeCompare(String(a.dateAdded || '')))
    .slice(0, KEV_N)
    .map(v => ({
      cveID:     v.cveID || '',
      vendor:    v.vendorProject || '',
      product:   v.product || '',
      name:      v.vulnerabilityName || '',
      dateAdded: v.dateAdded || '',
      dueDate:   v.dueDate || '',
      ransom:    (v.knownRansomwareCampaignUse || '') === 'Known',
      desc:      String(v.shortDescription || '').slice(0, 320),
    }));

  return json({
    catalogVersion: raw.catalogVersion || '',
    dateReleased:   raw.dateReleased || '',
    total:          raw.count || vulns.length,
    count30d,
    ransomTotal,
    items,
  }, 200, {
    'Cache-Control': 'public, max-age=' + KEV_TTL,
    'X-KEV-Count': String(items.length),
  });
}

/* ─────────────── FEED: aviation (ADS-B เครื่องบิน · adsb.lol) ─────────────── */

// adsb.lol ไม่ส่ง Access-Control-Allow-Origin → browser (file://) block direct เสมอ
// relay ผ่าน Worker (server-to-server ไม่ติด CORS) แทนที่ direct/CORS-proxy client-side
// ตัดเหลือเฉพาะ field ที่ client ใช้จริง (MDA.Aviation) ลด payload
async function buildAviation() {
  const up = await fetch(AVIATION_URL, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'UDC-Simulator/17 (+aviation-relay)' },
    cf: { cacheTtl: AVIATION_TTL, cacheEverything: true },
  });
  if (!up.ok) return json({ status: 'error', error: 'upstream ' + up.status }, 502);

  const raw = await up.json();
  const ac = Array.isArray(raw.ac) ? raw.ac : [];
  const out = ac
    .filter(a => a && a.lat != null && a.lon != null)
    .map(a => ({
      hex: a.hex, flight: a.flight || '', lat: a.lat, lon: a.lon,
      track: a.track, alt_baro: a.alt_baro, gs: a.gs,
      r: a.r || '', t: a.t || '',
    }));

  return json({ ac: out }, 200, {
    'Cache-Control': 'public, max-age=' + AVIATION_TTL,
    'X-Relay-Count': String(out.length),
  });
}

/* ─────────────── FEED: ransomware (เหยื่อไทย · วงกลมกุหลาบ) ─────────────── */

// [v17.11.0 CYBER-2] ransomware.live ไม่ส่ง ACAO เลย (ยืนยันด้วย curl -H Origin) → ไม่มี direct fallback
// geocode โดเมนโฮสติ้งฝั่ง server เหมือน Feodo/URLhaus (ip-api /batch รับ domain resolve ให้)
async function buildRansomware() {
  const up = await fetch(RANSOM_URL, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'UDC-Simulator/17 (+ransomware-relay)' },
    cf: { cacheTtl: RANSOM_TTL, cacheEverything: true },
  });
  if (!up.ok) return json({ status: 'error', error: 'upstream ' + up.status }, 502);

  const raw = await up.json();
  const arr = Array.isArray(raw) ? raw : ((raw && (raw.victims || raw.data || raw.result)) || []);
  const recs = arr
    .filter(v => v && v.website)
    .sort((a, b) => String(b.published || b.discovered || '').localeCompare(String(a.published || a.discovered || '')))
    .slice(0, RANSOM_N);
  for (const r of recs) {
    r.domain = String(r.website || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim().toLowerCase();
  }

  // [v17.19.1 CYBER-3] resolve ชื่อโดเมน → IP ก่อน แล้วค่อย geocode ด้วย IP (ip-api /batch ไม่รับชื่อโฮสต์)
  const doms = [...new Set(recs.map(r => r.domain).filter(Boolean))];
  const ipOf = await resolveHosts(doms);
  const geo  = await geocodeAll([...new Set(Object.values(ipOf))]);

  const out = [];
  for (const r of recs) {
    // [v17.19.1 CYBER-3] geocode พลาด → ส่งระเบียนต่อพร้อม geo:null (เดิม `continue` ทิ้งทั้งชุด
    //   ทำให้ "จำนวนเหยื่อไทย" เป็นศูนย์เท็จ) — ฝั่ง client ข้ามการปักหมุดเองอยู่แล้วถ้าไม่มีพิกัด
    const ip = ipOf[r.domain] || null;
    const g  = (ip && geo[ip]) ? geo[ip] : null;
    out.push({
      domain:    r.domain,
      post_title: r.post_title || '',
      group_name: r.group_name || '',
      activity:   r.activity || '',
      published:  r.published || r.discovered || '',
      geo: g,
    });
  }
  return json(out, 200, {
    'Cache-Control': 'public, max-age=' + RANSOM_TTL,
    'X-Relay-Count': String(out.length),
  });
}

/* ─────────────── FEED: gdelt (ข่าวความมั่นคงทางทะเล · ไม่ geo) ─────────────── */

// [v17.11.0 CYBER-2] GDELT CORS เปิดอยู่แล้ว แต่โดน 429 เมื่อยิงตรงถี่ๆ (ยืนยันด้วย curl) →
// รวมมาแคชที่ Worker (edge cache ต่อผู้ใช้ทุกคนร่วมกัน) ลดจำนวนครั้งที่ยิง origin จริง
async function buildGdelt() {
  const up = await fetch(GDELT_URL, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'UDC-Simulator/17 (+gdelt-relay)' },
    cf: { cacheTtl: GDELT_TTL, cacheEverything: true },
  });
  if (!up.ok) return json({ status: 'error', error: 'upstream ' + up.status }, 502);

  const raw = await up.json();
  const arts = Array.isArray(raw.articles) ? raw.articles : [];
  return json({ articles: arts }, 200, {
    'Cache-Control': 'public, max-age=' + GDELT_TTL,
    'X-Relay-Count': String(arts.length),
  });
}

/* ─────────────── dispatch + edge cache ─────────────── */

const FEEDS = {
  threatfox:  { build: buildThreatfox,  ttl: TF_TTL },
  feodo:      { build: buildFeodo,      ttl: FEODO_TTL },
  urlhaus:    { build: buildUrlhaus,    ttl: URLHAUS_TTL },
  kev:        { build: buildKev,        ttl: KEV_TTL },
  aviation:   { build: buildAviation,   ttl: AVIATION_TTL },
  ransomware: { build: buildRansomware, ttl: RANSOM_TTL },
  gdelt:      { build: buildGdelt,      ttl: GDELT_TTL },
};

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (request.method !== 'GET')     return json({ status: 'error', error: 'method' }, 405);

    const url  = new URL(request.url);
    const feed = (url.searchParams.get('feed') || 'threatfox').toLowerCase();
    const spec = FEEDS[feed];
    if (!spec) return json({ status: 'error', error: 'unknown feed: ' + feed }, 400);

    // edge cache ต่อ feed (คีย์คงที่ · ไม่สน query อื่น)
    // v6: bump จาก v3 → บังคับ cache miss รอบเดียวหลัง deploy (แก้บั๊ก stale cache ค้าง [] จากดราฟต์ก่อนหน้า
    //     ที่ ransomware/gdelt geocode ชน rate-limit ตอนทดสอบ แล้วผล [] ถูกแคชด้วย Cache-Control เดิม)
    // v7 [v17.19.1 CYBER-3]: bump v6→v7 บังคับล้างแคช [] ของ ransomware ที่ค้างจากบั๊ก geocode ชื่อโฮสต์
    const cache = caches.default;
    const cacheKey = new Request(url.origin + '/__cache/cyberem-v7-' + feed, { method: 'GET' });
    const hit = await cache.match(cacheKey);
    if (hit) return hit;

    let resp;
    try { resp = await spec.build(); }
    catch (e) { return json({ status: 'error', error: String(e && e.message || e) }, 500); }

    if (resp.status === 200 && ctx && ctx.waitUntil) ctx.waitUntil(cache.put(cacheKey, resp.clone()));
    return resp;
  },
};

/* ════════════════════════════════════════════════════════════════════════
   อัปเดต Worker (v6 → v7) — วางทับทั้งไฟล์:
   ⚠️ v7 บังคับ deploy ใหม่ [v17.19.1 CYBER-3]: cache key เปลี่ยน v6→v7 พร้อมแก้บั๊ก ?feed=ransomware
      คืน [] ถาวร — ต้นเหตุคือส่ง "ชื่อโดเมน" เข้า ip-api /batch ซึ่งรับเฉพาะ IP ทุกระเบียนจึง
      status:"fail" แล้วถูก `if (!g) continue` ตัดทิ้งหมด (ต้นทางมีเหยื่อไทยจริง 179 ราย ตรวจ
      23 ก.ค. 69) → v7 เพิ่ม resolveHosts() ใช้ Cloudflare DoH (keyless) แปลงโฮสต์เป็น IP ก่อน
      geocode และส่งระเบียนต่อพร้อม geo:null เมื่อ geocode พลาด (ไม่ตัดทิ้ง = ไม่รายงานศูนย์เท็จ)
   ⚠️ ก่อนหน้า v6: cache key เปลี่ยน v3→v6 (บั๊ก stale-cache ค้าง [] ที่ ransomware/
      gdelt เพราะดราฟต์ก่อนหน้าตอนทดสอบ geocode ชน rate-limit แล้วผล [] ถูกแคชค้างข้าม deploy) —
   1. dash.cloudflare.com → Workers & Pages → เปิด worker  udc-threatfox
   2. Edit code → Ctrl+A ลบทั้งหมด → วางไฟล์นี้ทั้งไฟล์ → Save and deploy
   3. ทดสอบ 7 URL ในเบราว์เซอร์ :
      • https://udc-threatfox.rey-mysawa.workers.dev                     → [{"ioc_type":"ip:port",...,"geo":{...}}]
      • https://udc-threatfox.rey-mysawa.workers.dev/?feed=feodo         → [{"ip":..,"malware":..,"status":..,"geo":{...}}]
      • https://udc-threatfox.rey-mysawa.workers.dev/?feed=urlhaus       → [{"url":..,"host":..,"status":..,"threat":..,"geo":{...}}]
      • https://udc-threatfox.rey-mysawa.workers.dev/?feed=kev           → {"catalogVersion":..,"count30d":..,"items":[...]}
      • https://udc-threatfox.rey-mysawa.workers.dev/?feed=aviation      → {"ac":[{"hex":..,"flight":..,"lat":..,"lon":..,...}]}
      • https://udc-threatfox.rey-mysawa.workers.dev/?feed=ransomware    → [{"domain":..,"post_title":..,"group_name":..,"geo":{...}}]
      • https://udc-threatfox.rey-mysawa.workers.dev/?feed=gdelt         → {"articles":[{"title":..,"domain":..,"url":..,...}]}
   (ฝั่ง UDC_Simulator_17.html ตั้ง MDA.cfg.threatfoxProxy ไว้แล้ว — feodo/urlhaus/kev/aviation/ransomware/gdelt ต่อ ?feed= เอง)
   ════════════════════════════════════════════════════════════════════════ */
