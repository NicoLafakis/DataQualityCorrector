# Copilot Code Map — DataQualityCorrector

This codemap orients AI agents to the structure, responsibilities, and flows of the project. Use it alongside `.github/copilot-instructions.md`.

## Overview
- Purpose: Client-side React app to audit and fix HubSpot CRM data quality via two backend proxy endpoints (`/api/hubspot`, `/api/openai`).
- Entry: `app.jsx` renders sidebar + tabbed tools; validates HubSpot token; routes to components.
- API boundary: All external calls go through `lib/api.js` helpers to the two proxies. No direct third‑party API calls from UI.

## Key Files & Responsibilities
- `app.jsx`
  - Loads query params (`hubSpotToken`, `openAiKey`).
  - Validates HubSpot token via `/oauth/v1/access-tokens/{token}` through the proxy.
  - Defines `TABS` map and renders selected tool.
  - Sidebar UI, token/key inputs, gating of actions based on `tokenValid`.
- `lib/api.js`
  - `apiRequest(endpoint, method, body?)`: shared fetch wrapper with JSON parse and error propagation.
  - `hubSpotApiRequest(path, method, token, body?)`: POST `/api/hubspot` with `{ path, method, token, body }`.
  - `openAiApiRequest(apiKey, prompt)`: POST `/api/openai` with `{ apiKey, prompt }`.
- `components/AnomalyDetector.jsx`
  - Fetch objects (contacts/companies) with pagination (`limit=100` + `after`).
  - Client-side validation: email regex and `new URL()` for `website`.
  - Displays anomalies (record id, property, value, reason).
- `components/PropertyFillRate.jsx`
  - Computes fill rates for each property on `contacts|companies|deals|tickets`.
  - Gets `total` via `/search`, lists properties via `/crm/v3/properties/{objectType}`.
  - For each property: `HAS_PROPERTY` search to compute `%`.
- `components/GeoCorrector.jsx`
  - Finds contacts with `city/state/country`, sends JSON prompt to OpenAI via proxy.
  - Renders proposed corrections and applies batch update via `/crm/v3/objects/contacts/batch/update`.
- `components/DuplicateFinder.jsx`
  - Paginates contacts; groups by email; sorts by `createdate` desc.
  - Merges duplicates into newest primary via `/crm/v3/objects/contacts/{primaryId}/merge`.
- `components/icons.jsx`
  - UI icons and shared `Spinner`.
- `PROGRESS.md`
  - Refactor notes; rationale and potential improvements.

## Primary Flows
- Token validation: `app.jsx` → `hubSpotApiRequest('/oauth/v1/access-tokens/{token}', 'GET', token)` → set `tokenValid`.
- Pagination: Components build `GET /crm/v3/objects/{type}?limit=100&properties=...&after=...` and loop until `paging.next.after` is empty.
- Fill-rate: `search.total` → iterate properties → `HAS_PROPERTY` search per property → compute percentage.
- Dedupe: group by `email`, sort by `createdate` desc → merge POST per secondary id.
- Geo-correct: `search` contacts with all three fields → prompt OpenAI → reconcile and optional batch update.

## Conventions
- Only call external services via proxies in `lib/api.js`.
- Bubble errors with `err.message` and render `<p className="text-red-500">`.
- Disable buttons and show `Spinner` while loading.
- Use Tailwind utility classes already present in markup.

## Extension Points
- New tool: create `components/MyTool.jsx` with loading/error patterns; wire into `TABS` in `app.jsx` with an icon.
- Batch operations: mirror `/batch/update` shape as in `GeoCorrector`.
- Property analytics: follow `/properties/{objectType}` + `HAS_PROPERTY` searches.
- Duplicate strategies: reuse group-and-merge pattern from `DuplicateFinder`.

## Dev Environment
- Bring your own dev server (e.g., Vite). Proxy `/api/hubspot` and `/api/openai` to your backend. See `README.md` Quick start and `.github/copilot-instructions.md` for a Vite proxy example.

## Gotchas
- Disabled buttons usually mean token validation failed (check icon in sidebar).
- `GeoCorrector` requires an OpenAI key; the action button is disabled without it.
- Large portals may require significant time for pagination-heavy tasks.
# Code Map (for Agents)

Entry: `main.jsx` -> renders `App` from `app.jsx`
Shell: `app.jsx` -> sidebar, token fields, tab routing
API helpers: `lib/api.js`
  - `apiRequest(endpoint, method, body?)` -> calls `/api/*` with retry/backoff
  - `hubSpotApiRequest(path, method, token, body?)` -> queued + paced
  - `openAiApiRequest(apiKey, prompt)`
Components:
  - `AnomalyDetector.jsx` – scans email/website
  - `PropertyFillRate.jsx` – property fill rates
  - `GeoCorrector.jsx` – geodata correction via OpenAI
  - `DuplicateFinder.jsx` – contact dedupe + merges
  - `icons.jsx` – shared icons + `Spinner`
Proxy example: `examples/backend-proxy/server.js`
Dev tooling: `vite.config.mjs`, `package.json` scripts

Key flows
Token validation: `app.jsx` -> HubSpot (introspection then OAuth metadata)
Data calls: components -> `hubSpotApiRequest` -> proxy
OpenAI: components -> `openAiApiRequest` -> proxy
