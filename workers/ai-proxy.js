/* ════════════════════════════════════════════════════════════════════
   THE SHIELD 2.0 — UDC Simulator v14.0.5
   AI Proxy Worker · Cloudflare Workers AI (binding-based)
   ──────────────────────────────────────────────────────────────────────
   Purpose : ตัวกลาง (relay) ระหว่าง client (UDC Simulator) กับ
             Cloudflare Workers AI (Llama 3.3 70B / DeepSeek R1)
   Why     : ฟรีในตัว Cloudflare — ไม่ต้องสมัครบัญชี API ภายนอก
             ไม่ต้องเก็บ API key แยก (ใช้ `env.AI` binding)

   Endpoints
   ─────────
     POST /              → forward เป็น Workers AI binding call
                           (รับ body: { taxonomy, alerts, model? })
                           ส่งกลับ: { text, model, usage, latency_ms }
     GET  /health        → liveness probe { ok: true, version, model_default }
     OPTIONS /*          → CORS preflight

   Models (ที่ใช้ได้ฟรี — เลือกจาก client ผ่าน body.model)
   ─────────────────────────────────────────────────────────────────────
     • @cf/meta/llama-3.3-70b-instruct-fp8-fast  ← default (ดีสุดสำหรับ Thai)
     • @cf/deepseek-ai/deepseek-r1-distill-qwen-32b (มี reasoning)
     • @cf/qwen/qwen2.5-coder-32b-instruct
     • @cf/meta/llama-3.1-70b-instruct
     ดู models list: https://developers.cloudflare.com/workers-ai/models/

   Security
   ────────
     • ไม่มี secret — Workers AI ใช้ account-level binding อัตโนมัติ
     • CORS ตอบกลับ Allow-Origin: * (รองรับทั้ง file:// และ http)
     • Rate limit ขั้นต้น 30 req/min per IP (in-memory map · per-isolate)
     • Cloudflare บังคับ neuron quota เอง (free: 10,000 neurons/วัน)

   Deploy
   ──────
     1. ติดตั้ง wrangler:           npm i -g wrangler
     2. login:                      wrangler login
     3. deploy:                     wrangler deploy
        (ไม่ต้องตั้ง secret ใดๆ — ใช้ binding อัตโนมัติ)
     4. คัดลอก URL (xxx.workers.dev) → ตั้งใน UDC Simulator ผ่านปุ่ม ⚙
   ════════════════════════════════════════════════════════════════════ */

const VERSION = '14.0.5';
const DEFAULT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const MAX_TOKENS = 1500;

// allow-list สำหรับ model — กัน client ส่ง model ที่ไม่รองรับ
const ALLOWED_MODELS = new Set([
    '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    '@cf/meta/llama-3.1-70b-instruct',
    '@cf/meta/llama-3.1-8b-instruct',
    '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
    '@cf/qwen/qwen2.5-coder-32b-instruct',
    '@cf/mistralai/mistral-small-3.1-24b-instruct',
]);

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
        'คุณคือนักวิเคราะห์ Maritime Domain Awareness (MDA) ของกองทัพเรือไทย',
        'ทำหน้าที่ช่วยผู้บัญชาการเรือ/ศูนย์ปฏิบัติการประเมินภัยคุกคามทางทะเลรอบ',
        'Undersea Data Center (UDC) ที่สัตหีบ น่านน้ำไทย',
        '',
        'ขอบเขตและกฎ:',
        '- ผลลัพธ์ของคุณเป็น Decision Support ไม่ใช่ autonomous decision',
        '  (สอดคล้องกับ DoD Directive 3000.09 และ IMO MASS Code Level III-A)',
        '- อ้างอิงกรอบกฎหมาย: UNCLOS Art.60(5) safety zone 500 m,',
        '  พ.ร.บ.เขตปลอดภัย 2478, พ.ร.บ.ผลประโยชน์ฯ 2562 (ศรชล.),',
        '  PDPA เมื่อพูดถึงข้อมูลพลเรือน',
        '- กล่าวถึงนโยบายอ้างอิง: ศรชล. 5-year plan 2566-2570,',
        '  MDAWG 01/2025, NATO Mainsail (ก.พ.2025)',
        '- Taxonomy 5 มิติ: Physical-Kinetic, Asymmetric/Grey-Zone,',
        '  Cyber-Physical, Environmental, Hybrid',
        '',
        'รูปแบบคำตอบ (ใช้ภาษาไทยเป็นหลัก คำศัพท์เทคนิคใช้ภาษาอังกฤษ):',
        '',
        '🧠 OPUS ANALYSIS · <hh:mm:ss>',
        '═══════════════════════════════════════════',
        '',
        '🔍 บริบทเชิงระบบ:',
        '<2-3 บรรทัด สรุปสถานการณ์โดยรวม>',
        '',
        '📊 การประเมินความเสี่ยง:',
        '<ระดับ HIGH/ELEVATED/ROUTINE + คำแนะนำต่อ ROE>',
        '',
        '⚖️ ข้อพิจารณาทางกฎหมาย:',
        '<2-3 bullets — อ้าง law/policy อย่างเฉพาะเจาะจง>',
        '',
        '🛡️ ข้อจำกัด (caveats):',
        '<HITL, confidence, MASS Code level>',
        '',
        'ตอบเฉพาะเนื้อหาตามรูปแบบข้างต้น ห้ามใส่ preamble หรือคำทักทาย'
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
        `- Physical-Kinetic        : ${tax.kinetic || 0}`,
        `- Asymmetric/Grey-Zone    : ${tax.asymmetric || 0}`,
        `- Cyber-Physical          : ${tax.cyber || 0}`,
        `- Environmental           : ${tax.environmental || 0}`,
        `- Hybrid (multi-vector)   : ${tax.hybrid || 0}`,
        '',
        '[Recent alerts] (sorted newest first)'
    ];
    if (!alerts.length) {
        lines.push('  (ไม่มี alert ในห้วงเวลานี้ — สภาพการณ์ปกติ)');
    } else {
        for (const a of alerts) {
            const conf = a.conf != null ? Math.round(a.conf * 100) + '%' : '?';
            lines.push(`  - [${a.severity || '?'} ${a.tag || '?'}] ${a.msg || ''} (conf ${conf}, ts ${a.ts || '?'})`);
        }
    }
    lines.push('');
    lines.push('โปรดให้การวิเคราะห์เชิงลึกตามรูปแบบที่กำหนดในระบบพร้อมท์');
    return lines.join('\n');
}

