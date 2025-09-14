const KEY = 'dqc.scanHistory';

export function listScans() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function recordScan(tool, objectType, metrics) {
  const scans = listScans();
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ts: Date.now(),
    tool,
    objectType,
    metrics: metrics || {},
  };
  try {
    localStorage.setItem(KEY, JSON.stringify([entry, ...scans].slice(0, 500)));
  } catch {}
  return entry;
}

export function clearScans() {
  try { localStorage.removeItem(KEY); } catch {}
}
