// ===========================================================================
//  4D Ocean LIVE server — demo-safe local helper for UDC_Simulator
//  • Serves the simulator folder (static) so the page is SAME-ORIGIN with the
//    /ocean4d endpoint (no browser CORS problem at all).
//  • GET /ocean4d  -> fetches HYCOM ESPC-D-V02 (uv3z + ts3z) live over the
//    Sattahip box, computes sound speed (Mackenzie 1981), returns the SAME
//    JSON shape as the embedded baked snapshot. Node fetch ignores CORS, so
//    this works where the browser cannot.
//  • Server-side cache + boot pre-warm so the browser gets an instant answer.
//  • If HYCOM is unreachable the endpoint returns 502; the PAGE then falls
//    back to its embedded baked snapshot — worst case = today's behavior.
//
//  RUN (demo):  node ocean4d_live_server.js
//      then open  http://localhost:8765/index.html
//  Optional:    node ocean4d_live_server.js <rootDir> <port>
// ===========================================================================
const http = require('http');
const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(process.argv[2] || __dirname);
const PORT = +(process.env.O4_PORT || process.argv[3] || 8765);

const TDS = 'https://tds.hycom.org/thredds/dodsC';
const UV  = `${TDS}/FMRC_ESPC-D-V02_uv3z/FMRC_ESPC-D-V02_uv3z_best.ncd`;
const TS  = `${TDS}/FMRC_ESPC-D-V02_ts3z/FMRC_ESPC-D-V02_ts3z_best.ncd`;

// Fixed spatial slab over the Sattahip sector — identical to the offline bake
// so the live grid matches the embedded snapshot (sliders stay in sync).
const DSLAB = { d: [0, 1, 17], y: [2307, 1, 2328], x: [1255, 1, 1265] };
const N_FRAMES = 6;                  // nowcast + 5 daily forecast frames
const CACHE_MS = 30 * 60 * 1000;     // refresh live cache every 30 min
const FETCH_TIMEOUT = 60000;         // per OPeNDAP request

const MIME = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.geojson': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.csv': 'text/csv; charset=utf-8',
};

// ── HYCOM OPeNDAP helpers (ported from the offline bake) ───────────────────
async function ascii(url) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.text();
    } catch (e) {
      if (attempt === 1) throw e;
    }
  }
}
function parse1D(text, name) {
  const lines = text.split('\n');
  let i = lines.findIndex(l => l.trim().startsWith(name + '['));
  const vals = [];
  for (let j = i + 1; j < lines.length; j++) {
    const ln = lines[j].trim(); if (!ln) break;
    for (const t of ln.split(',')) { const s = t.trim(); if (s) vals.push(parseFloat(s)); }
  }
  return vals;
}
function parseGrid(text, varName) {
  const lines = text.split('\n');
  const dataTag = varName + '.' + varName + '[';
  let i = lines.findIndex(l => l.startsWith(dataTag));
  if (i < 0) throw new Error('data tag not found: ' + varName);
  const rows = [];
  for (let j = i + 1; j < lines.length; j++) {
    const ln = lines[j].trim(); if (!ln) break;
    const m = ln.match(/^\[(\d+)\]\[(\d+)\]\[(\d+)\],\s*(.*)$/);
    if (!m) break;
    rows.push({ t: +m[1], d: +m[2], y: +m[3], vals: m[4].split(',').map(s => { const v = s.trim(); return v === 'NaN' ? NaN : parseFloat(v); }) });
  }
  const mapVec = name => {
    const tag = varName + '.' + name + '[';
    let k = lines.findIndex(l => l.startsWith(tag));
    const out = [];
    for (let p = k + 1; p < lines.length; p++) { const ln = lines[p].trim(); if (!ln) break; for (const s of ln.split(',')) { const z = s.trim(); if (z) out.push(parseFloat(z)); } }
    return out;
  };
  const time = mapVec('time'), depth = mapVec('depth'), lat = mapVec('lat'), lon = mapVec('lon');
  const nt = time.length, nd = depth.length, ny = lat.length, nx = lon.length;
  const A = [];
  for (let t = 0; t < nt; t++) { A[t] = []; for (let d = 0; d < nd; d++) { A[t][d] = []; for (let y = 0; y < ny; y++) A[t][d][y] = new Array(nx).fill(NaN); } }
  for (const r of rows) for (let x = 0; x < r.vals.length; x++) A[r.t][r.d][r.y][x] = r.vals[x];
  return { A, time, depth, lat, lon, nt, nd, ny, nx };
}
function soundSpeed(T, S, D) {
  if (!isFinite(T) || !isFinite(S)) return NaN;
  return 1448.96 + 4.591 * T - 5.304e-2 * T * T + 2.374e-4 * T * T * T
    + 1.340 * (S - 35) + 1.630e-2 * D + 1.675e-7 * D * D
    - 1.025e-2 * T * (S - 35) - 7.139e-13 * T * D * D * D;
}

