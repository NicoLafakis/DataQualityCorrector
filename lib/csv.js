export function toCSV(rows, headers) {
  if (!Array.isArray(rows) || rows.length === 0) return '';
  const cols = headers || Object.keys(rows[0]);
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  const head = cols.map(esc).join(',');
  const body = rows.map((r) => cols.map((c) => esc(r[c])).join(',')).join('\n');
  return head + '\n' + body;
}

export function downloadCSV(filename, csvString) {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
