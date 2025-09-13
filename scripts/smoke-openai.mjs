// Validate OpenAI connectivity via proxy
const BASE = process.env.PROXY_BASE || 'http://localhost:3001';
const OPENAI_KEY = process.env.OPENAI_KEY || '';

if (!OPENAI_KEY) {
  console.error('[SMOKE][OA] Missing OPENAI_KEY');
  process.exit(2);
}

async function main() {
  try {
    const res = await fetch(`${BASE}/api/openai`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ apiKey: OPENAI_KEY, prompt: 'Return {"ok":true} as JSON.' }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (typeof data !== 'object') throw new Error('Unexpected response');
    console.log('[SMOKE][OA] OK', { base: BASE, keys: Object.keys(data).slice(0, 5) });
    process.exit(0);
  } catch (err) {
    console.error('[SMOKE][OA] FAIL', { base: BASE, error: err.message });
    process.exit(1);
  }
}

main();
