// Shared API abstraction utilities

export const apiRequest = async (endpoint, method, body = null) => {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const response = await fetch(endpoint, {
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
  return apiRequest('/api/hubspot', 'POST', { path, method, token, body });
};

export const openAiApiRequest = (apiKey, prompt) => {
  return apiRequest('/api/openai', 'POST', { apiKey, prompt });
};