// ── main handler ─────────────────────────────────────────────────────
async function handleOpusAnalysis(request, env) {
    if (!env.AI) {
        return jsonResponse({
            error: 'AI binding not configured — ตรวจสอบว่า wrangler.toml มี [ai] binding'
        }, 500);
    }

    let payload;
    try {
        payload = await request.json();
    } catch (_) {
        return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    // เลือก model — ถ้า client ส่ง model มา ต้องอยู่ใน allow-list เท่านั้น
    let model = payload.model || DEFAULT_MODEL;
    if (!ALLOWED_MODELS.has(model)) {
        model = DEFAULT_MODEL;
    }

    const system = buildSystemPrompt();
    const userMsg = buildUserPrompt(payload);

    const t0 = Date.now();
    let aiResult;
    try {
        // Workers AI binding call — ไม่ต้อง fetch HTTP
        // ดู spec: https://developers.cloudflare.com/workers-ai/configuration/bindings/
        aiResult = await env.AI.run(model, {
            messages: [
                { role: 'system', content: system },
                { role: 'user',   content: userMsg }
            ],
            max_tokens: MAX_TOKENS,
            temperature: 0.7
        });
    } catch (e) {
        return jsonResponse({
            error: 'Workers AI call failed',
            detail: String(e && e.message || e),
            model
        }, 502);
    }

    const latency_ms = Date.now() - t0;

    // Workers AI response shape:
    //   { response: 'text...', usage: { prompt_tokens, completion_tokens, total_tokens } }
    // หรือบางรุ่นอาจเป็น { result: { response: '...' } }
    const text = (aiResult && (aiResult.response || aiResult.result?.response)) || '';
    const rawUsage = aiResult?.usage || aiResult?.result?.usage || null;

    // Normalize usage → Anthropic-compatible shape ที่ client คาดหวัง
    const usage = rawUsage ? {
        input_tokens:  rawUsage.prompt_tokens     ?? rawUsage.input_tokens  ?? null,
        output_tokens: rawUsage.completion_tokens ?? rawUsage.output_tokens ?? null,
        total_tokens:  rawUsage.total_tokens      ?? null
    } : null;

    if (!text) {
        return jsonResponse({
            error: 'Empty response from Workers AI',
            raw: aiResult,
            model,
            latency_ms
        }, 502);
    }

    return jsonResponse({
        text,
        model,
        usage,
        stop_reason: aiResult?.stop_reason || null,
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
                provider: 'cloudflare-workers-ai',
                model_default: DEFAULT_MODEL,
                models_allowed: Array.from(ALLOWED_MODELS)
            });
        }

        // main
        if (request.method === 'POST') {
            const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
            if (rateLimited(ip)) {
                return jsonResponse({
                    error: 'Rate limit exceeded',
                    limit: RL_LIMIT,
                    window_ms: RL_WINDOW_MS
                }, 429);
            }
            return handleOpusAnalysis(request, env);
        }

        return jsonResponse({ error: 'Method not allowed' }, 405);
    }
};
