const fs = require('node:fs');
const crypto = require('node:crypto');
function canonicalBytes(file) {
  const bytes = fs.readFileSync(file);
  return /\.(csv|json|geojson|md|html)$/i.test(file) ? Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n')) : bytes;
}
function sha256(file) { return crypto.createHash('sha256').update(canonicalBytes(file)).digest('hex'); }
function canonicalSize(file) { return canonicalBytes(file).length; }
// Retain the raw CSV records as well as parsed values: subsets preserve source spelling,
// quoting, column order and duplicate multiplicity, rather than reserializing values.
function parseCsv(text) {
  text = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const records = []; let quoted = false, start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '"') { if (quoted && text[i + 1] === '"') i++; else quoted = !quoted; }
    if (text[i] === '\n' && !quoted) { records.push(text.slice(start, i)); start = i + 1; }
  }
  if (quoted) throw new Error('Unterminated CSV quote');
  if (start < text.length) records.push(text.slice(start));
  function cells(record) {
    const result = []; let value = '', q = false;
    for (let i = 0; i < record.length; i++) {
      const c = record[i];
      if (c === '"') { if (q && record[i + 1] === '"') { value += '"'; i++; } else q = !q; }
      else if (c === ',' && !q) { result.push(value); value = ''; } else value += c;
    }
    result.push(value); return result;
  }
  const header = records.shift(); const columns = cells(header);
  const rows = records.map((raw, i) => {
    const values = cells(raw);
    if (values.length !== columns.length) throw new Error(`CSV record ${i + 2}: expected ${columns.length} columns, got ${values.length}`);
    return Object.fromEntries(columns.map((key, j) => [key, values[j]]));
  });
  return { header, columns, records, rows };
}
function toCsv(columns, rows) {
  const escape = value => /[",\n\r]/.test(String(value ?? '')) ? '"' + String(value).replace(/"/g, '""') + '"' : String(value ?? '');
  return [columns.join(','), ...rows.map(row => columns.map(key => escape(row[key])).join(','))].join('\n') + '\n';
}
module.exports = { canonicalBytes, sha256, canonicalSize, parseCsv, toCsv };
