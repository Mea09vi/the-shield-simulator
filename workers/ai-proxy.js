/* ════════════════════════════════════════════════════════════════════
   THE SHIELD 2.0 — UDC Simulator v15.0.0
   AI Proxy Worker · Multi-provider (Cloudflare Workers AI + Google Gemini)
   ──────────────────────────────────────────────────────────────────────
   Purpose : ตัวกลาง (relay) ระหว่าง client (UDC Simulator) กับ LLM provider
             หลายเจ้า — เลือก provider โดยอัตโนมัติจาก model id ที่ส่งมา:
               • prefix `@cf/`        → Cloudflare Workers AI (binding)
               • prefix `gemini-`     → Google Gemini REST API (Generative Language)

   Why     : รองรับทั้ง Workers AI (ฟรีทั้งหมด, neuron quota) และ Gemini
             (free tier 10 RPM สำหรับ gemini-2.5-flash · Google ย้าย 2.0
             ไป paid tier ปี 2025) — เปลี่ยน model จาก client ผ่าน
             `body.model` ได้โดยไม่ต้องแก้ Worker

   Endpoints
   ─────────
     POST /              → router → Workers AI หรือ Gemini ตาม model
                           body: { taxonomy, alerts, model? }
                           response: { text, model, provider, usage, latency_ms }
     GET  /health        → liveness probe + providers status
     OPTIONS /*          → CORS preflight

   Models (allow-list — ป้องกัน client ส่ง model ที่ไม่รองรับ)
   ─────────────────────────────────────────────────────────────────────
     [Cloudflare Workers AI · env.AI binding]
     • @cf/meta/llama-3.3-70b-instruct-fp8-fast  (default WAI · ดีสำหรับไทย)
     • @cf/deepseek-ai/deepseek-r1-distill-qwen-32b (มี reasoning)
     • @cf/meta/llama-3.1-8b-instruct (เร็วสุด)

     [Google Gemini · generativelanguage.googleapis.com]
     • gemini-2.5-flash  (default Gemini · ฟรี ~10 RPM)
     • gemini-2.5-pro    (best quality · limited)
     • gemini-2.0-flash  ⚠ ต้องผูก billing (free_tier_requests = 0 ตั้งแต่ 2025)
     ดู models: https://ai.google.dev/gemini-api/docs/models

   Security
   ────────
     • Workers AI: account-level binding (ไม่ต้องเก็บ secret)
     • Gemini: ใช้ GEMINI_API_KEY เป็น Cloudflare secret
       (`wrangler secret put GEMINI_API_KEY`) — ไม่อยู่ใน client code
     • CORS: Allow-Origin: * (รองรับ file:// และ http://)
     • Rate limit: 30 req/min per IP (in-memory per-isolate)
     • Cloudflare neuron quota (free: 10,000/วัน) + Gemini RPM quota แยกกัน

   Deploy
   ──────
     1. npm i -g wrangler
     2. wrangler login
     3. (ถ้าจะใช้ Gemini)  wrangler secret put GEMINI_API_KEY
     4. wrangler deploy
     5. คัดลอก URL (xxx.workers.dev) → UDC Simulator ผ่านปุ่ม ⚙
   ════════════════════════════════════════════════════════════════════ */

const VERSION = '15.0.0';   // v15.2 — own-force-aware prompt (รับ context.ownForce → buildSystemPrompt/buildUserPrompt)
const DEFAULT_MODEL = 'gemini-2.5-flash';  // v14.0.7 — Google ย้าย 2.0-flash ไป paid tier · 2.5-flash ยังฟรี
const MAX_TOKENS = 3000;                    // v14.0.9 — assessment-grade output ต้องการพื้นที่มากขึ้น (1500→3000)
const GEMINI_TIMEOUT_MS = 45_000;           // v14.0.9 — output ยาวขึ้น → เผื่อเวลา 30→45s

// allow-list สำหรับ model — กัน client ส่ง model อะไรก็ได้
const WORKERS_AI_MODELS = new Set([
    '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    '@cf/meta/llama-3.1-70b-instruct',
    '@cf/meta/llama-3.1-8b-instruct',
    '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
    '@cf/qwen/qwen2.5-coder-32b-instruct',
    '@cf/mistralai/mistral-small-3.1-24b-instruct',
]);