// ── build a fresh 4D ocean snapshot from live HYCOM ────────────────────────
async function buildLive() {
  // time axis + units -> pick "today" frame + daily forecast steps
  const tax = parse1D(await ascii(UV + '.ascii?time'), 'time');
  const das = await ascii(UV + '.das');
  const tu = (das.match(/time\s*\{[\s\S]*?units\s+"([^"]+)"/) || [])[1] || 'hours since 2000-01-01 00:00:00';
  const um = tu.match(/(hours?|days?|minutes?|seconds?)\s+since\s+([\d:\-\. T]+)/i);
  const epoch = new Date(um[2].trim().replace(' ', 'T').replace(/\.\d+$/, '') + 'Z').getTime();
  const mul = um[1].toLowerCase().startsWith('hour') ? 3600e3 : um[1].toLowerCase().startsWith('day') ? 86400e3 : um[1].toLowerCase().startsWith('min') ? 60e3 : 1e3;
  const tms = tax.map(h => epoch + h * mul);
  const now = Date.now();

  // nowcast frame = latest time at/just-before now (+6h tolerance)
  let i0 = 0;
  for (let i = 0; i < tms.length; i++) { if (tms[i] <= now + 6 * 3600e3) i0 = i; }
  // daily stride sampled near i0
  let dt = 86400e3;
  for (let i = i0; i < Math.min(tms.length - 1, i0 + 12); i++) { const g = tms[i + 1] - tms[i]; if (g > 0) { dt = g; break; } }
  const stride = Math.max(1, Math.round(86400e3 / dt));
  const tEnd = Math.min(tms.length - 1, i0 + stride * (N_FRAMES - 1));
  const tSlab = [i0, stride, tEnd];
  const ss = `[${tSlab[0]}:${tSlab[1]}:${tSlab[2]}][${DSLAB.d[0]}:${DSLAB.d[1]}:${DSLAB.d[2]}][${DSLAB.y[0]}:${DSLAB.y[1]}:${DSLAB.y[2]}][${DSLAB.x[0]}:${DSLAB.x[1]}:${DSLAB.x[2]}]`;

  const u = parseGrid(await ascii(UV + '.ascii?water_u' + ss), 'water_u');
  const v = parseGrid(await ascii(UV + '.ascii?water_v' + ss), 'water_v');
  const T = parseGrid(await ascii(TS + '.ascii?water_temp' + ss), 'water_temp');
  const S = parseGrid(await ascii(TS + '.ascii?salinity' + ss), 'salinity');

  const { nt, nd, ny, nx } = u;
  for (const g of [v, T, S]) if (g.nt !== nt || g.nd !== nd || g.ny !== ny || g.nx !== nx) throw new Error('grid mismatch');

  const r = (x, p) => (isFinite(x) ? +x.toFixed(p) : null);
  const flatU = [], flatV = [], flatT = [], flatC = [];
  let wet = 0;
  for (let t = 0; t < nt; t++) for (let d = 0; d < nd; d++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const Tv = T.A[t][d][y][x], Sv = S.A[t][d][y][x], Uv = u.A[t][d][y][x], Vv = v.A[t][d][y][x];
    const c = soundSpeed(Tv, Sv, T.depth[d]);
    flatU.push(r(Uv, 3)); flatV.push(r(Vv, 3)); flatT.push(r(Tv, 2)); flatC.push(r(c, 1));
    if (isFinite(c)) wet++;
  }
  if (wet === 0) throw new Error('no wet cells (bad slab?)');

  return {
    source: 'HYCOM ESPC-D-V02 Global 1/12deg (NRL/FNMOC) FMRC-best',
    product: 'uv3z (currents) + ts3z (temp/salinity)',
    method: 'sound speed = Mackenzie(1981) 9-term from T,S,depth',
    baked: new Date().toISOString().slice(0, 16) + 'Z',
    mode: 'live',
    region: 'Gulf of Thailand (Sattahip sector)',
    grid: {
      lat: u.lat.map(z => +z.toFixed(3)),
      lon: u.lon.map(z => +z.toFixed(3)),
      depth: u.depth.map(z => Math.round(z)),
      timeISO: u.time.map(h => new Date(epoch + h * mul).toISOString().slice(0, 16) + 'Z'),
    },
    dims: { nt, nd, ny, nx },
    order: 'flat row-major; index = ((t*nd+d)*ny+y)*nx+x',
    units: { u: 'm/s (east)', v: 'm/s (north)', temp: 'degC', c: 'm/s' },
    u: flatU, v: flatV, temp: flatT, c: flatC,
  };
}

// ── cache + in-flight coalescing ───────────────────────────────────────────
let cache = { at: 0, data: null };
let inflight = null;
function getLive(force) {
  const now = Date.now();
  if (!force && cache.data && (now - cache.at) < CACHE_MS) return Promise.resolve(cache.data);
  if (inflight) return inflight;
  inflight = buildLive().then(d => {
    cache = { at: Date.now(), data: d };
    inflight = null;
    console.log(`[ocean4d] live cache updated ${d.baked} · frames ${d.grid.timeISO[0]}…${d.grid.timeISO[d.dims.nt - 1]} · ${d.dims.nd} levels`);
    return d;
  }).catch(e => { inflight = null; throw e; });
  return inflight;
}

// ── static file serving (under ROOT only) ──────────────────────────────────
function serveStatic(req, res) {
  let urlPath = decodeURIComponent((req.url.split('?')[0]) || '/');
  if (urlPath === '/') urlPath = '/index.html';
  const full = path.normalize(path.join(ROOT, urlPath));
  if (!full.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return; }
  fs.readFile(full, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  const pathname = (req.url.split('?')[0]) || '/';
  if (pathname === '/ocean4d') {
    const force = /[?&]fresh=1/.test(req.url);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    try {
      const data = await getLive(force);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(data));
    } catch (e) {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'live fetch failed', detail: String(e && e.message || e) }));
      console.error('[ocean4d] live fetch failed:', e && e.message);
    }
    return;
  }
  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`[ocean4d] serving ${ROOT}`);
  console.log(`[ocean4d] open  http://localhost:${PORT}/index.html`);
  console.log(`[ocean4d] live endpoint  http://localhost:${PORT}/ocean4d`);
  console.log('[ocean4d] pre-warming live cache from HYCOM …');
  getLive(true).then(() => {}).catch(e => console.error('[ocean4d] pre-warm failed (page will use baked):', e && e.message));
  setInterval(() => { getLive(true).catch(() => {}); }, CACHE_MS);
});
