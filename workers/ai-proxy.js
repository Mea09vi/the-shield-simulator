/* ════════════════════════════════════════════════════════════════════
   THE SHIELD 2.0 — UDC Simulator v15.0.0
   AI Proxy Worker · Multi-provider (Cloudflare Workers AI + Google Gemini + Z.AI GLM + ThaiLLM/BDI)
   ──────────────────────────────────────────────────────────────────────
   Purpose : ตัวกลาง (relay) ระหว่าง client (UDC Simulator) กับ LLM provider
             หลายเจ้า — เลือก provider โดยอัตโนมัติจาก model id ที่ส่งมา:
               • prefix `@cf/`        → Cloudflare Workers AI (binding)
               • prefix `gemini-`     → Google Gemini REST API (Generative Language)
               • prefix `glm-`        → Z.AI (Zhipu GLM) · OpenAI-compatible REST
               • ThaiLLM model ids    → ThaiLLM (BDI) · OpenAI-compatible REST (membership set)

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

const VERSION = '15.6.2';   // v15.6.2 — callThaiLLM: strip reasoning preamble กำพร้าของ qwen3.6-35b-a3b (ปล่อย "Here's a thinking process:…" แล้วปิดด้วย </think> เดี่ยว ๆ ไม่มี <think> เปิด → regex คู่จับไม่ได้) โดยตัดถึง </think> ตัวสุดท้าย · v15.6.1 — callThaiLLM: retry อัตโนมัติ 1 ครั้งเมื่อ gateway ThaiLLM ล่มชั่วขณะ (CF คืน "error code: 502" แบบ non-JSON ต่อ replica เป็นครั้งคราว) · retry เฉพาะ error เด้งเร็ว (429/500/502/503/504/non-JSON) ไม่ retry ตอน timeout · v15.6.0 — เพิ่ม provider ThaiLLM (BDI): 5 โมเดล (OpenThaiGPT/Typhoon-S/Pathumma/THaLLE + qwen3.6-35b-a3b) ผ่าน OpenAI-compatible endpoint https://thaillm.or.th/api/v1 (callThaiLLM · Bearer THAILLM_API_KEY · strip <think>) · v15.5.4 — แก้ /gdelt: multi-source RSS fallback (Diplomat→USNI→NavalNews) แทน GDELT/GNews ที่ block CF IPs · v15.5.3 — แก้ /gdelt: pivot Google News RSS (GDELT silent-blocks CF IPs) + parse RSS XML + cache 5 min · v15.5.2 — แก้ /gdelt: Cloudflare Cache API 5 min + soft-fail 200 เมื่อ 429/timeout + simplify query · v15.5.1 — แก้ /cve: เพิ่ม pubEndDate (NVD บังคับ), format +00:00, ขยาย 90d, แยก SCADA/ICS keyword (AND→OR) · v15.5.0 — เพิ่ม GET /gdelt proxy (bypass CORS ฝั่ง Worker) + GET /cve proxy (NVD ICS/SCADA HIGH/CRITICAL 30d) + เพิ่ม CVE context ใน buildUserPrompt · v15.4.3 — แก้ ZAI_ENDPOINT: /api/openai/v1/ คืน 404 NOT_FOUND → เปลี่ยนเป็น path ทางการ /api/paas/v4/chat/completions (docs.z.ai · curl ตัวอย่างใช้ paas/v4 + glm-5.2) · v15.4.2 — callZai: ดักซอง Zhipu native {code,msg,success} (แม้ HTTP 200) + ดัมพ์ raw body ใน detail · v15.4.1 — surface error จริงจาก Z.AI (Zhipu คืน HTTP 200+body error) + อ่าน raw body · v15.4 — เพิ่ม provider Z.AI (Zhipu GLM): glm-5.2/glm-4.6 ผ่าน OpenAI-compatible endpoint (callZai) · v15.3 — [JP 3-04] prompt upgrade: A1 ข้อเท็จจริง/ตีความ+สมมติฐานสุจริต+หลักฐานหักล้าง · A2 feed-trust+confidence รายโดเมน · A5 ผล/กลไก/อำนาจ/เสี่ยง/ผลลำดับสอง · A6 บทสรุปเรื่องเล่า 4 ส่วน+6 informational aspects · v15.3.1 — แก้ Gemini 2.5 โดนตัดที่ MAX_TOKENS (thinking กิน budget ร่วมกับคำตอบ)
const DEFAULT_MODEL = 'gemini-2.5-flash';  // v14.0.7 — Google ย้าย 2.0-flash ไป paid tier · 2.5-flash ยังฟรี
const MAX_TOKENS = 4096;                    // v15.3.1 — Workers AI cap (3000→4096) เผื่อ template v15.3 ที่ยาวขึ้น
const MAX_TOKENS_GEMINI = 8192;             // v15.3.1 — Gemini 2.5 เป็น thinking model: การคิดภายใน (~2-3k tok ที่วัดจริง) นับรวมใน maxOutputTokens → ค่า 3000 เดิมเหลือที่ให้คำตอบ ~100 tok แล้วโดนตัดกลางประโยค
const GEMINI_THINKING_BUDGET = 2048;        // v15.3.1 — จำกัด thinking ให้เหลือพื้นที่คำตอบ ≥6k tok · ใช้เฉพาะ gemini-2.5-* (2.5-pro ขั้นต่ำ 128 ปิด 0 ไม่ได้ · 2.0-flash ไม่รองรับ field นี้)
const GEMINI_TIMEOUT_MS = 45_000;           // v14.0.9 — output ยาวขึ้น → เผื่อเวลา 30→45s

// allow-list สำหรับ model — กัน client ส่ง model อะไรก็ได้
const WORKERS_AI_MODELS = new Set([
    '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    '@cf/meta/llama-3.1-70b-instruct',
    '@cf/meta/llama-3.1-8b-instruct',
    '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
    '@cf/qwen/qwen2.5-coder-32b-instruct',
    '@cf/qwen/qwen1.5-14b-chat-awq',
    '@cf/qwen/qwen1.5-7b-chat-awq',
    '@cf/mistralai/mistral-small-3.1-24b-instruct',
]);

const GEMINI_MODELS = new Set([
    'gemini-2.5-flash',   // default · free tier
    'gemini-2.5-pro',     // higher quality · limited quota
    'gemini-2.0-flash',   // ⚠ ต้องผูก billing — free_tier_requests = 0 ตั้งแต่ 2025
    // 'gemini-1.5-*' deprecated จาก v1beta · ถอดออกตั้งแต่ v14.0.7
]);

const ZAI_MODELS = new Set([
    'glm-5.2',   // v15.4 — flagship · 1M context (อาจต้องใช้แพ็กเกจที่รองรับ glm-5.x)
    'glm-4.6',   // v15.4 — เสถียร · fallback
]);

// v15.4 — Z.AI (Zhipu) OpenAI-compatible config
// v15.4.3 — แก้ endpoint: path เดิม /api/openai/v1/ คืน 404 NOT_FOUND
//           path ทางการคือ /api/paas/v4/ (docs.z.ai · curl ตัวอย่างใช้ paas/v4 + model glm-5.2)
const ZAI_ENDPOINT = 'https://api.z.ai/api/paas/v4/chat/completions';
const ZAI_TIMEOUT_MS = 60_000;   // GLM-5.2 reasoning อาจช้ากว่า → เผื่อเวลา
const MAX_TOKENS_ZAI = 8192;     // เพดาน output (เท่า Gemini)

// v15.6 — ThaiLLM (BDI · สถาบันข้อมูลขนาดใหญ่ ประเทศไทย) — OpenAI-compatible /v1/chat/completions
//   ยืนยันจากทดสอบจริง 24 ก.ค. 69: choices[0].message.content + usage.prompt/completion_tokens
//   เหมือน OpenAI เป๊ะ · โมเดลห่อ chain-of-thought ด้วย <think>…</think> (strip แบบเดียวกับ GLM)
//   ใช้ https:// (เข้ารหัส · ทดสอบแล้วคืน 200) · rate limit 5 req/s หรือ 200 req/min
const THAILLM_MODELS = new Set([
    'OpenThaiGPT-ThaiLLM-8B-Instruct-v7.2',      // AIEAT
    'Typhoon-S-ThaiLLM-8B-Instruct',             // SCB 10X
    'Pathumma-ThaiLLM-qwen3-8b-think-3.0.0',     // NECTEC
    'THaLLE-0.2-ThaiLLM-8B-fa',                  // KBTG
    'qwen3.6-35b-a3b',                           // Alibaba/Qwen (MoE 35B) — ตัวใหญ่สุดบน ThaiLLM · เก่ง JSON กว่า 8B
]);
const THAILLM_ENDPOINT = 'https://thaillm.or.th/api/v1/chat/completions';
const THAILLM_TIMEOUT_MS = 60_000;   // 8B/35B บน infra ไทย เผื่อเวลา
const MAX_TOKENS_THAILLM = 8192;     // เพดาน output (เท่า Gemini/Z.AI)

const ALLOWED_MODELS = new Set([...WORKERS_AI_MODELS, ...GEMINI_MODELS, ...ZAI_MODELS, ...THAILLM_MODELS]);

function providerOf(modelId) {
    if (!modelId) return null;
    if (WORKERS_AI_MODELS.has(modelId)) return 'cloudflare-workers-ai';
    if (GEMINI_MODELS.has(modelId))     return 'google-gemini';
    if (ZAI_MODELS.has(modelId))        return 'zhipu-zai';
    if (THAILLM_MODELS.has(modelId))    return 'thaillm';
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
        '   [JP 3-04] สมมติฐานต้องครอบทั้งการตีความ "มุ่งร้าย" และ "สุจริต" (benign: ประมง/ผ่านทาง/',
        '   traffic อู่ตะเภา/ปรากฏการณ์ธรรมชาติ) — พฤติกรรมเดียวกันตีความได้หลายทาง และให้ระบุ',
        '   "แรงขับพฤติกรรม" (drivers of behavior) ของผู้กระทำ เช่น ภารกิจที่ได้รับ/ผลประโยชน์/ความกลัว/การทดสอบปฏิกิริยา',
        '2) ทุกครั้งต้องระบุ MLCOA (Most Likely COA) และ MDCOA (Most Dangerous COA)',
        '   พร้อม "หลักฐานหักล้าง" (disconfirming evidence) ของแต่ละสมมติฐาน — ข้อมูลใดถ้าตรวจพบ',
        '   จะทำให้สมมติฐานนั้นตกไป ระบุเสมอเพื่อกัน confirmation bias [JP 3-04]',
        '3) แยกแยะ "ข้อเท็จจริงจากเซ็นเซอร์" ออกจาก "การอนุมาน" ของคุณอย่างชัดเจน',
        '   ใช้ภาษาสหสัมพันธ์ ไม่ใช่เหตุภาพ: เขียนว่า "ตัวบ่งชี้ n รายการสอดคล้องกับรูปแบบ X"',
        '   ไม่ใช่ "X กำลังเกิดขึ้น" (correlation ≠ causation) [JP 3-04]',
        '4) ระบุระดับความเชื่อมั่น (confidence: High/Moderate/Low) ของแต่ละข้อสรุป',
        '   พร้อมเหตุผล และชี้ "ช่องว่างข่าวกรอง" (Intelligence Gaps / PIR) ที่ต้องเติม',
        '   ความเชื่อมั่นให้แยก "รายโดเมนข้อมูล" (AIS/Aviation/Seismic/Space-Wx/OSINT/GNSS) ไม่ใช่รวมก้อนเดียว',
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
        '8) [JP 3-04] ถ่วงน้ำหนักหลักฐานตาม integrity ของฟีด (ดู [Feed-trust] ใน user message):',
        '   AIS = self-reported ปลอมได้ง่าย · DAS fiber/Seismic = เซนเซอร์กายภาพ integrity สูง ·',
        '   OSINT/GDELT = ต้องสอบทานแหล่ง — ฟีดที่ติดธง DEGRADED ให้ลดน้ำหนักหลักฐานจากฟีดนั้น',
        '   และเรียก cross-cue จากแหล่งอิสระ (radar/EO-IR/DAS) ก่อนใช้ยืนยันสมมติฐาน',
        '9) [JP 3-04] วิเคราะห์ informational aspects 6 ด้านของ contact ที่สำคัญ:',
        '   Duration(นานเท่าใด) / Location(ที่ใด) / Timing(จังหวะใด) / Platform(ชนิดใด) / Size(ขนาดใด) / Posture(ท่าทีใด)',
        '   และประเมิน 6 ด้านเดียวกันของ "การปฏิบัติฝ่ายเรา" ที่จะเสนอ — ทุกการกระทำ/ไม่กระทำ',
        '   ล้วนส่งสัญญาณ (observables) ให้ผู้สังเกตตีความเสมอ',
        '10) [Game-Theoretic Adversarial Reasoning] ก่อนสรุป MDCOA ให้จำลองมุมมองฝ่ายตรงข้าม',
        '    แบบเกมสองผู้เล่น (two-player game) — เลือกหนทางที่ให้ "ผลตอบแทนสูงสุดสำหรับฝ่ายตรงข้าม"',
        '    ภายใต้เพดานความเสี่ยง/ทรัพยากรที่สมเหตุสมผลของเขา ไม่ใช่หนทางที่มองเห็นชัดที่สุดสำหรับเรา',
        '    พิจารณาแนวคิดลวง/ล่อ/ซ่อนเจตนา/เลือกจังหวะเอาเปรียบ (deception, decoy, feint, timing exploitation)',
        '    แล้วตรวจสอบตัวเอง: MDCOA ที่เสนอ "ฉลาดที่สุดสำหรับฝ่ายตรงข้าม" จริงหรือไม่ — ถ้ายังไม่ใช่ให้ปรับก่อนสรุป',
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
        '<ให้คะแนน/ระดับแต่ละมิติใน taxonomy ที่มี hit + confidence รายโดเมนข้อมูลอิง [Feed-trust] + ระดับรวม HIGH/ELEVATED/ROUTINE + นัยต่อ ROE>',
        '',
        '🎯 สมมติฐานภัยคุกคาม (Threat Hypotheses):',
        'ข้อเท็จจริงที่ตรวจพบ: <1-2 บรรทัด เฉพาะสิ่งที่เซ็นเซอร์รายงานจริง ยังไม่ใส่การตีความ>',
        '▸ สมมติฐานสุจริต (benign): <คำอธิบายที่ไม่ใช่ภัยคุกคาม> — confidence <H/M/L>',
        '▸ MLCOA (น่าจะเป็นที่สุด): <...> — driver: <แรงขับพฤติกรรม> — confidence <H/M/L>',
        '▸ MDCOA (อันตรายที่สุด): <...> — indicator ที่ต้องเฝ้า',
        '▸ หลักฐานหักล้าง: <ต่อสมมติฐาน — ข้อมูลใดถ้าตรวจพบจะทำให้สมมติฐานนั้นตก (ห้ามข้ามหัวข้อนี้)>',
        '',
        '🛠️ ข้อเสนอแนะการปฏิบัติ (Recommended Actions):',
        '<bullet ผูกกับกำลัง: Patrol Vessel / Guardian UUV / CAP helo / sensor posture — คำนึงถึง context.ownForce (ห้ามวางซ้ำ sector ที่คุมแล้ว / ไม่เกินเพดาน) — เรียงตามลำดับความสำคัญ>',
        'ทุก bullet ปิดท้ายด้วยวงเล็บ 5 ส่วน [JP 3-04]: (ผล: assure/deter/induce/compel ·',
        ' กลไก: แจ้งข่าว/โน้มน้าว/โจมตี-แสวงประโยชน์/ป้องกัน · อำนาจ: ผบ.เรือ/ผบ.ศปก./ศรชล./ระดับนโยบาย ·',
        ' เสี่ยง: โอกาส×ผลกระทบ เช่น L×M · ผลลำดับสอง: <ผลพวง 1 ข้อ>)',
        'ต้องมี ≥1 ทางเลือก "ซื้อเวลาเพื่อประเมินเจตนา" (warning/illuminate/shoulder — intermediate force)',
        'และ ≥1 ช่องทางลดระดับ (de-escalation off-ramp) · สถานการณ์ต่ำกว่าวิกฤติให้มาตรการข่าวสารนำหน้า kinetic',
        '',
        '📡 ช่องว่างข่าวกรอง (Intelligence Gaps / PIR):',
        '<2-4 bullets — ข้อมูลอะไรขาด ต้องเก็บเพิ่มอะไรเพื่อยืนยัน/ตัดสมมติฐาน>',
        '',
        '⚖️ ข้อพิจารณาทางกฎหมาย (Legal Considerations):',
        '<2-4 bullets — อ้าง law/policy เฉพาะเจาะจงตามสถานการณ์จริง ไม่ใช่ลอกทั้งชุด>',
        '',
        '🛡️ ข้อจำกัดและความเชื่อมั่น (Caveats & Confidence):',
        '<HITL · confidence โดยรวม + รายโดเมน · MASS Code level · เตือน demo ถ้า data_mode=demo',
        ' ปิดด้วย reliability footer: ฟีดใดถูกลดน้ำหนัก (DEGRADED) / ข้อมูลใดขาด และผลต่อความแน่นอนของการประเมิน>',
        '',
        '🧭 บทสรุปเชิงเรื่องเล่า (Narrative Conclusion):',
        '<4 ประโยคตามโครง [JP 3-04]: ① สภาพปัจจุบันของสถานการณ์ ② สภาพอนาคตที่ต้องการ',
        ' ③ หนทางที่จะไปถึง (วิธีหลักจากข้อเสนอแนะ) ④ เหตุผลรองรับความชอบธรรม (กฎหมาย/พันธกิจปกป้อง UDC)>',
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

        const cv = ctx.cve;
        if (cv && cv.count) {
            const critC = (cv.items || []).filter(v => v.severity === 'CRITICAL').length;
            lines.push(`- CVE/NVD     : count=${cv.count} (CRITICAL=${critC}) · ICS/SCADA · 30d`);
            (cv.items || []).slice(0, 3).forEach(v =>
                lines.push(`    · [${v.severity}/${v.score}] ${v.id} — ${String(v.description || '').slice(0, 100)}`));
        } else lines.push('- CVE/NVD     : no data (Worker offline หรือ ไม่มี HIGH/CRITICAL ICS CVE ใน 30d)');

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

    // ── [v15.3 JP 3-04·A2] Feed-trust — integrity ต่อฟีด + ธง DEGRADED อัตโนมัติจาก alerts/context ──
    {
        const alertBlob = alerts.map(a => `${a.tag || ''} ${a.msg || ''}`).join(' · ');
        const aisDeg  = /spoof|ปลอม|mmsi|dark|anomal/i.test(alertBlob) || ((((ctx || {}).ais) || {}).anomalies || 0) > 0;
        const gnssDeg = /gnss|gps|jam/i.test(alertBlob) || (((ctx || {}).env || {}).gnssJitter >= 0.5) || ((((ctx || {}).spaceWx) || {}).kp || 0) >= 5;
        lines.push('[Feed-trust] (integrity ต่อฟีด — ใช้ถ่วงน้ำหนักหลักฐานตามหลักการข้อ 8)');
        lines.push(`- AIS (self-reported · ปลอมง่าย) : ${aisDeg ? '⚠ DEGRADED — มีสัญญาณ spoof/anomaly → ลดน้ำหนัก ยืนยันด้วย radar/EO-IR/DAS' : 'NOMINAL (ยังต้อง cross-check เสมอ)'}`);
        lines.push(`- GNSS/PNT                       : ${gnssDeg ? '⚠ DEGRADED — jitter/Kp/jam signature → แยก spoofing ออกจาก space-wx ก่อนสรุป' : 'NOMINAL'}`);
        lines.push('- DAS fiber · Seismic(USGS) · Marine-Wx : HIGH integrity (เซนเซอร์กายภาพ/แหล่งทางการ)');
        lines.push('- Aviation(OpenSky)              : MEDIUM (ADS-B self-reported · coverage ไม่เต็ม)');
        lines.push('- OSINT/GDELT                    : VERIFY (open source — สอบทานแหล่ง/ระวัง IO)');
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

    // [v15.3.1] Gemini 2.5 คิดภายในก่อนตอบ และ thinking นับรวมใน maxOutputTokens
    //   → ต้องใช้เพดานแยก (8192) + จำกัด thinkingBudget ไม่ให้กินพื้นที่คำตอบ
    //   thinkingConfig รองรับเฉพาะ gemini-2.5-* — ส่งให้ 2.0-flash จะ 400 INVALID_ARGUMENT
    const genCfg = {
        temperature: 0.7,
        maxOutputTokens: MAX_TOKENS_GEMINI,
        topP: 0.95
    };
    if (/^gemini-2\.5/.test(model)) {
        genCfg.thinkingConfig = { thinkingBudget: GEMINI_THINKING_BUDGET };
    }

    const body = {
        // system instruction (Gemini แยกจาก contents)
        systemInstruction: { parts: [{ text: system }] },
        contents: [
            { role: 'user', parts: [{ text: userMsg }] }
        ],
        generationConfig: genCfg,
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

// ── provider: Z.AI (Zhipu GLM) ───────────────────────────────────────
// OpenAI-compatible Chat Completions
// https://docs.z.ai/api-reference/llm/chat-completion
async function callZai(env, model, system, userMsg) {
    const key = env.ZAI_API_KEY;
    if (!key) {
        return {
            error: 'ZAI_API_KEY ไม่ได้ตั้ง — เพิ่ม secret: wrangler secret put ZAI_API_KEY',
            status: 500
        };
    }

    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), ZAI_TIMEOUT_MS);

    let resp, data, rawBody = '';
    try {
        resp = await fetch(ZAI_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`
            },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: system },
                    { role: 'user',   content: userMsg }
                ],
                max_tokens: MAX_TOKENS_ZAI,
                temperature: 0.7,
                stream: false
            }),
            signal: ctrl.signal
        });
        // อ่าน body เป็น text ก่อน แล้วค่อย parse — เผื่อ body ไม่ใช่ JSON จะได้เก็บ raw ไว้ debug
        rawBody = await resp.text().catch(() => '');
        try { data = JSON.parse(rawBody); } catch (_) { data = null; }
    } catch (e) {
        clearTimeout(tid);
        const isAbort = e && (e.name === 'AbortError' || /abort/i.test(String(e.message || '')));
        return {
            error: isAbort ? 'Z.AI timeout' : 'Z.AI call failed',
            detail: String(e && e.message || e),
            status: isAbort ? 504 : 502
        };
    }
    clearTimeout(tid);

    // Zhipu/Z.AI คืน error ได้ 2 รูปแบบ แม้ HTTP = 200:
    //   (ก) {error:{message,code}}        — OpenAI-style
    //   (ข) {code, msg, success:false}    — Zhipu native envelope (ไม่มี choices)
    const apiErr = data && data.error;
    const zEnv   = data && !data.choices && (data.msg != null || data.code != null || data.success === false);
    if (!resp.ok || apiErr || zEnv || data == null) {
        let detail;
        if (apiErr) {
            const code = apiErr.code != null ? ' (code ' + apiErr.code + ')' : '';
            detail = String(apiErr.message || apiErr.code || JSON.stringify(apiErr)) + code;
        } else if (zEnv) {
            // ดัมพ์ raw ทั้งซองด้วย เผื่อ msg ว่าง/อยู่ฟิลด์อื่น
            detail = 'msg="' + String(data.msg || data.message || '') + '" code=' + data.code
                   + ' · raw=' + JSON.stringify(data).slice(0, 300);
        } else if (data == null) {
            detail = 'non-JSON body (HTTP ' + resp.status + '): ' + String(rawBody || '').slice(0, 300);
        } else {
            detail = 'HTTP ' + resp.status;
        }
        return { error: 'Z.AI API error', detail, raw: data, status: resp.ok ? 502 : resp.status };
    }

    const choice = data && data.choices && data.choices[0];
    const m = choice && choice.message;
    // GLM reasoning models อาจห่อ chain-of-thought ด้วย <think>…</think> หรือคืน reasoning_content แยก
    let text = ((m && m.content) || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    if (!text && m && m.reasoning_content) text = String(m.reasoning_content).trim();

    if (!text) {
        // surface ว่า Z.AI ตอบหน้าตาแบบไหนกลับมา (raw ถูก strip ออกจาก response ฝั่ง client)
        const shape = 'keys=[' + Object.keys(data).join(',') + ']'
                    + ' · finish=' + ((choice && choice.finish_reason) || 'none')
                    + ' · msgKeys=[' + (m ? Object.keys(m).join(',') : '-') + ']';
        return {
            error: 'Empty response from Z.AI',
            detail: shape,
            raw: data,
            status: 502
        };
    }

    // Normalize usage → input/output_tokens (Anthropic-compatible)
    const um = data.usage || {};
    const usage = {
        input_tokens:  um.prompt_tokens     ?? null,
        output_tokens: um.completion_tokens ?? null,
        total_tokens:  um.total_tokens      ?? null
    };

    return {
        text,
        usage,
        stop_reason: (choice && choice.finish_reason) || null
    };
}

// ── provider: ThaiLLM (BDI) ──────────────────────────────────────────
// v15.6 — OpenAI-compatible Chat Completions (โครงเดียวกับ callZai)
// https://bdi.or.th/thaillm/ · endpoint https://thaillm.or.th/api/v1/chat/completions
async function callThaiLLM(env, model, system, userMsg) {
    const key = env.THAILLM_API_KEY;
    if (!key) {
        return {
            error: 'THAILLM_API_KEY ไม่ได้ตั้ง — เพิ่ม secret: wrangler secret put THAILLM_API_KEY',
            status: 500
        };
    }

    // v15.6.1 — retry 1 ครั้งเมื่อ gateway ThaiLLM ล่มชั่วขณะ (CF คืน "error code: 502"
    // แบบ non-JSON เป็นครั้งคราวต่อ replica) · retry เฉพาะ error ที่เด้งเร็ว —
    // ไม่ retry ตอน timeout เพราะกิน budget 60s ไปแล้ว จะทะลุ client timeout 90s
    const RETRYABLE_HTTP = new Set([429, 500, 502, 503, 504]);
    const MAX_ATTEMPTS = 2;
    let resp, data, rawBody = '';
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), THAILLM_TIMEOUT_MS);
        try {
            resp = await fetch(THAILLM_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`
                },
                body: JSON.stringify({
                    model,
                    messages: [
                        { role: 'system', content: system },
                        { role: 'user',   content: userMsg }
                    ],
                    max_tokens: MAX_TOKENS_THAILLM,
                    temperature: 0.7,
                    stream: false
                }),
                signal: ctrl.signal
            });
            // อ่าน body เป็น text ก่อน แล้วค่อย parse — เผื่อ body ไม่ใช่ JSON จะได้เก็บ raw ไว้ debug
            rawBody = await resp.text().catch(() => '');
            try { data = JSON.parse(rawBody); } catch (_) { data = null; }
        } catch (e) {
            clearTimeout(tid);
            const isAbort = e && (e.name === 'AbortError' || /abort/i.test(String(e.message || '')));
            if (isAbort) {
                return { error: 'ThaiLLM timeout', detail: String(e && e.message || e), status: 504 };
            }
            // network error (ไม่ใช่ timeout) → retry ได้ 1 ครั้ง
            if (attempt < MAX_ATTEMPTS) { await new Promise(r => setTimeout(r, 500)); continue; }
            return { error: 'ThaiLLM call failed', detail: String(e && e.message || e), status: 502 };
        }
        clearTimeout(tid);

        // upstream ล่มชั่วขณะ (CF 429/500/502/503/504 · หรือ body ไม่ใช่ JSON) → retry 1 ครั้ง
        const transient = (!resp.ok && RETRYABLE_HTTP.has(resp.status)) || (data == null);
        if (transient && attempt < MAX_ATTEMPTS) { await new Promise(r => setTimeout(r, 500)); continue; }
        break;
    }

    const apiErr = data && data.error;
    if (!resp.ok || apiErr || data == null) {
        let detail;
        if (apiErr) {
            const code = apiErr.code != null ? ' (code ' + apiErr.code + ')' : '';
            detail = String(apiErr.message || apiErr.code || JSON.stringify(apiErr)) + code;
        } else if (data == null) {
            detail = 'non-JSON body (HTTP ' + resp.status + '): ' + String(rawBody || '').slice(0, 300);
        } else {
            detail = 'HTTP ' + resp.status;
        }
        return { error: 'ThaiLLM API error', detail, raw: data, status: resp.ok ? 502 : resp.status };
    }

    const choice = data && data.choices && data.choices[0];
    const m = choice && choice.message;
    // โมเดล ThaiLLM (โดยเฉพาะตัว *-think) ห่อ chain-of-thought ด้วย <think>…</think> — strip เหมือน GLM
    let text = ((m && m.content) || '').replace(/<think>[\s\S]*?<\/think>/gi, '');
    // qwen3.6-35b-a3b ปล่อย reasoning เป็น preamble ("Here's a thinking process:…") แล้วปิดด้วย </think>
    // เดี่ยว ๆ โดยไม่มี <think> เปิด — regex คู่ด้านบนจับไม่ได้. หลัง strip คู่แล้ว ถ้ายังเหลือ </think>
    // แปลว่าเป็น tag ปิดกำพร้า → ตัดทุกอย่างจนถึงและรวม </think> ตัวสุดท้ายทิ้ง (ใช้ delimiter ของโมเดลเอง
    // ไม่เดาด้วยสัดส่วนอักษรไทย). ปลอดภัยกับอีก 4 โมเดล: ไม่มี </think> → ไม่แตะต้อง
    const orphanClose = text.lastIndexOf('</think>');
    if (orphanClose !== -1) text = text.slice(orphanClose + '</think>'.length);
    text = text.trim();
    if (!text && m && m.reasoning_content) text = String(m.reasoning_content).trim();

    if (!text) {
        const shape = 'keys=[' + Object.keys(data).join(',') + ']'
                    + ' · finish=' + ((choice && choice.finish_reason) || 'none')
                    + ' · msgKeys=[' + (m ? Object.keys(m).join(',') : '-') + ']';
        return {
            error: 'Empty response from ThaiLLM',
            detail: shape,
            raw: data,
            status: 502
        };
    }

    // Normalize usage → input/output_tokens (Anthropic-compatible)
    const um = data.usage || {};
    const usage = {
        input_tokens:  um.prompt_tokens     ?? null,
        output_tokens: um.completion_tokens ?? null,
        total_tokens:  um.total_tokens      ?? null
    };

    return {
        text,
        usage,
        stop_reason: (choice && choice.finish_reason) || null
    };
}

// ── OSINT News proxy (GET /gdelt) ───────────────────────────────────
// fix v15.5.4: multi-source RSS fallback chain (GDELT + Google News block CF IPs)
// Sources: The Diplomat → USNI News → Naval News (อย่างน้อยหนึ่งแหล่งควร accessible)
// Cache 5 min (Cloudflare Cache API, defensive try-catch around cache ops)
const OSINT_SOURCES = [
    { name: 'USNI',      url: 'https://news.usni.org/feed' },
    { name: 'NavalNews', url: 'https://www.navalnews.com/feed/' },
    { name: 'Diplomat',  url: 'https://thediplomat.com/feed/' },
];
const GDELT_CACHE_TTL = 300; // 5 นาที

function parseRssItems(xml) {
    const items = [];
    const itemRe = /<item>([\s\S]*?)<\/item>/g;
    let m;
    while ((m = itemRe.exec(xml)) !== null) {
        const block = m[1];
        const getTag = tag => {
            const hit = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([^<]*)<\\/${tag}>`));
            return hit ? (hit[1] ?? hit[2] ?? '').trim() : '';
        };
        const title   = getTag('title');
        const link    = getTag('link') || (block.match(/<guid[^>]*isPermaLink="true"[^>]*>([^<]*)<\/guid>/)?.[1] ?? '');
        const pubDate = getTag('pubDate');
        const domain  = getTag('source') || (link ? (link.match(/https?:\/\/([^/]+)/)?.[1] ?? '') : '');
        if (title) items.push({ url: link, title, seendate: pubDate, domain });
    }
    return items;
}

async function fetchRss(url) {
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), 10_000);
    try {
        const r = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; RSS-reader/1.0)',
                'Accept': 'application/rss+xml,application/xml,text/xml'
            },
            signal: ctrl.signal
        });
        clearTimeout(tid);
        if (!r.ok) return null;
        return await r.text();
    } catch (_) { clearTimeout(tid); return null; }
}

async function handleGdelt(request) {
    let cache = null, cached = null;
    const cacheKey = new Request('https://shield-osint-v2.internal/gdelt');
    try { cache = caches.default; cached = await cache.match(cacheKey); } catch (_) {}
    if (cached) return cached;

    for (const src of OSINT_SOURCES) {
        const xml = await fetchRss(src.url);
        if (!xml) continue;
        const articles = parseRssItems(xml).slice(0, 20);
        if (articles.length === 0) continue;
        const resp = jsonResponse({ articles, count: articles.length, source: src.name }, 200,
            { 'Cache-Control': `public, max-age=${GDELT_CACHE_TTL}` });
        try { if (cache) await cache.put(cacheKey, resp.clone()); } catch (_) {}
        return resp;
    }

    // ทุก source ล้มเหลว — soft fail 200 ให้ simulator แสดง "ไม่มีข้อมูล" ไม่ใช่ ERR
    return jsonResponse({ articles: [], count: 0, source: 'OSINT', note: 'all-sources-failed' }, 200,
        { 'Cache-Control': 'no-store' });
}

// ── CVE proxy (GET /cve) ─────────────────────────────────────────────
// NVD REST API v2 — SCADA/ICS HIGH+CRITICAL · 90 วันล่าสุด
// env.NVD_API_KEY (optional): wrangler secret put NVD_API_KEY
// ไม่มี key = rate 5 req/30s (เพียงพอสำหรับ poll 600s)
// fix v15.5.1: เพิ่ม pubEndDate (NVD บังคับทั้งคู่), format +00:00 (ไม่ใช่ Z),
//              ขยาย 90d (max 120d), แยก keyword SCADA/ICS (AND → OR)

async function handleCve(env) {
    const now = new Date();
    const d90 = new Date(now.getTime() - 90 * 24 * 3_600_000);
    // NVD v2: ต้องระบุทั้ง pubStartDate + pubEndDate (max range 120d)
    // format: yyyy-MM-ddTHH:mm:ss.mmm+00:00 (Z ไม่รองรับ → 404)
    const fmtNvd = d => encodeURIComponent(d.toISOString().slice(0, 23) + '+00:00');
    const dateRange = `pubStartDate=${fmtNvd(d90)}&pubEndDate=${fmtNvd(now)}`;

    const hdrs = {};
    if (env.NVD_API_KEY) hdrs['apiKey'] = env.NVD_API_KEY;

    // keyword แยกกัน (SCADA+ICS = AND → เจาะจงเกินไป, ใช้แยกเพื่อ OR ผ่าน merge)
    const fetchKwSev = async (kw, sev) => {
        const url = `https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=${kw}&${dateRange}&cvssV3Severity=${sev}&resultsPerPage=10`;
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 15_000);
        try {
            const r = await fetch(url, { headers: hdrs, signal: ctrl.signal });
            clearTimeout(tid);
            if (!r.ok) return [];
            const d = await r.json();
            return (d && d.vulnerabilities) || [];
        } catch (_) { clearTimeout(tid); return []; }
    };

    // 4 calls: SCADA-CRITICAL, ICS-CRITICAL, SCADA-HIGH, ICS-HIGH
    const [sc, ic, sh, ih] = await Promise.all([
        fetchKwSev('SCADA', 'CRITICAL'),
        fetchKwSev('ICS',   'CRITICAL'),
        fetchKwSev('SCADA', 'HIGH'),
        fetchKwSev('ICS',   'HIGH'),
    ]);
    const crit = [...sc, ...ic];
    const high = [...sh, ...ih];

    // dedup + ไม่เกิน 15 รายการ (CRITICAL ก่อน)
    const seen = new Set();
    const merged = [...crit, ...high].filter(v => {
        const id = v?.cve?.id;
        if (!id || seen.has(id)) return false;
        seen.add(id); return true;
    }).slice(0, 15);

    const vulnerabilities = merged.map(v => {
        const c = v.cve || {};
        const m = c.metrics || {};
        const cvss = m.cvssMetricV31?.[0]?.cvssData || m.cvssMetricV30?.[0]?.cvssData || null;
        const desc = (c.descriptions || []).find(d => d.lang === 'en')?.value || '';
        return {
            id: c.id,
            published: c.published,
            severity: cvss?.baseSeverity || 'UNKNOWN',
            score: cvss?.baseScore ?? null,
            description: desc.slice(0, 200)
        };
    });

    return jsonResponse({
        count: vulnerabilities.length,
        vulnerabilities,
        source: 'NVD',
        fetched: now.toISOString()
    }, 200, { 'Cache-Control': 'public, max-age=540' });
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
    } else if (provider === 'zhipu-zai') {
        result = await callZai(env, model, system, userMsg);
    } else if (provider === 'thaillm') {
        result = await callThaiLLM(env, model, system, userMsg);
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
                    },
                    'zhipu-zai': {
                        configured: !!env.ZAI_API_KEY,
                        models: Array.from(ZAI_MODELS)
                    },
                    'thaillm': {
                        configured: !!env.THAILLM_API_KEY,
                        models: Array.from(THAILLM_MODELS)
                    }
                },
                model_default: DEFAULT_MODEL,
                models_allowed: Array.from(ALLOWED_MODELS),
                proxy_endpoints: {
                    'GET /gdelt': 'GDELT 2.0 OSINT proxy (ภูมิภาค + maritime keyword)',
                    'GET /cve':   'NVD CVE proxy (SCADA/ICS · HIGH+CRITICAL · 30d)',
                    'nvd_api_key_configured': !!env.NVD_API_KEY
                }
            });
        }

        // GDELT proxy — bypass browser CORS
        if (request.method === 'GET' && url.pathname === '/gdelt') {
            return handleGdelt(request);
        }

        // CVE proxy — NVD API (SCADA/ICS) bypass CORS
        if (request.method === 'GET' && url.pathname === '/cve') {
            return handleCve(env);
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