const GEMINI_MODELS = new Set([
    'gemini-2.5-flash',   // default · free tier
    'gemini-2.5-pro',     // higher quality · limited quota
    'gemini-2.0-flash',   // ⚠ ต้องผูก billing — free_tier_requests = 0 ตั้งแต่ 2025
    // 'gemini-1.5-*' deprecated จาก v1beta · ถอดออกตั้งแต่ v14.0.7
]);

const ALLOWED_MODELS = new Set([...WORKERS_AI_MODELS, ...GEMINI_MODELS]);

function providerOf(modelId) {
    if (!modelId) return null;
    if (WORKERS_AI_MODELS.has(modelId)) return 'cloudflare-workers-ai';
    if (GEMINI_MODELS.has(modelId))     return 'google-gemini';
    return null;
}

// ── rate limit (per-isolate in-memory) ────────────────────────────────
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
        'คุณคือนักวิเคราะห์ข่าวกรองทางทะเล (Maritime Domain Awareness · MDA) ระดับอาวุโสของกองทัพเรือไทย',
        'ทำหน้าที่ All-Source Intelligence Analyst ช่วยผู้บัญชาการศูนย์ปฏิบัติการประเมินภัยคุกคามรอบ',
        'Undersea Data Center (UDC) ที่สัตหีบ อ่าวไทยตอนบน — ใกล้ฐานทัพเรือสัตหีบและสนามบินอู่ตะเภา (U-Tapao/VTBU)',
        '',
        '════ หลักการวิเคราะห์ (ปฏิบัติอย่างเคร่งครัด) ════',
        '1) ใช้กรอบ Intelligence Preparation of the Operational Environment (IPOE) และ',
        '   วิเคราะห์แบบ structured analytic techniques — เสนอ "สมมติฐานที่แข่งขันกัน"',
        '   (Analysis of Competing Hypotheses) ไม่ฟันธงเกินหลักฐาน',
        '2) ทุกครั้งต้องระบุ MLCOA (Most Likely COA) และ MDCOA (Most Dangerous COA)',
        '3) แยกแยะ "ข้อเท็จจริงจากเซ็นเซอร์" ออกจาก "การอนุมาน" ของคุณอย่างชัดเจน',
        '4) ระบุระดับความเชื่อมั่น (confidence: High/Moderate/Low) ของแต่ละข้อสรุป',
        '   พร้อมเหตุผล และชี้ "ช่องว่างข่าวกรอง" (Intelligence Gaps / PIR) ที่ต้องเติม',
        '5) สำคัญมาก — ให้ความสนใจฟิลด์ data_mode:',
        '   • data_mode=real  → วิเคราะห์ตามจริง',
        '   • data_mode=demo  → ข้อมูลเป็น SYNTHETIC/สาธิต ห้ามรายงานเสมือนภัยจริง',
        '     ต้องขึ้นต้นด้วยคำเตือนว่าเป็น demo และใช้ภาษาเชิงสาธิต/ฝึก',
        '6) พิจารณา "บริบทหลายโดเมน" (context) ที่แนบมา แม้ source นั้นจะไม่ได้ trigger alert:',
        '   Aviation(OpenSky), Seismic(USGS), Space-Wx(NOAA Kp), Marine-Wx, OSINT(GDELT), GNSS health',
        '   — เชื่อมโยงข้าม domain เพื่อหา pattern (เช่น Kp สูง→GNSS degrade อาจปะปนกับ spoofing)',
        '   — ระวัง false positive: อากาศยานบินต่ำ/ช้าใกล้ AOI อาจเป็น traffic เข้าออกอู่ตะเภา',
        '7) พิจารณา "การวางกำลังฝ่ายเรา" (context.ownForce — PV/GUUV ที่วางแล้ว พร้อม bearing/range/avail):',
        '   — อย่าเสนอวางกำลังซ้ำใน sector ที่กำลังเดิมคุมอยู่แล้ว · เสนอเสริมเฉพาะช่องว่าง coverage',
        '   — เคารพเพดานกำลัง (pvAvail/guuvAvail) ห้ามเสนอเกินที่มีจริง · ถ้าเต็มให้เสนอ posture/ROE แทนการวางเพิ่ม',
        '',
        '════ ขอบเขตอำนาจและกฎหมาย ════',
        '- ผลลัพธ์ของคุณเป็น Decision Support เท่านั้น ไม่ใช่ autonomous decision',
        '  (DoD Directive 3000.09 · 2023 และ IMO MASS Code Level III-A — human-in-the-loop)',
        '- อ้างกรอบกฎหมายเฉพาะเจาะจงตามสถานการณ์: UNCLOS Art.60(5) safety zone 500 m,',
        '  พ.ร.บ.เขตปลอดภัยฯ 2478, พ.ร.บ.การรักษาผลประโยชน์ของชาติทางทะเลฯ 2562 (ศรชล.),',
        '  PDPA (ข้อมูลพลเรือน), หลัก proportionality/necessity ในการใช้กำลัง',
        '- นโยบายอ้างอิง: ศรชล. 5-year plan 2566-2570, MDAWG 01/2025, NATO Mainsail (ก.พ.2025)',
        '- Taxonomy 5 มิติ: Physical-Kinetic, Asymmetric/Grey-Zone, Cyber-Physical, Environmental, Hybrid',
        '',
        '════ รูปแบบคำตอบ (ภาษาไทยหลัก · ศัพท์เทคนิคภาษาอังกฤษ · ใช้ทุกหัวข้อ) ════',
        '',
        '🧠 LLM ANALYSIS · <hh:mm:ss>  | DATA: <REAL|DEMO>',
        '═══════════════════════════════════════════',
        '',
        '🌐 ภาพรวมหลายโดเมน (Multi-Domain Picture):',
        '<สรุปสถานะแต่ละ source ที่มีข้อมูล: AIS/Surface, Aviation, Seismic, Space-Wx, Marine-Wx, OSINT, GNSS — เป็น bullet สั้น>',
        '',
        '🔍 บริบทเชิงระบบ (Systemic Context):',
        '<3-5 บรรทัด เชื่อมโยงสัญญาณข้าม domain · ระบุ dominant threat และเหตุผล>',
        '',
        '📊 การประเมินความเสี่ยงรายมิติ (Risk by Dimension):',
        '<ให้คะแนน/ระดับแต่ละมิติใน taxonomy ที่มี hit + ระดับรวม HIGH/ELEVATED/ROUTINE + นัยต่อ ROE>',
        '',
        '🎯 สมมติฐานภัยคุกคาม (Threat Hypotheses):',
        '▸ MLCOA (น่าจะเป็นที่สุด): <...> — confidence <H/M/L>',
        '▸ MDCOA (อันตรายที่สุด): <...> — indicator ที่ต้องเฝ้า',
        '',
        '🛠️ ข้อเสนอแนะการปฏิบัติ (Recommended Actions):',
        '<bullet ผูกกับกำลัง: Patrol Vessel / Guardian UUV / CAP helo / sensor posture — คำนึงถึง context.ownForce (ห้ามวางซ้ำ sector ที่คุมแล้ว / ไม่เกินเพดาน) — เรียงตามลำดับความสำคัญ>',
        '',
        '📡 ช่องว่างข่าวกรอง (Intelligence Gaps / PIR):',
        '<2-4 bullets — ข้อมูลอะไรขาด ต้องเก็บเพิ่มอะไรเพื่อยืนยัน/ตัดสมมติฐาน>',
        '',
        '⚖️ ข้อพิจารณาทางกฎหมาย (Legal Considerations):',
        '<2-4 bullets — อ้าง law/policy เฉพาะเจาะจงตามสถานการณ์จริง ไม่ใช่ลอกทั้งชุด>',
        '',
        '🛡️ ข้อจำกัดและความเชื่อมั่น (Caveats & Confidence):',
        '<HITL · confidence โดยรวม + เหตุผล · MASS Code level · เตือน demo ถ้า data_mode=demo>',
        '',
        'ตอบเฉพาะเนื้อหาตามรูปแบบข้างต้น เป็นภาษาไทยเชิงวิชาชีพทหาร ห้าม preamble/คำทักทาย',
        'เขียนให้ลึกและเชื่อมโยงหลักฐาน — หลีกเลี่ยงการพูดกว้างๆ ซ้ำ template'
    ].join('\n');
}

