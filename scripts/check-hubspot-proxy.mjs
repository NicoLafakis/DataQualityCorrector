// Quick check that the /api/hubspot proxy endpoint responds (even with a bad token)
// Expectation: returns a non-500 status (likely 401/403) proving the proxy is reachable
const BASE = process.env.PROXY_BASE || 'http://localhost:3001';

async function main() {
  const payload = {
    path: '/crm/v3/objects/contacts?limit=1&archived=false',
    method: 'GET',
    token: 'invalid-token-for-check',
  };
  try {
    const res = await fetch(`${BASE}/api/hubspot`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    console.log('[CHECK][HS-PROXY] status', res.status, 'body', text.slice(0, 200));
    if (res.status >= 500) process.exit(1);
    process.exit(0);
  } catch (err) {
    console.error('[CHECK][HS-PROXY] error', err.message);
    process.exit(2);
  }
}

main();
