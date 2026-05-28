# THE SHIELD 2.0 · AI Proxy — Deploy Guide

Multi-provider AI relay · v14.0.7

ตัวกลาง (relay) ระหว่าง UDC Simulator (client) → LLM provider 2 ราย:

| Provider              | Models                                                    | Cost                                |
|-----------------------|-----------------------------------------------------------|-------------------------------------|
| Cloudflare Workers AI | `@cf/meta/llama-3.3-70b-fp8`, DeepSeek R1, Qwen 2.5 ฯลฯ   | ฟรี · 10,000 neurons/วัน            |
| Google Gemini         | `gemini-2.5-flash` (default), `gemini-2.5-pro`            | ฟรี ~10 RPM (2.5-flash)             |
| Google Gemini (paid)  | `gemini-2.0-flash`                                        | ⚠ ต้องผูก billing (free=0 ปี 2025) |

Worker จะเลือก provider อัตโนมัติจาก model id ที่ client ส่งมา:
- prefix `@cf/`     → Workers AI (ใช้ binding · ไม่ต้องมี API key)
- prefix `gemini-`  → Gemini REST (ต้องตั้ง `GEMINI_API_KEY` เป็น secret)

---

## 1) ติดตั้งเครื่องมือ

```bash
npm install -g wrangler
wrangler --version    # ควร >= 3.0
```

ลงชื่อเข้าใช้ Cloudflare:

```bash
wrangler login
```

(เปิด browser → อนุมัติบัญชี → กลับมาที่ terminal)

---

## 2) (ทางเลือก) ตั้ง Gemini API key

ถ้าจะใช้ Gemini (default ของ v14.0.7) ต้องเอา API key มาก่อน:

1. ไปที่ <https://aistudio.google.com/apikey>
2. ล็อกอินด้วย Google account
3. กด **Create API key** → คัดลอกค่า

ตั้งเป็น Cloudflare secret (ไม่อยู่ในไฟล์ใดๆ ของ repo):

```bash
cd workers
wrangler secret put GEMINI_API_KEY
# กด Enter หลังพิมพ์คำสั่ง → รอ prompt "Enter a secret value:" → ค่อยวาง key
```

> ⚠ **ระวัง**: อย่าวาง key ต่อท้าย `wrangler secret put GEMINI_API_KEY` ในบรรทัดเดียว
> เพราะค่า key จะกลายเป็นส่วนหนึ่งของ **ชื่อ** secret (ไม่ใช่ค่า) → Worker หาไม่เจอ
> และ key จะรั่วผ่าน `wrangler secret list` (ต้อง revoke + สร้างใหม่ทันที)

ตรวจสอบ:

```bash
wrangler secret list
# → [{ "name": "GEMINI_API_KEY", "type": "secret_text" }]
```

> 💡 **ถ้าไม่ตั้ง GEMINI_API_KEY** → model `gemini-*` จะคืน error 500
> Workers AI models (`@cf/...`) ยังใช้ได้ปกติ ไม่ต้องการ key

ลบ secret (ถ้าต้องการ):
```bash
wrangler secret delete GEMINI_API_KEY
```

---

## 3) Deploy

```bash
cd workers
wrangler deploy
```

ผลลัพธ์ตัวอย่าง:

```
 Your Worker has access to the following bindings:
 - AI:
   - Name: AI
 - Secret:
   - GEMINI_API_KEY: (hidden)
 Total Upload: 11.4 KiB / gzip: 3.62 KiB
 Uploaded shield-ai-proxy (1.42 sec)
 Published shield-ai-proxy (0.30 sec)
   https://shield-ai-proxy.<your-subdomain>.workers.dev
```

ครั้งแรกอาจถามว่าจะสร้าง Worker ใหม่ไหม → ตอบ **Yes**

**คัดลอก URL** ที่ได้ — จะใช้ตั้งใน UDC Simulator

---

## 4) (ทางเลือก) ปรับ `wrangler.toml`

