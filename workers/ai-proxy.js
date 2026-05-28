/* ════════════════════════════════════════════════════════════════════
   THE SHIELD 2.0 — UDC Simulator v14.0.4
   AI Proxy Worker · Cloudflare Workers
   ──────────────────────────────────────────────────────────────────────
   Purpose : ตัวกลาง (relay) ระหว่าง client (UDC Simulator) กับ
             Anthropic Messages API (Claude Opus)
   Why     : ป้องกัน API key หลุดสู่ client-side เพราะ repo เป็น public
             — key ถูกเก็บเป็น Worker Secret (ANTHROPIC_API_KEY)

   Endpoints
   ─────────
     POST /              → forward เป็น Anthropic /v1/messages
                           (รับ body: { mode, taxonomy, alerts })
                           ส่งกลับ: { text, model, usage, latency_ms }
     GET  /health        → liveness probe { ok: true, version }
     OPTIONS /*          → CORS preflight

   Security
   ────────
     • API key อยู่ใน env.ANTHROPIC_API_KEY (Worker Secret) — ไม่อยู่ใน code
     • CORS ตอบกลับ Allow-Origin: * (ไฟล์ HTML เปิดใช้ทั้ง file:// และ http)
       → ถ้าต้องการ harden ในอนาคต ปรับเป็น domain เฉพาะ
     • Rate limit ขั้นต้น 30 req/min per IP (in-memory map · per-isolate)

   Deploy
   ──────
     1. ติดตั้ง wrangler:           npm i -g wrangler
     2. login:                      wrangler login
     3. เพิ่ม secret:               wrangler secret put ANTHROPIC_API_KEY
     4. deploy:                     wrangler deploy
     5. คัดลอก URL (xxx.workers.dev) → ตั้งใน UDC Simulator ผ่านปุ่ม ⚙
   ════════════════════════════════════════════════════════════════════ */

const VERSION = '14.0.4';
const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-opus-4-20250514';   // อัพเดทเมื่อมี Opus รุ่นใหม่
const MAX_TOKENS = 1500;

// ── rate limit (simple, per-isolate in-memory) ───────────────────────
const RL_BUCKET = new Map();  // ip → [timestamps...]
const RL_WINDOW_MS = 60_000;
const RL_LIMIT = 30;

function rateLimited(ip) {
    const now = Date.now();
    const arr = (RL_BUCKET.get(ip) || []).filter(t => now - t < RL_WINDOW_MS);
    arr.push(now);
    RL_BUCKET.set(ip, arr);
    return arr.length > RL_LIMIT;
}

// ── CORS headers ─────────────────────────────────────────────────────
const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
};

function jsonResponse(obj, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(obj), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            ...CORS,
            ...extraHeaders
        }
    });
}

// ── prompt builder ───────────────────────────────────────────────────
function buildSystemPrompt() {
    return [
        'คุณคือนักวิเคราะห์ Maritime Domain Awareness (MDA) ของไทย — ทำหน้าที่ช่วย',
        'ผู้บัญชาการเรือ/ศูนย์ปฏิบัติการในการประเมินภัยคุกคามทางทะเลรอบ',
        'Undersea Data Center (UDC) ที่สัตหีบ น่านน้ำไทย',
        '',
        'ขอบเขตและกฎ:',
        '• ผลลัพธ์ของคุณเป็น "Decision Support" — ไม่ใช่ autonomous decision',
        '  (สอดคล้องกับ DoD Directive 3000.09 และ IMO MASS Code Level III-A)',
        '• อ้างอิงกรอบกฎหมาย: UNCLOS Art.60(5) safety zone 500 m,',
        '  พ.ร.บ.เขตปลอดภัย 2478, พ.ร.บ.ผลประโยชน์ฯ 2562 (ศรชล.),',
        '  PDPA เมื่อพูดถึงข้อมูลพลเรือน',
        '• กล่าวถึงนโยบายอ้างอิงที่เกี่ยวข้อง: ศรชล. 5-year plan 2566-2570,',
        '  MDAWG 01/2025, NATO Mainsail (ก.พ.2025)',
        '• Taxonomy 5 มิติ: Physical-Kinetic, Asymmetric/Grey-Zone,',
        '  Cyber-Physical, Environmental, Hybrid',
        '',
        'รูปแบบคำตอบ (ภาษาไทยเป็นหลัก คำศัพท์เทคนิคใช้อังกฤษ):',
        '🧠 OPUS ANALYSIS · <hh:mm:ss>',
        '═══════════════════════════════════════════',
        '',
        '🔍 บริบทเชิงระบบ:',
        '<2–3 บรรทัด สรุปสถานการณ์โดยรวม>',
        '',
        '📊 การประเมินความเสี่ยง:',
        '<ระดับความเสี่ยง HIGH/ELEVATED/ROUTINE + คำแนะนำต่อ ROE>',
        '',
        '⚖️ ข้อพิจารณาทางกฎหมาย:',
        '<2–3 bullets — อ้าง law/policy อย่างเฉพาะเจาะจง>',
        '',
        '🛡️ ข้อจำกัด (caveats):',
        '<HITL, confidence, MASS Code level>'
    ].join('\n');
}

