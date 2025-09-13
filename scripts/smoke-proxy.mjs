// Quick proxy health check for agents
const BASE = process.env.PROXY_BASE || 'http://localhost:3001';

async function main() {
  const url = `${BASE}/health`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    console.log('[SMOKE][PROXY] OK', { base: BASE, data });
    process.exit(0);
  } catch (err) {
    console.error('[SMOKE][PROXY] FAIL', { base: BASE, error: err.message });
    process.exit(1);
  }
}

main();