ดู `workers/wrangler.toml`:

- `name`         — เปลี่ยนได้ตามต้องการ (default: `shield-ai-proxy`)
- `account_id`   — ปกติ wrangler หาเองได้; uncomment ถ้ามีหลายบัญชี
- `routes`       — uncomment ถ้าจะใช้ Custom Domain แทน `*.workers.dev`
- `[vars] DEFAULT_MODEL` — เปลี่ยน default model ได้ (server-side default)
- `[ai] binding = "AI"`  — **ห้ามลบ** — เป็น Workers AI binding

---

## 5) ตรวจสอบ Worker ทำงาน

### Health check (GET)

```bash
curl https://shield-ai-proxy.<your-subdomain>.workers.dev/health
```

ควรได้:

```json
{
  "ok": true,
  "service": "shield-ai-proxy",
  "version": "14.0.7",
  "providers": {
    "cloudflare-workers-ai": {
      "configured": true,
      "models": ["@cf/meta/llama-3.3-70b-instruct-fp8-fast", "..."]
    },
    "google-gemini": {
      "configured": true,
      "models": ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"]
    }
  },
  "model_default": "gemini-2.5-flash",
  "models_allowed": ["..."]
}
```

> `providers.google-gemini.configured: false` หมายถึงยังไม่ได้ตั้ง `GEMINI_API_KEY`

### Smoke test (POST · Gemini default)

```bash
curl -X POST https://shield-ai-proxy.<your-subdomain>.workers.dev \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-2.5-flash",
    "taxonomy": {"kinetic":1,"asymmetric":1,"cyber":0,"environmental":0,"hybrid":0},
    "alerts": [
      {"severity":"warn","tag":"KINETIC","msg":"test contact","conf":0.7,"ts":"00:00:00"}
    ]
  }'
```

### Smoke test (POST · Workers AI)

```bash
curl -X POST https://shield-ai-proxy.<your-subdomain>.workers.dev \
  -H "Content-Type: application/json" \
  -d '{
    "model": "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    "taxonomy": {"kinetic":2,"asymmetric":0,"cyber":1,"environmental":0,"hybrid":0},
    "alerts": []
  }'
```

ทั้งสอง endpoint ตอบ JSON `{ text, model, provider, usage, latency_ms, version }`

**Latency ปกติ:**
- Gemini 2.5 Flash: ~6-9 วินาที (รวม thinking tokens)
- Workers AI Llama 3.3: ~2-10 วินาที
- Gemini 2.5 Pro: ~3-6 วินาที
- Gemini 2.0 Flash: ~1-2 วินาที (ต้องผูก billing)

---

## 6) ตั้งค่าใน UDC Simulator

1. เปิด `UDC_Simulator_14.html`
2. คลิกปุ่ม 🧠 AI ใน header → modal เปิด
3. ใน toolbar:
   - คลิก ⚙ **Settings** → วาง URL ของ Worker (จากขั้น 3)
   - dropdown **MODEL** → เลือก provider/model ที่ต้องการ
4. คลิก mode pill `LLM` → จะเปลี่ยนเป็น `online · <provider>`
5. คลิก `✨ Run LLM Analysis` → จะเรียก provider ที่เลือกผ่าน Worker

URL/model จะถูก save ใน `localStorage`:
- `shield_ai_proxy_url`  → Worker URL
- `shield_ai_model`      → model id ที่เลือก

ครั้งต่อไปเปิด simulator จะดึงค่ามาใช้อัตโนมัติ

---

## 7) Endpoints

| Method | Path     | Body                                       | Response |
|--------|----------|--------------------------------------------|----------|
| GET    | `/health`| —                                          | `{ ok, version, providers, model_default, models_allowed }` |
| POST   | `/`      | `{ taxonomy, alerts, model? }`             | `{ text, model, provider, usage, latency_ms, version }` |
| OPTIONS| `/*`     | —                                          | CORS preflight (204) |

