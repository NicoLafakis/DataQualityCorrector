# Data Quality Corrector (HubSpot Data Quality Suite)

A small, client-side React app that helps audit and fix HubSpot CRM data quality issues without changing the look & feel or behavior of the original single-file app.

## Features
- Data Anomaly Detection (contacts or companies)
- Property Fill Rate analysis (contacts, companies, deals, tickets)
- Geographic Data Correction using OpenAI (city/state/country normalization)
- Duplicate Finder and bulk merge by email (contacts)
- Inline token validation UI and simple configuration panel

## How it works
This app talks to two proxy endpoints that you must host/provide in your environment:
- `POST /api/hubspot` — Proxies calls to HubSpot (path, method, token, body)
- `POST /api/openai` — Proxies prompts to OpenAI (apiKey, prompt)

The UI never calls third-party APIs directly; it always uses these proxy endpoints.

### Example backend proxy (Node/Express)
An example backend proxy is included under `examples/backend-proxy` to get you running quickly.

Run it like this (Windows `cmd.exe`):

```bat
cd examples\backend-proxy
npm install
npm run dev
```

This will start a local proxy at `http://localhost:3001` exposing:
- `POST /api/hubspot`
- `POST /api/openai`

Pair this with the Vite proxy in the Quick start below.

## Configuration
- HubSpot Private App Token: paste into the sidebar field. The app validates it by calling `/oauth/v1/access-tokens/{token}` through the proxy.
- OpenAI API Key: optional, only required for the Geo Corrector tool.
- You can also pass both via URL query params:
  - `?hubSpotToken=<token>&openAiKey=<key>`

## Project structure
```
DataQualityCorrector/
├─ app.jsx                     # Main app shell and navigation
├─ components/
│  ├─ AnomalyDetector.jsx      # Anomalies tool
│  ├─ DuplicateFinder.jsx      # Duplicate management tool
│  ├─ GeoCorrector.jsx         # Geographic correction tool (OpenAI-powered)
│  ├─ PropertyFillRate.jsx     # Fill-rate analysis tool
│  └─ icons.jsx                # Shared icons + Spinner
└─ lib/
   └─ api.js                   # API helpers (HubSpot/OpenAI proxy calls)
```

## Development
The repo now includes a minimal Vite setup and a sample backend proxy. You can run everything locally with a few commands.

### Prerequisites
- Node.js 18 or newer (`node -v`)

### One-time install
```bat
npm install
npm run install:proxy
```

### Start local dev (frontend + proxy)
```bat
npm run dev
```

This starts:
- Frontend (Vite) at `http://localhost:5173` (auto-open)
- Backend proxy (Express) at `http://localhost:3001`

If port `3001` is already in use, stop the other process or change the port via `PORT=...` when starting the proxy (see `examples/backend-proxy/server.js`).

### Build and preview
```bat
npm run build
npm run preview
```

### Providing credentials
- Paste your HubSpot Private App Token into the sidebar; it will be validated.
- Optionally paste your OpenAI API key for the Geo Corrector tool.
- Or pass both via URL query params:
  - `?hubSpotToken=<token>&openAiKey=<key>`

### Hardwiring OpenAI key for local dev (optional)
If you prefer not to paste your OpenAI key into the UI each time, Vite supports environment variables prefixed with `VITE_`.
Create a file named `.env` in the project root with the following line (Windows/UNIX compatible):

```
VITE_OPENAI_KEY=sk-...your-key-here
```

When present, the frontend will auto-fill the OpenAI key from `import.meta.env.VITE_OPENAI_KEY`. Note: do not commit secrets to source control — add `.env` to `.gitignore` in production workflows.

## Notes on the refactor
- The original single `app.jsx` was split into modular components with no UI or behavioral changes.
- Shared utilities and icons were extracted to `lib/api.js` and `components/icons.jsx`.
- All original features and styles remain the same.

## Troubleshooting
- If buttons are disabled, verify the HubSpot token is valid (the check icon next to the field will turn green if valid).
- If Geo Corrector doesn’t run, ensure an OpenAI key is provided and your `/api/openai` proxy is responding.
- If lists look empty, confirm the `/api/hubspot` proxy is reachable and returning data.
 - If the proxy fails to start with `EADDRINUSE`, another process is already listening on that port. Either stop it or set a different `PORT` environment variable when starting the proxy.

## Copilot docs
- Agent instructions: `.github/copilot-instructions.md`
- Code map: `.github/copilot-codemap.md`
- File map: `.github/copilot-filemap.md`

## License
This project contains original work by the repository owner. Please consult the repository’s license (if present) or contact the owner for usage terms.
