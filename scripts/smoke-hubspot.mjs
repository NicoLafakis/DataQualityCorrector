// Validate HubSpot connectivity and token via proxy
const BASE = process.env.PROXY_BASE || 'http://localhost:3001';
const TOKEN = process.env.HUBSPOT_TOKEN || '';

if (!TOKEN) {
  console.error('[SMOKE][HS] Missing HUBSPOT_TOKEN');
  process.exit(2);
}

async function call(path, method = 'GET', body = null) {
  const res = await fetch(`${BASE}/api/hubspot`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path, method, token: TOKEN, body }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`HTTP ${res.status}: ${t}`);
  }
  return res.status === 204 ? null : res.json();
}

async function main() {
  try {
    // Validate token via private app introspection first
    await call('/oauth/v2/private-apps/get/access-token-info', 'POST', { tokenKey: TOKEN.replace(/^Bearer\s+/i, '') });
    // Then do a tiny CRM call with a safe limit
    await call('/crm/v3/objects/contacts?limit=1&archived=false', 'GET');
    console.log('[SMOKE][HS] OK', { base: BASE });
    process.exit(0);
  } catch (err) {
    console.error('[SMOKE][HS] FAIL', { base: BASE, error: err.message });
    process.exit(1);
  }
}

main();
