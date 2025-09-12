import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import bodyParser from 'body-parser';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json());

// --- PROXY ENDPOINT FOR HUBSPOT ---
app.post('/api/hubspot', async (req, res) => {
    const { path, method, token, body } = req.body;

    if (!token) {
        return res.status(400).json({ message: 'Missing HubSpot token' });
    }

    const url = `https://api.hubapi.com${path}`;

    // --- FIX STARTS HERE ---
    // Conditionally build the options for the fetch request.
    const options = {
        method,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    };

    // Only add a body to the request if the method is not GET and a body is provided.
    if (method.toUpperCase() !== 'GET' && body) {
        options.body = JSON.stringify(body);
    }
    // --- FIX ENDS HERE ---


    try {
        const hubSpotResponse = await fetch(url, options);
        
        // Handle cases where there might not be a JSON body to parse
        const contentType = hubSpotResponse.headers.get("content-type");
        let data;
        if (contentType && contentType.includes("application/json")) {
            data = await hubSpotResponse.json();
        } else {
            // If not JSON, just get the text. Will be empty for 204s.
            data = await hubSpotResponse.text(); 
        }

        if (!hubSpotResponse.ok) {
            console.error('HubSpot API Error:', data);
            // Forward HubSpot's status and error message to the client
            return res.status(hubSpotResponse.status).json(data);
        }

        res.json(data);
    } catch (error) {
        console.error('Error proxying to HubSpot:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


// --- PROXY ENDPOINT FOR OPENAI (example) ---
app.post('/api/openai', async (req, res) => {
    // ... your OpenAI logic here
});


app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});