<!-- Guidance for AI coding agents working on DataQualityCorrector. Keep this file short and specific. -->
# Copilot instructions — DataQualityCorrector

Quick orientation

- Purpose: client-side React app for auditing and fixing HubSpot CRM data via two backend proxy endpoints: `POST /api/hubspot` and `POST /api/openai`.
- Entry points: `main.jsx` -> `app.jsx`. Tools live under `components/` and use `lib/api.js` for all external calls.

What you must know before editing

- NEVER call HubSpot/OpenAI directly from the UI — use `hubSpotApiRequest` and `openAiApiRequest` in `lib/api.js` which POST to the proxy.
- Token management: `app.jsx` reads `hubSpotToken` and `openAiKey` from URL or `sessionStorage`; token validation behavior is implemented there (private-app introspection then OAuth metadata).
- Rate-limiting: `lib/api.js` contains fetch retry/backoff and a HubSpot scheduler (`enqueueHubSpot`) that spaces requests (baseline ~350ms). Reuse these helpers for any HubSpot interactions.

Dev & run commands (Windows / `cmd.exe`)

- One-time: `npm install` then `npm run install:proxy` to install the example proxy (`examples/backend-proxy`).
- Run frontend + proxy: `npm run dev` (starts Vite frontend at `http://localhost:5173` and example proxy at `http://localhost:3001`).
- Smoke scripts: `npm run smoke:proxy`, `npm run smoke:hubspot`, `npm run smoke:openai` for quick integration checks.

```instructions
<!-- Short, actionable guidance for AI coding agents working on DataQualityCorrector. Keep edits minimal and follow existing patterns. -->
# Copilot instructions — DataQualityCorrector

Quick orientation

- Purpose: Client-side React app that audits & corrects HubSpot CRM data. UI never calls third-party APIs directly — it uses two proxy endpoints: `POST /api/hubspot` and `POST /api/openai`.
- Entry points: `main.jsx` -> `app.jsx`. Feature UIs live in `components/*.jsx`. API helpers live in `lib/api.js`.

Core rules (must follow)

- Never call HubSpot or OpenAI directly from the frontend. Use `hubSpotApiRequest(path, method, token, body)` and `openAiApiRequest(apiKey, prompt)` exported from `lib/api.js`.
- Tokens/keys: `app.jsx` reads `hubSpotToken` and `openAiKey` from URL query params or `sessionStorage`. Keep that flow when adding auth UI.
- Rate-limits & retries: `lib/api.js` implements retry/backoff and a HubSpot scheduler (`enqueueHubSpot`) — reuse these helpers for any HubSpot interactions to avoid bursts.

Dev & validation (Windows `cmd.exe` examples)

- One-time: `npm install` then `npm run install:proxy` (installs example proxy under `examples/backend-proxy`).
- Run frontend + example proxy: `npm run dev` (Vite frontend at `http://localhost:5173`, proxy at `http://localhost:3001`).
- Quick checks: `npm run smoke:proxy`, `npm run smoke:hubspot`, `npm run smoke:openai` (pass `HUBSPOT_TOKEN` / `OPENAI_KEY` env vars when required).

Project conventions & patterns to copy

- API boundary: `lib/api.js` builds `API_BASE` (empty in dev because Vite proxies `/api/*`; otherwise uses `VITE_API_BASE` or `window.__DQC_API_BASE__`). Check this file first when debugging network behavior.
- UI async pattern: show `Spinner` and disable action buttons during async work (see `components/icons.jsx` and usage across components).
- Error surface: surface errors with `err.message` and render them in red (`<p className="text-red-500">`).
- Pagination: use `limit=100` and loop on `paging.next.after` when scanning HubSpot objects (see `AnomalyDetector.jsx`, `UniversalAnalyzer.jsx`).
- Batch updates: prefer HubSpot batch endpoints (example in `GeoCorrector.jsx` uses `/crm/v3/objects/{type}/batch/update`).

Files to inspect first (high ROI)

- `app.jsx` — token handling, tab wiring
- `lib/api.js` — retry/backoff, HubSpot scheduler, API_BASE
- `components/*.jsx` — feature patterns (AnomalyDetector, GeoCorrector, UniversalAnalyzer)
- `examples/backend-proxy/server.js` — proxy request/response contract

If adding a new tool

- Create `components/MyTool.jsx` following existing component patterns (Spinner, disabled buttons, error rendering). Add your tab to `TABS` in `app.jsx` and supply an icon from `components/icons.jsx`.
- Use the proxy helpers for all external calls and prefer batch endpoints for bulk updates.

When finished

- Run `npm run dev` and the appropriate smoke scripts to validate the feature against the proxy. If behavior depends on HubSpot/OpenAI, include exact env values or `sessionStorage` keys used.

Misc notes

- Secrets: never commit tokens. Use `sessionStorage`, URL query params, or `.env` (`VITE_OPENAI_KEY`) for local convenience.
- If proxy behavior is unclear, inspect `examples/backend-proxy/server.js` for shape of `{ path, method, token, body }` and proxy responses.

```
