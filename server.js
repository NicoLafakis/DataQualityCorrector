import express from 'express';
import cors from 'cors';
const app = express();
const PORT = 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Simple health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// HubSpot API proxy
app.post('/api/hubspot', async (req, res) => {
  try {
    const { path, method, token, body } = req.body;

    // Defensive: normalize token (strip any leading "Bearer ")
    const normalizedToken = (token || '').replace(/^Bearer\s+/i, '');

    const url = `https://api.hubapi.com${path}`;
    const upstream = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${normalizedToken}`,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });

    if (upstream.status === 204) {
      return res.sendStatus(204);
    }

    const text = await upstream.text();
    let parsed;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = { error: text };
    }

    // Minimal diagnostics without leaking secrets
    console.log('[HubSpot]', new Date().toISOString(), upstream.status, method, path, '-', (text || '').slice(0, 200));

    return res.status(upstream.status).json(parsed);
  } catch (error) {
    console.error('HubSpot API Error:', error);
    res.status(500).json({ error: 'HubSpot API request failed' });
  }
});

// OpenAI API proxy
app.post('/api/openai', async (req, res) => {
  try {
    const { apiKey, prompt } = req.body;

    const url = 'https://api.openai.com/v1/chat/completions';
    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${(apiKey || '').replace(/^Bearer\s+/i, '')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.7
      })
    });

    if (upstream.status === 204) {
      return res.sendStatus(204);
    }
    const text = await upstream.text();
    let parsed;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = { error: text };
    }

    console.log('[OpenAI]', new Date().toISOString(), upstream.status, 'POST', '/v1/chat/completions', '-', (text || '').slice(0, 200));
    return res.status(upstream.status).json(parsed);
  } catch (error) {
    console.error('OpenAI API Error:', error);
    res.status(500).json({ error: 'OpenAI API request failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
