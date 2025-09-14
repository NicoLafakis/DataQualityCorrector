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

Project-specific conventions

- Always call external services through the proxy. See `lib/api.js` for `API_BASE` handling (Vite dev proxy vs `VITE_API_BASE` / `window.__DQC_API_BASE__`).
- UI patterns: show `Spinner` while async work and disable action buttons to avoid duplicate requests (see `components/icons.jsx` and usage across components).
- Error surface: bubble errors with `err.message` and render in red (`<p className="text-red-500">`). Follow existing error patterns.
- Pagination: use `limit=100` and loop on `paging.next.after` when scanning objects (see `AnomalyDetector.jsx` and `UniversalAnalyzer.jsx`).

Examples to copy/adapt

- Validate token (from `app.jsx`):
  - Try `POST /oauth/v2/private-apps/get/access-token-info` with `{ tokenKey }`, fallback to `GET /oauth/v1/access-tokens/{token}`.
- HubSpot search for property presence (from `UniversalAnalyzer.jsx`):
  - POST `/crm/v3/objects/{objectType}/search` with `filterGroups: [{ filters: [{ propertyName, operator: 'HAS_PROPERTY' }] }]` and read `total`.
- Geo-batch update pattern (from `GeoCorrector.jsx`): use `/crm/v3/objects/{objectType}/batch/update` with array of `id`/`properties` payloads.

Safety notes for agents

- Do not embed secrets in code. Use `sessionStorage`, query params, or environment variables for local runs. Example proxy expects `apiKey`/`token` in request bodies.
- Keep UI changes minimal unless the task is explicitly about UX: prefer functional, minimal changes that follow existing class names and layout.

Files to inspect first

- `app.jsx` (tabs, token handling)
- `lib/api.js` (retry, scheduler, API boundary)
- `components/*.jsx` (patterns for pagination, batching, UI state)
- `examples/backend-proxy/server.js` (proxy contract)
- `AGENT_GUIDE.md` and `README.md` (quick commands & conventions)

If you add a new tool

- Add `components/MyTool.jsx`, follow the async/spinner/error patterns, then wire it into `TABS` in `app.jsx` with an icon from `components/icons.jsx`.

When done

- Run `npm run dev` locally and exercise the feature with the example proxy, or run smoke scripts to validate integration. Report any runtime failures with exact console errors and stack traces.

Question / missing info

- If a proxy contract is unclear, open `examples/backend-proxy/server.js` to confirm expected request/response shapes.
