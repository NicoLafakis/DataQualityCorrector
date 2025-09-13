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
This repository is a simple, front-end React setup. Use your existing tooling to serve/build it (e.g., Vite, esbuild, a simple bundler, or your own stack). No additional dependencies were introduced by the refactor.

### Minimal assumptions
- Your dev server should serve `app.jsx` as the entry (or import it from your own entry point).
- The two API proxy endpoints listed above must be available at runtime.

## Notes on the refactor
- The original single `app.jsx` was split into modular components with no UI or behavioral changes.
- Shared utilities and icons were extracted to `lib/api.js` and `components/icons.jsx`.
- All original features and styles remain the same.

## Troubleshooting
- If buttons are disabled, verify the HubSpot token is valid (the check icon next to the field will turn green if valid).
- If Geo Corrector doesn’t run, ensure an OpenAI key is provided and your `/api/openai` proxy is responding.
- If lists look empty, confirm the `/api/hubspot` proxy is reachable and returning data.

## License
This project contains original work by the repository owner. Please consult the repository’s license (if present) or contact the owner for usage terms.