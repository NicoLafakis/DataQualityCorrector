import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Friendly root route
app.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'dqc-backend-proxy',
    endpoints: {
      health: '/health',
      hubspot: 'POST /api/hubspot { path, method, token, body? }',
      openai: 'POST /api/openai { apiKey, prompt }',
    },
  });
});

// Simple health check
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'dqc-backend-proxy' });
});

// Proxy for HubSpot
// Request body shape: { path, method, token, body }
app.post('/api/hubspot', async (req, res) => {
  try {
    const { path, method = 'GET', token, body } = req.body || {};
    if (!path || !token) {
      return res.status(400).json({ message: 'Missing required fields: path and token' });
    }

    const hsUrl = `https://api.hubapi.com${path}`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };

    const resp = await fetch(hsUrl, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await resp.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_e) { /* return raw text if not JSON */ }

    if (!resp.ok) {
      return res.status(resp.status).json({ message: data?.message || text || 'HubSpot proxy error' });
    }

    if (!text) return res.status(204).send();
    return res.json(data);
  } catch (err) {
    console.error('HubSpot proxy error:', err);
    return res.status(500).json({ message: err.message || 'Internal error' });
  }
});

// Proxy for OpenAI
// Request body shape: { apiKey, prompt }
app.post('/api/openai', async (req, res) => {
  try {
    const { apiKey, prompt } = req.body || {};
    if (!apiKey || !prompt) {
      return res.status(400).json({ message: 'Missing required fields: apiKey and prompt' });
    }

    // Using OpenAI responses endpoint (compatible with JSON outputs)
    const oaUrl = 'https://api.openai.com/v1/responses';
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };

    const body = {
      model: 'gpt-4o-mini',
      input: prompt,
      // try to bias towards JSON output
      response_format: { type: 'json_object' },
      max_output_tokens: 800,
    };

    const resp = await fetch(oaUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const data = await resp.json().catch(() => null);
    if (!resp.ok) {
      const message = data?.error?.message || data?.message || 'OpenAI proxy error';
      return res.status(resp.status).json({ message });
    }

    // Try to parse the output as JSON corrections object if present
    // Support both `output[0].content[0].text` (new responses API) and fallback
    let content = data?.output?.[0]?.content?.[0]?.text || data?.choices?.[0]?.message?.content || '';
    try {
      const parsed = JSON.parse(content);
      return res.json(parsed);
    } catch {
      // If not valid JSON, just return raw content as message to surface in UI
      return res.json({ message: content });
    }
  } catch (err) {
    console.error('OpenAI proxy error:', err);
    return res.status(500).json({ message: err.message || 'Internal error' });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`Backend proxy listening on http://localhost:${port}`));
