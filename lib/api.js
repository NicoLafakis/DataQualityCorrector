// Shared API abstraction utilities
// In dev, Vite proxies /api/*; in preview/prod, target the backend directly via VITE_API_BASE or default localhost:3001
const API_BASE = import.meta.env && import.meta.env.DEV
  ? ''
  : ((typeof window !== 'undefined' && window.__DQC_API_BASE__) || (import.meta.env && import.meta.env.VITE_API_BASE) || 'http://localhost:3001');
const IS_DEV = !!(import.meta.env && import.meta.env.DEV);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Exponential backoff with full jitter
const backoffWithJitter = (attempt, baseMs = 500, capMs = 8000) => {
  const exp = Math.min(capMs, baseMs * Math.pow(2, attempt));
  return Math.floor(Math.random() * exp);
};

// Fetch with retry logic for 429 and 5xx; respects Retry-After if present (if proxy forwards it)
async function fetchWithRetry(url, options, { maxRetries = 5, isHubSpot = false } = {}) {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const response = await fetch(url, options).catch((err) => {
      // Network errors: treat like retryable up to maxRetries
      return { ok: false, status: 0, _networkError: err };
    });

    if (response.ok) return response;

    const status = response.status;
    const shouldRetry = status === 429 || (status >= 500 && status <= 599) || status === 0;
    if (!shouldRetry || attempt >= maxRetries) {
      return response;
    }

    // Determine delay
    let delayMs = 0;
    try {
      const retryAfter = response.headers?.get?.('retry-after');
      if (retryAfter) {
        const asNum = Number(retryAfter);
        if (!Number.isNaN(asNum)) delayMs = asNum * 1000; // seconds
        else {
          const dateMs = Date.parse(retryAfter);
          if (!Number.isNaN(dateMs)) delayMs = Math.max(0, dateMs - Date.now());
        }
      }
    } catch (_) {
      // ignore header parsing issues
    }

    // If no Retry-After, use exponential backoff with jitter; bump defaults a bit for HubSpot 429s
    if (!delayMs) {
      const base = status === 429 ? (isHubSpot ? 1500 : 1000) : 500;
      const cap = status === 429 ? 10000 : 8000;
      delayMs = backoffWithJitter(attempt, base, cap);
    }

    if (IS_DEV) {
      console.log('[DQC][DEV] Retrying request', { url, status, attempt: attempt + 1, delayMs });
    }
    attempt += 1;
    await sleep(delayMs);
  }
}

export const apiRequest = async (endpoint, method, body = null) => {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const url = `${API_BASE}${endpoint}`;
    const isHubSpot = endpoint.startsWith('/api/hubspot');
    const response = await fetchWithRetry(
      url,
      {
        method,
        headers,
        body: body ? JSON.stringify(body) : null,
      },
      { maxRetries: 5, isHubSpot }
    );

    if (!response.ok) {
      let message = `API Error (${response.status})`;
      try {
        const errorData = await response.json();
        if (errorData && errorData.message) message += `: ${errorData.message}`;
      } catch (_) {
        // ignore json parse error
      }
      throw new Error(message);
    }
    return response.status === 204 ? null : await response.json();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
};

// Lightweight HubSpot scheduler to reduce rate-limit bursts
const HUBSPOT_MIN_INTERVAL_MS = 200; // ~5 rps (more conservative)
let hubSpotQueue = [];
let hubSpotProcessing = false;

async function processHubSpotQueue() {
  if (hubSpotProcessing) return;
  hubSpotProcessing = true;
  try {
    while (hubSpotQueue.length > 0) {
      const { task, resolve, reject } = hubSpotQueue.shift();
      try {
        const result = await task();
        resolve(result);
      } catch (err) {
        reject(err);
      }
      if (IS_DEV) console.log('[DQC][DEV] HubSpot scheduler: delaying next request', HUBSPOT_MIN_INTERVAL_MS, 'ms');
      await sleep(HUBSPOT_MIN_INTERVAL_MS);
    }
  } finally {
    hubSpotProcessing = false;
  }
}

function enqueueHubSpot(task) {
  return new Promise((resolve, reject) => {
    hubSpotQueue.push({ task, resolve, reject });
    processHubSpotQueue();
  });
}

export const hubSpotApiRequest = (path, method, token, body = null) => {
  const cleanToken = typeof token === 'string' ? token.replace(/^Bearer\s+/i, '') : token;
  return enqueueHubSpot(() => apiRequest('/api/hubspot', 'POST', { path, method, token: cleanToken, body }));
};

export const openAiApiRequest = (apiKey, prompt) => {
  return apiRequest('/api/openai', 'POST', { apiKey, prompt });
};
