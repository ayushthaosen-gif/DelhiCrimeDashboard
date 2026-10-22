// A minimal .xlsx reader (needs `unzip` on the PATH): every sheet as an array of rows, each row an object keyed by column letter, values as strings.
// Enough for plain data tables; it does not read formulas, styles, merged cells or dates as dates.

const { execFileSync } = require('child_process');

function readWorkbook(file) {
  const unz = n => { try { return execFileSync('unzip', ['-p', file, n], { maxBuffer: 1e9, stdio: ['ignore', 'pipe', 'ignore'] }).toString('utf8'); } catch (e) { return ''; } };
  const wb = unz('xl/workbook.xml');
  const sheets = [...wb.matchAll(/<sheet [^>]*name="([^"]*)"[^>]*r:id="([^"]*)"/g)].map(m => [m[1], m[2]]);
  const rels = unz('xl/_rels/workbook.xml.rels');
  const target = id => (rels.match(new RegExp('<Relationship [^>]*Id="' + id + '"[^>]*Target="([^"]*)"')) || rels.match(new RegExp('<Relationship [^>]*Target="([^"]*)"[^>]*Id="' + id + '"')) || [])[1];
  const ss = unz('xl/sharedStrings.xml');
  const unesc = s => s.replace(/&amp;/g, '&').replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  const strs = [...ss.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => unesc([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join('')));
  const out = {};
  for (const [name, id] of sheets) {
    const sheet = unz('xl/' + String(target(id)).replace(/^\/?(xl\/)?/, ''));
    const rows = [];
    for (const rm of sheet.matchAll(/<row [^>]*>([\s\S]*?)<\/row>/g)) {
      const row = {};
      for (const c of rm[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const v = (c[3] || '').match(/<v>([\s\S]*?)<\/v>/), inl = (c[3] || '').match(/<t[^>]*>([\s\S]*?)<\/t>/);
        if (v) row[c[1]] = /t="s"/.test(c[2]) ? strs[+v[1]] : v[1]; else if (inl) row[c[1]] = unesc(inl[1]);
      }
      rows.push(row);
    }
    out[name] = rows;
  }
  return out;
}

module.exports = { readWorkbook };