function buildUserPrompt(payload) {
    const tax = payload.taxonomy || {};
    const alerts = (payload.alerts || []).slice(0, 12);
    const ctx = payload.context || null;
    const dataMode = (payload.dataMode === 'real') ? 'real' : (payload.dataMode === 'demo' ? 'demo' : (ctx && ctx.dataMode) || 'demo');
    const ts = new Date().toISOString();
    const lines = [
        `[Time UTC] ${ts}`,
        `[data_mode] ${dataMode}` + (dataMode === 'demo'
            ? '   ⚠ SYNTHETIC/สาธิต — ไม่มี live source · ห้ามรายงานเสมือนภัยจริง'
            : '   ✅ REAL — มี live source อย่างน้อย 1 รายการ'),
        '',
        '[Threat Taxonomy counts]',
        `- Physical-Kinetic        : ${tax.kinetic || 0}`,
        `- Asymmetric/Grey-Zone    : ${tax.asymmetric || 0}`,
        `- Cyber-Physical          : ${tax.cyber || 0}`,
        `- Environmental           : ${tax.environmental || 0}`,
        `- Hybrid (multi-vector)   : ${tax.hybrid || 0}`,
        ''
    ];

    // ── v14.0.9 · multi-domain context (source ที่ไม่ได้ trigger alert ก็ส่งให้ AI เห็น) ──
    if (ctx) {
        lines.push('[Multi-Domain Context] (บริบทดิบจากทุก source — ใช้เชื่อมโยงข้าม domain)');
        const ais = ctx.ais || {};
        lines.push(`- AIS/Surface : ships=${ais.ships || 0}, anomalies=${ais.anomalies || 0}`);

        const av = ctx.aviation;
        if (av && av.count) {
            let s = `- Aviation    : tracks=${av.count}, near_AOI=${av.nearAOI}, low_slow=${av.lowSlow}`;
            if (av.nearest) s += `, nearest=${av.nearest.call}@${av.nearest.distNm}NM` +
                (av.nearest.altFt != null ? `/${av.nearest.altFt}ft` : '') +
                (av.nearest.gsKn != null ? `/${av.nearest.gsKn}kn` : '');
            s += '  (หมายเหตุ: บินต่ำ/ช้าใกล้ AOI อาจเป็น traffic อู่ตะเภา — อย่าด่วนสรุปเป็นภัย)';
            lines.push(s);
        } else lines.push('- Aviation    : no data (OpenSky off/empty)');

        const se = ctx.seismic;
        if (se && se.count) {
            let s = `- Seismic     : events=${se.count}, max_M=${se.maxMag}`;
            if (se.nearest) s += `, nearest=M${se.nearest.mag} "${se.nearest.place}" @${se.nearest.distNm}NM` +
                (se.nearest.depthKm != null ? `/depth ${se.nearest.depthKm}km` : '');
            lines.push(s);
        } else lines.push('- Seismic     : no events');

        const sw = ctx.spaceWx;
        if (sw && sw.kp != null) lines.push(`- Space-Wx    : Kp=${sw.kp} (${sw.level})` + (sw.kp >= 5 ? '  → GNSS/HF degradation likely' : ''));
        else lines.push('- Space-Wx    : no Kp data');

        const mw = ctx.marineWx, env = ctx.env || {};
        if (mw && mw.waveHt != null) lines.push(`- Marine-Wx   : Hs=${mw.waveHt}m` + (mw.wavePeriod != null ? `, T=${mw.wavePeriod}s` : '') + (env.seaState != null ? `, sea_state=${env.seaState}` : ''));
        else if (env.seaState != null) lines.push(`- Marine-Wx   : sea_state=${env.seaState}`);
        else lines.push('- Marine-Wx   : no wave data');

        const gd = ctx.gdelt;
        if (gd && gd.count) {
            lines.push(`- OSINT/GDELT : items=${gd.count}`);
            (gd.topTitles || []).slice(0, 3).forEach(ti => lines.push(`    · ${String(ti).slice(0, 110)}`));
        } else lines.push('- OSINT/GDELT : no notable items');

        if (env.gnssJitter != null) lines.push(`- GNSS health : jitter=${Math.round(env.gnssJitter * 100)}%` + (env.gnssJitter >= 0.5 ? '  → possible spoofing signature' : ''));

        // ── v15.2 · own-force disposition (กำลัง PV/GUUV ที่ผู้ใช้วางบนแผนที่) ──
        const of = ctx.ownForce;
        if (of) {
            let s = `- Own-Force   : PV ${of.pvCount}/${of.pvMax} (avail ${of.pvAvail}), GUUV ${of.guuvCount}/${of.guuvMax} (avail ${of.guuvAvail})`;
            if (of.pv && of.pv.length)     s += `; PV@[${of.pv.map(u => Math.round(u.bearing) + '°/' + Number(u.rangeNm).toFixed(1) + 'NM').join(', ')}]`;
            if (of.guuv && of.guuv.length) s += `; GUUV@[${of.guuv.map(u => Math.round(u.bearing) + '°/' + Number(u.rangeNm).toFixed(1) + 'NM').join(', ')}]`;
            s += '  (อย่าเสนอวางซ้ำ sector ที่คุมแล้ว · ห้ามเกิน avail)';
            lines.push(s);
        } else lines.push('- Own-Force   : ไม่มีกำลัง PV/GUUV วางบนแผนที่');
        lines.push('');
    } else {
        lines.push('[Multi-Domain Context] (ไม่ได้แนบมา — วิเคราะห์จาก taxonomy/alerts เท่านั้น)');
        lines.push('');
    }

    lines.push('[Recent alerts] (sorted newest first)');
    if (!alerts.length) {
        lines.push('  (ไม่มี alert ในห้วงเวลานี้ — สภาพการณ์ baseline)');
    } else {
        for (const a of alerts) {
            const conf = a.conf != null ? Math.round(a.conf * 100) + '%' : '?';
            const demoFlag = a._demo ? ' [DEMO]' : '';
            lines.push(`  - [${a.severity || '?'} ${a.tag || '?'}]${demoFlag} ${a.msg || ''} (conf ${conf}, ts ${a.ts || '?'})`);
        }
    }
    lines.push('');
    lines.push(dataMode === 'demo'
        ? 'โปรดวิเคราะห์ตามรูปแบบในระบบพร้อมท์ — และเนื่องจาก data_mode=demo ให้ขึ้นต้นด้วยคำเตือนว่าเป็นสถานการณ์สาธิต/ฝึก (synthetic) ใช้ภาษาเชิงฝึก'
        : 'โปรดให้การวิเคราะห์ all-source เชิงลึกตามรูปแบบที่กำหนดในระบบพร้อมท์ เชื่อมโยงหลักฐานข้าม domain และระบุ MLCOA/MDCOA + PIR');
    return lines.join('\n');
}

