// Shared API abstraction utilities
// In dev, Vite proxies /api/*; in preview/prod, target the backend directly via VITE_API_BASE or default localhost:3001
const API_BASE = import.meta.env && import.meta.env.DEV
  ? ''
  : ((typeof window !== 'undefined' && window.__DQC_API_BASE__) || (import.meta.env && import.meta.env.VITE_API_BASE) || 'http://localhost:3001');

export const apiRequest = async (endpoint, method, body = null) => {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const url = `${API_BASE}${endpoint}`;
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
    });

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

export const hubSpotApiRequest = (path, method, token, body = null) => {
  const cleanToken = typeof token === 'string' ? token.replace(/^Bearer\s+/i, '') : token;
  return apiRequest('/api/hubspot', 'POST', { path, method, token: cleanToken, body });
};

export const openAiApiRequest = (apiKey, prompt) => {
  return apiRequest('/api/openai', 'POST', { apiKey, prompt });
};
