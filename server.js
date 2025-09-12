import express from 'express';
import cors from 'cors';
const app = express();
const PORT = 3002;

// Middleware
app.use(cors());
app.use(express.json());

// HubSpot API proxy
app.post('/api/hubspot', async (req, res) => {
  try {
    const { path, method, token, body } = req.body;

    const response = await fetch(`https://api.hubapi.com${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('HubSpot API Error:', error);
    res.status(500).json({ error: 'HubSpot API request failed' });
  }
});

// OpenAI API proxy
app.post('/api/openai', async (req, res) => {
  try {
    const { apiKey, prompt } = req.body;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.7
      })
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('OpenAI API Error:', error);
    res.status(500).json({ error: 'OpenAI API request failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