Rate limit: 30 req/min ต่อ IP (in-memory, per-isolate)

---

## 8) เลือก Model

ส่ง `model` ใน POST body — ต้องอยู่ใน allow-list ของ Worker:

**Google Gemini** (ต้องตั้ง `GEMINI_API_KEY`)
- `gemini-2.5-flash` ⭐ default — ฟรี ~10 RPM · balanced + มี thinking tokens
- `gemini-2.5-pro` — best quality (quota ต่ำกว่า · ใช้สำหรับงาน final review)
- `gemini-2.0-flash` — ⚠ Google ย้ายไป paid tier (free_tier_requests = 0 ตั้งแต่ 2025) · ต้องผูก billing
- ~~`gemini-1.5-flash` / `gemini-1.5-pro`~~ — Google deprecated จาก v1beta ตั้งแต่ปี 2025

**Cloudflare Workers AI** (ไม่ต้องมี key)
- `@cf/meta/llama-3.3-70b-instruct-fp8-fast` — ดีสุดสำหรับ Thai
- `@cf/deepseek-ai/deepseek-r1-distill-qwen-32b` — chain-of-thought reasoning
- `@cf/meta/llama-3.1-8b-instruct` — เร็วสุด (สำหรับ live demo)

---

## 9) อัพเดท Worker

แก้ `workers/ai-proxy.js` แล้ว run อีกครั้ง:

```bash
wrangler deploy
```

URL เดิมไม่เปลี่ยน — UI ไม่ต้องตั้งค่าใหม่
Secrets จะคงอยู่ระหว่าง deploy

---

## 10) Tail logs (debug)

```bash
wrangler tail
```

จะแสดง log สดของทุก request

---

## 11) ตรวจสอบ Quota

### Cloudflare Workers AI
- Dashboard → Workers AI → Analytics
- Free plan: **10,000 neurons/วัน**
- 1 analysis ≈ 50-200 neurons → ≈ 50-200 analysis/วัน
- โควต้าหมด: Worker คืน 500 พร้อม error · รอ reset ตอนเที่ยงคืน UTC (07:00 ICT)

### Google Gemini
- Dashboard: <https://aistudio.google.com/apikey>
- Free tier `gemini-2.5-flash`: **~10 RPM / 250 RPD / 250k TPM** (Tier 0)
- `gemini-2.0-flash` Free tier = 0 → ต้องอัปเป็น Tier 1+ (ผูก billing) ถึงจะใช้ได้
- โควต้าหมด: API คืน 429 · Worker forward ต่อให้ client
- รายละเอียด: <https://ai.google.dev/gemini-api/docs/rate-limits>

---

## 12) Security Notes

- **Workers AI**: ไม่มี secret — ใช้ account binding
- **Gemini**: `GEMINI_API_KEY` เก็บเป็น Cloudflare secret (ไม่อยู่ใน repo / client)
  - **อย่า** commit key ลง git
  - **อย่า** ใส่ key ใน HTML/JS ใดๆ ของ client
  - ถ้า key รั่ว: revoke ที่ <https://aistudio.google.com/apikey> → สร้างใหม่ → `wrangler secret put GEMINI_API_KEY` อีกรอบ
- ตอนนี้ `Access-Control-Allow-Origin: *` — ใครเรียก endpoint ก็ได้
  ถ้าต้องการ harden ให้แก้ใน `ai-proxy.js`:
  ```js
  const ALLOWED_ORIGINS = ['https://yourdomain.com'];
  // ตรวจ origin จาก request.headers.get('Origin')
  ```
- Rate limit เป็น in-memory (per-isolate) — เหมาะ demo
  สำหรับ production แนะนำใช้ Cloudflare Durable Objects หรือ KV

---

## 13) ถ้าจะลบ Worker

```bash
wrangler secret delete GEMINI_API_KEY   # (ถ้าตั้งไว้)
wrangler delete
```