// ── provider: Cloudflare Workers AI ──────────────────────────────────
async function callWorkersAi(env, model, system, userMsg) {
    if (!env.AI) {
        return { error: 'AI binding not configured — wrangler.toml ต้องมี [ai] binding', status: 500 };
    }

    let aiResult;
    try {
        aiResult = await env.AI.run(model, {
            messages: [
                { role: 'system', content: system },
                { role: 'user',   content: userMsg }
            ],
            max_tokens: MAX_TOKENS,
            temperature: 0.7
        });
    } catch (e) {
        return { error: 'Workers AI call failed', detail: String(e && e.message || e), status: 502 };
    }

    // Workers AI response shape:
    //   { response: '...', usage: { prompt_tokens, completion_tokens, total_tokens } }
    const text = (aiResult && (aiResult.response || aiResult.result?.response)) || '';
    const rawUsage = aiResult?.usage || aiResult?.result?.usage || null;

    // Normalize usage → Anthropic-compatible shape ที่ client คาดหวัง
    const usage = rawUsage ? {
        input_tokens:  rawUsage.prompt_tokens     ?? rawUsage.input_tokens  ?? null,
        output_tokens: rawUsage.completion_tokens ?? rawUsage.output_tokens ?? null,
        total_tokens:  rawUsage.total_tokens      ?? null
    } : null;

    if (!text) {
        return { error: 'Empty response from Workers AI', raw: aiResult, status: 502 };
    }

    return {
        text,
        usage,
        stop_reason: aiResult?.stop_reason || null
    };
}

