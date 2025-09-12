// This module centralizes API requests to your backend proxy.

const apiRequest = async (endpoint, method, body = null) => {
    const headers = { 'Content-Type': 'application/json' };
    try {
        const response = await fetch(endpoint, {
            method,
            headers,
            body: body ? JSON.stringify(body) : null
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API Error (${response.status}): ${errorData.message}`);
        }
        return response.status === 204 ? null : await response.json();
    } catch (error) {
        console.error("API request failed:", error);
        throw error;
    }
};

export const hubSpotApiRequest = (path, method, token, body = null) => {
    // The backend receives this payload, adds the token to the Authorization header,
    // and forwards the request to the HubSpot API.
    return apiRequest('/api/hubspot', 'POST', { path, method, token, body });
};

export const openAiApiRequest = (apiKey, prompt) => {
    // The backend receives this payload, adds the key to the Authorization header,
    // and forwards the request to the OpenAI API.
    return apiRequest('/api/openai', 'POST', { apiKey, prompt });
};
