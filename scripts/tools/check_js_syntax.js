// check_js_syntax.js — validate every inline <script> block in an HTML file.
//
// The simulator ships as one large single-file HTML page, so a syntax error in
// any inline script silently breaks the whole app. This compiles each inline
// JS block with Node's vm module (compile-only, nothing is executed) and reports
// which block fails and where.
//
// Usage:  node scripts/tools/check_js_syntax.js index.html
//
// Skips <script type="application/json"> data blocks and external <script src=...>.
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(process.argv[2], 'utf8');
const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
let m, i = 0, bad = 0;
while ((m = re.exec(html))) {
  const attrs = m[1] || '';
  if (/type\s*=\s*["']application\/json["']/i.test(attrs)) continue;
  if (/\bsrc\s*=/i.test(attrs)) continue;
  i++;
  try { new vm.Script(m[2]); }
  catch (e) { bad++; console.log('BLOCK#' + i + ' @char' + m.index + '  ' + e.message.split('\n')[0]); }
}
console.log('checked ' + i + ' JS blocks, ' + bad + ' with errors');