// ── provider: Google Gemini ──────────────────────────────────────────
// Generative Language API · v1beta · generateContent
// https://ai.google.dev/api/generate-content
async function callGemini(env, model, system, userMsg) {
    const key = env.GEMINI_API_KEY;
    if (!key) {
        return {
            error: 'GEMINI_API_KEY ไม่ได้ตั้ง — เพิ่ม secret: wrangler secret put GEMINI_API_KEY',
            status: 500
        };
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;

    const body = {
        // system instruction (Gemini แยกจาก contents)
        systemInstruction: { parts: [{ text: system }] },
        contents: [
            { role: 'user', parts: [{ text: userMsg }] }
        ],
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: MAX_TOKENS,
            topP: 0.95
        },
        // ปิด safety filter ระดับเข้มสุด — เนื้อหา military analysis อาจโดน block
        safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' }
        ]
    };

    // AbortController สำหรับ timeout
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), GEMINI_TIMEOUT_MS);

    let resp, data;
    try {
        resp = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: ctrl.signal
        });
        data = await resp.json().catch(() => null);
    } catch (e) {
        clearTimeout(tid);
        const isAbort = e && (e.name === 'AbortError' || /abort/i.test(String(e.message || '')));
        return {
            error: isAbort ? 'Gemini timeout' : 'Gemini call failed',
            detail: String(e && e.message || e),
            status: isAbort ? 504 : 502
        };
    }
    clearTimeout(tid);

    if (!resp.ok) {
        const msg = (data && data.error && (data.error.message || data.error.status)) || ('HTTP ' + resp.status);
        return { error: 'Gemini API error', detail: msg, raw: data, status: resp.status };
    }

    // ดึงข้อความจาก response.candidates[0].content.parts[*].text
    const candidate = data && data.candidates && data.candidates[0];
    if (!candidate) {
        return { error: 'No candidates in Gemini response', raw: data, status: 502 };
    }
    const finishReason = candidate.finishReason || null;
    const parts = candidate.content && candidate.content.parts;
    const text = Array.isArray(parts)
        ? parts.map(p => p.text || '').join('').trim()
        : '';

    if (!text) {
        return {
            error: 'Empty response from Gemini',
            detail: finishReason === 'SAFETY' ? 'Blocked by safety filter' : (finishReason || 'unknown'),
            raw: data,
            status: 502
        };
    }

    // Normalize usage → input/output_tokens (Anthropic-compatible)
    const um = data.usageMetadata || {};
    const usage = {
        input_tokens:  um.promptTokenCount     ?? null,
        output_tokens: um.candidatesTokenCount ?? null,
        total_tokens:  um.totalTokenCount      ?? null
    };

    return {
        text,
        usage,
        stop_reason: finishReason
    };
}

