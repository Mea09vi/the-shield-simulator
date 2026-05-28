# THE SHIELD 2.0 · AI Proxy — Deploy Guide

Cloudflare Workers AI · v14.0.5

ตัวกลาง (relay) ระหว่าง UDC Simulator (client) → Cloudflare Workers AI
(Llama 3.3 70B / DeepSeek R1 / Qwen 2.5 — เลือกได้จาก client)

**ฟรี 100%** — ไม่ต้อง API key ภายนอก, ใช้ Cloudflare account binding
(โควต้าฟรี: 10,000 neurons/วัน · ≈ หลายร้อย analysis/วัน)

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

## 2) Deploy (ไม่ต้องตั้ง secret ใดๆ)

```bash
cd workers
wrangler deploy
```

ผลลัพธ์ตัวอย่าง:

```
 Your Worker has access to the following bindings:
 - AI:
   - Name: AI
 Total Upload: 8.21 KiB / gzip: 2.51 KiB
 Uploaded shield-ai-proxy (1.42 sec)
 Published shield-ai-proxy (0.30 sec)
   https://shield-ai-proxy.<your-subdomain>.workers.dev
```

ครั้งแรกอาจถามว่าจะสร้าง Worker ใหม่ไหม → ตอบ **Yes**

**คัดลอก URL** ที่ได้ — จะใช้ตั้งใน UDC Simulator

> 💡 **ไม่มี secret** — Workers AI binding ใช้ Cloudflare account context อัตโนมัติ
> ไม่ต้องสมัครบัญชี Anthropic / Google / Groq ใดๆ

---

## 3) (ทางเลือก) ปรับ `wrangler.toml`

ดู `workers/wrangler.toml`:

- `name`         — เปลี่ยนได้ตามต้องการ (default: `shield-ai-proxy`)
- `account_id`   — ปกติ wrangler หาเองได้; uncomment ถ้ามีหลายบัญชี
- `routes`       — uncomment ถ้าจะใช้ Custom Domain แทน `*.workers.dev`
- `[vars] DEFAULT_MODEL` — เปลี่ยน model ฟรีตัวอื่นใน Workers AI ได้
- `[ai] binding = "AI"`  — **ห้ามลบ** — เป็น Workers AI binding

---

## 4) ตรวจสอบ Worker ทำงาน

### Health check (GET)

```bash
curl https://shield-ai-proxy.<your-subdomain>.workers.dev/health
```

ควรได้:

```json
{
  "ok": true,
  "service": "shield-ai-proxy",
  "version": "14.0.5",
  "provider": "cloudflare-workers-ai",
  "model_default": "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  "models_allowed": [
    "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    "@cf/meta/llama-3.1-70b-instruct",
    "@cf/meta/llama-3.1-8b-instruct",
    "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
    "@cf/qwen/qwen2.5-coder-32b-instruct",
    "@cf/mistralai/mistral-small-3.1-24b-instruct"
  ]
}
```

### Smoke test (POST)

```bash
curl -X POST https://shield-ai-proxy.<your-subdomain>.workers.dev \
  -H "Content-Type: application/json" \
  -d '{
    "taxonomy": {"kinetic":1,"asymmetric":1,"cyber":0,"environmental":0,"hybrid":0},
    "alerts": [
      {"severity":"warn","tag":"KINETIC","msg":"test contact","conf":0.7,"ts":"00:00:00"}
    ]
  }'
```

ควรได้ JSON `{ text, model, usage, latency_ms, version }`
**Latency ปกติ:** 1-4 วินาที (เร็วกว่า Claude Opus มาก)

---

## 5) ตั้งค่าใน UDC Simulator

1. เปิด `UDC_Simulator_14.html`
2. คลิกปุ่ม 🧠 AI ใน header → modal เปิด
3. ใน toolbar คลิก ⚙ Settings
4. วาง URL ของ Worker ที่ได้จากขั้นตอน 2
5. คลิก mode pill `OPUS` → จะเปลี่ยนเป็น `online · Workers AI`
6. คลิก `✨ Run Opus Analysis` → จะเรียก Llama 3.3 จริงผ่าน Worker

URL จะถูก save ใน `localStorage` (key: `shield_ai_proxy_url`)
ครั้งต่อไปเปิด simulator จะดึงค่ามาใช้อัตโนมัติ

---

## 6) Endpoints

| Method | Path     | Body                                | Response |
|--------|----------|-------------------------------------|----------|
| GET    | `/health`| —                                   | `{ ok, version, model_default, models_allowed }` |
| POST   | `/`      | `{ taxonomy, alerts, model? }`      | `{ text, model, usage, latency_ms }` |
| OPTIONS| `/*`     | —                                   | CORS preflight (204) |

Rate limit: 30 req/min ต่อ IP (in-memory, per-isolate)

---

## 7) เลือก Model อื่น (ทางเลือก)

ส่ง `model` ใน POST body — ต้องอยู่ใน allow-list:

```bash
curl -X POST https://shield-ai-proxy.<your-subdomain>.workers.dev \
  -H "Content-Type: application/json" \
  -d '{
    "model": "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
    "taxonomy": {"kinetic":2,"asymmetric":0,"cyber":1,"environmental":0,"hybrid":0},
    "alerts": []
  }'
```

**Model ที่แนะนำตามงาน:**
- `llama-3.3-70b-instruct-fp8-fast` ⭐ default — ดีสุดสำหรับ Thai + เร็ว
- `deepseek-r1-distill-qwen-32b` — มี chain-of-thought reasoning (ช้ากว่าแต่ตอบลึก)
- `llama-3.1-8b-instruct` — เร็วสุด (สำหรับ live demo) คุณภาพต่ำลงบ้าง

---

## 8) อัพเดท Worker

แก้ `workers/ai-proxy.js` แล้ว run อีกครั้ง:

```bash
wrangler deploy
```

URL เดิมไม่เปลี่ยน — UI ไม่ต้องตั้งค่าใหม่

---

## 9) Tail logs (debug)

```bash
wrangler tail
```

จะแสดง log สดของทุก request

---

## 10) ตรวจสอบ Neuron Quota

ที่ Cloudflare Dashboard → Workers AI → Analytics
- Free plan: **10,000 neurons/วัน**
- 1 analysis ≈ 50-200 neurons (ขึ้นกับ model + token count)
- ≈ 50-200 analysis/วัน บน free tier

ถ้าโควต้าหมด: Worker จะตอบ 500 พร้อม error message
จากนั้นรอ reset ตอนเที่ยงคืน UTC (07:00 ICT)

---

## 11) Security Notes

- **ไม่มี API key** ต้องเก็บ — Workers AI ใช้ account binding
- ตอนนี้ `Access-Control-Allow-Origin: *` — ใครเรียก endpoint ก็ได้
  ถ้าต้องการ harden ให้แก้ใน `ai-proxy.js`:
  ```js
  const ALLOWED_ORIGINS = ['https://yourdomain.com'];
  // ตรวจ origin จาก request.headers.get('Origin')
  ```
- Rate limit เป็น in-memory (per-isolate) — เหมาะ demo
  สำหรับ production แนะนำใช้ Cloudflare Durable Objects หรือ KV

---

## 12) ถ้าจะลบ Worker

```bash
wrangler delete
```

(ไม่มี secret ที่ต้องลบเพราะ Workers AI ไม่ใช้ secret)
