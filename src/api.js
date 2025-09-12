// This module centralizes API requests to your backend proxy.

const apiRequest = async (endpoint, method, body = null) => {
    const headers = { 'Content-Type': 'application/json' };
    try {
        const response = await fetch(endpoint, {
            method,
            headers,
            body: body ? JSON.stringify(body) : null
        });

        if (response.status === 204) return null;

        const contentType = response.headers.get('content-type') || '';
        const isJson = contentType.includes('application/json');
        const raw = await (isJson ? response.text() : response.text());

        let data = null;
        if (raw && isJson) {
            try {
                data = JSON.parse(raw);
            } catch (e) {
                // Fall back to raw text if JSON parsing fails
                data = { error: raw };
            }
        } else if (raw) {
            data = { text: raw };
        }

        if (!response.ok) {
            const message = (data && (data.message || data.error)) || `HTTP ${response.status}`;
            const err = new Error(`API Error (${response.status}): ${message}`);
            err.status = response.status;
            err.body = data;
            throw err;
        }
        return data;
    } catch (error) {
        console.error('API request failed:', error);
        throw error;
    }
};

export const hubSpotApiRequest = (path, method, token, body = null) => {
    // The backend receives this payload, adds the token to the Authorization header,
    // and forwards the request to the HubSpot API.
    const normalizedToken = (token || '').replace(/^Bearer\s+/i, '');
    return apiRequest('/api/hubspot', 'POST', { path, method, token: normalizedToken, body });
};

export const openAiApiRequest = (apiKey, prompt) => {
    // The backend receives this payload, adds the key to the Authorization header,
    // and forwards the request to the OpenAI API.
    return apiRequest('/api/openai', 'POST', { apiKey, prompt });
};
