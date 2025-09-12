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
            // Extract a useful error message - handle different error formats
            let message;
            if (data) {
                if (typeof data === 'string') {
                    message = data;
                } else if (data.message) {
                    message = data.message;
                } else if (data.error) {
                    message = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
                } else if (data.status) {
                    message = `Status: ${data.status}`;
                } else {
                    message = JSON.stringify(data).substring(0, 100);
                }
            } else {
                message = `HTTP ${response.status}`;
            }
            
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
    
    // Basic validation
    if (!token || token.trim() === '') {
        return Promise.reject(new Error('Invalid token: Token cannot be empty'));
    }
    
    if (!path || !path.startsWith('/')) {
        return Promise.reject(new Error('Invalid path: Path must start with /'));
    }
    
    const normalizedToken = token.replace(/^Bearer\s+/i, '').trim();
    
    // Add debug info
    console.log(`Requesting HubSpot API: ${method} ${path}`);
    
    return apiRequest('/api/hubspot', 'POST', { path, method, token: normalizedToken, body });
};

export const openAiApiRequest = (apiKey, prompt) => {
    // The backend receives this payload, adds the key to the Authorization header,
    // and forwards the request to the OpenAI API.
    return apiRequest('/api/openai', 'POST', { apiKey, prompt });
};
