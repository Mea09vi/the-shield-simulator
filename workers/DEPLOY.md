# THE SHIELD 2.0 · AI Proxy — Deploy Guide

Cloudflare Workers · v14.0.4

ตัวกลาง (relay) ระหว่าง UDC Simulator (client) → Claude Opus API
เก็บ `ANTHROPIC_API_KEY` เป็น Worker Secret เท่านั้น — ป้องกัน key
หลุดสู่ public repo

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

## 2) ตั้ง API Key (Worker Secret)

```bash
cd workers
wrangler secret put ANTHROPIC_API_KEY
```

เมื่อ wrangler ขอ value ให้วาง API key จาก https://console.anthropic.com

หมายเหตุ:
- Key ไม่ปรากฏใน `wrangler.toml`, ไม่ปรากฏใน git
- ใช้ `wrangler secret list` ตรวจสอบว่า secret ถูก set แล้ว
- หากต้องการลบ: `wrangler secret delete ANTHROPIC_API_KEY`

---

## 3) (ทางเลือก) ปรับ `wrangler.toml`

ดู `workers/wrangler.toml`:

- `name`        — เปลี่ยนได้ตามต้องการ (default: `shield-ai-proxy`)
- `account_id`  — ปกติ wrangler หาเองได้; uncomment ถ้ามีหลายบัญชี
- `routes`      — uncomment ถ้าจะใช้ Custom Domain แทน `*.workers.dev`
- `[vars] DEFAULT_MODEL` — เปลี่ยนรุ่น Opus ได้

---

## 4) Deploy

```bash
cd workers
wrangler deploy
```

ผลลัพธ์ตัวอย่าง:

```
 Total Upload: 7.92 KiB / gzip: 2.43 KiB
 Uploaded shield-ai-proxy (1.42 sec)
 Published shield-ai-proxy (0.30 sec)
   https://shield-ai-proxy.<your-subdomain>.workers.dev
```

**คัดลอก URL** ที่ได้ — จะใช้ตั้งใน UDC Simulator

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
  "version": "14.0.4",
  "model_default": "claude-opus-4-20250514"
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

---

## 6) ตั้งค่าใน UDC Simulator

1. เปิด `UDC_Simulator_14.html`
2. คลิกปุ่ม 🧠 AI ใน header → modal เปิด
3. ใน toolbar คลิก ⚙ (เกียร์)
4. วาง URL ของ Worker ที่ได้จากขั้นตอน 4
5. คลิก mode pill `OPUS` → จะเปลี่ยนเป็น `online · Claude Opus`
6. คลิก `✨ Run Opus Analysis` → จะเรียก Claude จริงผ่าน Worker

URL จะถูก save ใน `localStorage` (key: `shield_ai_proxy_url`)
ครั้งต่อไปเปิด simulator จะดึงค่ามาใช้อัตโนมัติ

---

## 7) Endpoints

| Method | Path     | Body                                | Response |
|--------|----------|-------------------------------------|----------|
| GET    | `/health`| —                                   | `{ ok, version, model_default }` |
| POST   | `/`      | `{ taxonomy, alerts, model? }`      | `{ text, model, usage, latency_ms }` |
| OPTIONS| `/*`     | —                                   | CORS preflight (204) |

Rate limit: 30 req/min ต่อ IP (in-memory, per-isolate)

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

## 10) Security Notes

- API key อยู่ใน Worker Secret — **ห้าม** commit key สู่ git
- ตอนนี้ `Access-Control-Allow-Origin: *` — ใครเรียก endpoint ก็ได้
  ถ้าต้องการ harden ให้แก้ใน `ai-proxy.js`:
  ```js
  const ALLOWED_ORIGINS = ['https://yourdomain.com'];
  // ตรวจ origin จาก request.headers.get('Origin')
  ```
- Rate limit เป็น in-memory (per-isolate) — เหมาะ demo
  สำหรับ production แนะนำใช้ Cloudflare Durable Objects หรือ KV