function buildUserPrompt(payload) {
    const tax = payload.taxonomy || {};
    const alerts = (payload.alerts || []).slice(0, 12);
    const ts = new Date().toISOString();
    const lines = [
        `[Time UTC] ${ts}`,
        '',
        '[Threat Taxonomy counts]',
        `• Physical-Kinetic        : ${tax.kinetic || 0}`,
        `• Asymmetric/Grey-Zone    : ${tax.asymmetric || 0}`,
        `• Cyber-Physical          : ${tax.cyber || 0}`,
        `• Environmental           : ${tax.environmental || 0}`,
        `• Hybrid (multi-vector)   : ${tax.hybrid || 0}`,
        '',
        '[Recent alerts] (sorted newest first)'
    ];
    if (!alerts.length) {
        lines.push('  (ไม่มี alert ในห้วงเวลานี้ — สภาพการณ์ปกติ)');
    } else {
        for (const a of alerts) {
            const conf = a.conf != null ? Math.round(a.conf * 100) + '%' : '?';
            lines.push(`  • [${a.severity || '?'} ${a.tag || '?'}] ${a.msg || ''} (conf ${conf}, ts ${a.ts || '?'})`);
        }
    }
    lines.push('');
    lines.push('โปรดให้การวิเคราะห์เชิงลึกตามรูปแบบที่กำหนดในระบบพร้อมท์');
    return lines.join('\n');
}

// ── main handler ─────────────────────────────────────────────────────
async function handleOpusAnalysis(request, env) {
    if (!env.ANTHROPIC_API_KEY) {
        return jsonResponse({ error: 'ANTHROPIC_API_KEY not configured on Worker' }, 500);
    }

    let payload;
    try {
        payload = await request.json();
    } catch (_) {
        return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const model = payload.model || DEFAULT_MODEL;
    const system = buildSystemPrompt();
    const userMsg = buildUserPrompt(payload);

    const t0 = Date.now();
    let upstream;
    try {
        upstream = await fetch(ANTHROPIC_API, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': env.ANTHROPIC_API_KEY,
                'anthropic-version': ANTHROPIC_VERSION
            },
            body: JSON.stringify({
                model,
                max_tokens: MAX_TOKENS,
                system,
                messages: [{ role: 'user', content: userMsg }]
            })
        });
    } catch (e) {
        return jsonResponse({ error: 'Upstream fetch failed', detail: String(e) }, 502);
    }

    const latency_ms = Date.now() - t0;
    const upstreamJson = await upstream.json().catch(() => null);

    if (!upstream.ok) {
        return jsonResponse({
            error: 'Upstream error',
            status: upstream.status,
            detail: upstreamJson || null,
            latency_ms
        }, upstream.status);
    }

    // Extract text from Anthropic response shape:
    //   { content: [{ type:'text', text:'...' }], model, usage:{input_tokens,output_tokens}, stop_reason }
    const text = (upstreamJson?.content || [])
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('\n');

    return jsonResponse({
        text,
        model: upstreamJson?.model || model,
        usage: upstreamJson?.usage || null,
        stop_reason: upstreamJson?.stop_reason || null,
        latency_ms,
        version: VERSION
    });
}

// ── Worker entry ─────────────────────────────────────────────────────
export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        // CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: CORS });
        }

        // health
        if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
            return jsonResponse({
                ok: true,
                service: 'shield-ai-proxy',
                version: VERSION,
                model_default: DEFAULT_MODEL
            });
        }

        // main
        if (request.method === 'POST') {
            const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
            if (rateLimited(ip)) {
                return jsonResponse({ error: 'Rate limit exceeded', limit: RL_LIMIT, window_ms: RL_WINDOW_MS }, 429);
            }
            return handleOpusAnalysis(request, env);
        }

        return jsonResponse({ error: 'Method not allowed' }, 405);
    }
};
