/* ═══════════════════════════════════════════════════════════════
   UDC SIMULATOR — Kpler AIS API Proxy
   Cloudflare Worker  ·  endpoint: /ais-latest
   ───────────────────────────────────────────────────────────────
   หน้าที่:
     1. แก้ปัญหา CORS — ให้ simulator (browser) เรียกข้อมูลได้
     2. ซ่อน API key — เก็บเป็น secret ใน Worker ไม่โผล่ใน client
     3. ใส่ header Authorization: Basic {API_KEY} ให้อัตโนมัติ
     4. Cache — ลดการเรียก API จริง (ประหยัด credit/rate limit)
     5. จำกัด origin — กันคนอื่นแอบใช้โควตา

   วิธีใช้ (Cloudflare Dashboard):
     - Workers & Pages → Create Worker → Deploy
     - Edit code → ลบของเดิม → paste โค้ดนี้ → Deploy
     - Settings → Variables → Add Secret:
         Name = KPLER_API_KEY   Value = <API key ของคุณ>

   simulator เรียก:
     https://<worker>.workers.dev/?filter=BBOX(position,99,11,102.5,14.5)&limit=500
   ═══════════════════════════════════════════════════════════════ */

// ── ตั้งค่า ──────────────────────────────────────────────────────
const ALLOWED_ORIGIN = 'https://mea09vi.github.io';      // โดเมน simulator
const KPLER_ENDPOINT = 'https://api.kpler.com/v2/maritime/ais-latest';
const CACHE_TTL      = 60;                               // cache กี่วินาที

// ── Worker ───────────────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin':
        origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // ── CORS preflight ──
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }
    if (request.method !== 'GET') {
      return json({ error: 'Method not allowed' }, 405, cors);
    }
    if (!env.KPLER_API_KEY) {
      return json({ error: 'KPLER_API_KEY secret not set' }, 500, cors);
    }

    // ── ประกอบ URL ปลายทาง — ส่ง query params ทั้งหมดต่อไป ──
    const inUrl = new URL(request.url);
    const qs    = inUrl.searchParams.toString();   // filter, format, limit, fields...
    const target = qs ? `${KPLER_ENDPOINT}?${qs}` : KPLER_ENDPOINT;

    // ── ลองอ่านจาก cache ก่อน ──
    const cacheKey = new Request(inUrl.toString(), { method: 'GET' });
    const cache = caches.default;
    let resp = await cache.match(cacheKey);
    if (resp) {
      const r = new Response(resp.body, resp);
      r.headers.set('X-Proxy-Cache', 'HIT');
      return r;
    }

    // ── เรียก Kpler API จริง (ใส่ Authorization header) ──
    try {
      const upstream = await fetch(target, {
        method: 'GET',
        headers: {
          'Authorization': 'Basic ' + env.KPLER_API_KEY,
          'Accept': 'application/json',
        },
        redirect: 'follow',
      });
      const body = await upstream.text();
      resp = new Response(body, {
        status: upstream.status,
        headers: {
          ...cors,
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${CACHE_TTL}`,
          'X-Proxy-Cache': 'MISS',
        },
      });
      if (upstream.ok) {
        ctx.waitUntil(cache.put(cacheKey, resp.clone()));
      }
      return resp;
    } catch (e) {
      return json({ error: 'Upstream fetch failed', detail: String(e) }, 502, cors);
    }
  },
};

// helper
function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