// ── main router ──────────────────────────────────────────────────────
async function handleAnalysis(request, env) {
    let payload;
    try {
        payload = await request.json();
    } catch (_) {
        return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    // เลือก model — ถ้า client ส่ง model มา ต้องอยู่ใน allow-list
    let model = payload.model || DEFAULT_MODEL;
    if (!ALLOWED_MODELS.has(model)) {
        model = DEFAULT_MODEL;
    }
    const provider = providerOf(model);
    if (!provider) {
        return jsonResponse({ error: 'Unknown provider for model: ' + model }, 400);
    }

    const system = buildSystemPrompt();
    const userMsg = buildUserPrompt(payload);

    const t0 = Date.now();
    let result;
    if (provider === 'cloudflare-workers-ai') {
        result = await callWorkersAi(env, model, system, userMsg);
    } else if (provider === 'google-gemini') {
        result = await callGemini(env, model, system, userMsg);
    } else {
        return jsonResponse({ error: 'No handler for provider: ' + provider }, 500);
    }
    const latency_ms = Date.now() - t0;

    // ถ้า provider คืน error → ส่งต่อด้วย status ของ provider
    if (result.error) {
        return jsonResponse({
            error: result.error,
            detail: result.detail || null,
            model,
            provider,
            latency_ms,
            version: VERSION
        }, result.status || 502);
    }

    return jsonResponse({
        text: result.text,
        model,
        provider,
        usage: result.usage || null,
        stop_reason: result.stop_reason || null,
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
                providers: {
                    'cloudflare-workers-ai': {
                        configured: !!env.AI,
                        models: Array.from(WORKERS_AI_MODELS)
                    },
                    'google-gemini': {
                        configured: !!env.GEMINI_API_KEY,
                        models: Array.from(GEMINI_MODELS)
                    }
                },
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
            return handleAnalysis(request, env);
        }

        return jsonResponse({ error: 'Method not allowed' }, 405);
    }
};
