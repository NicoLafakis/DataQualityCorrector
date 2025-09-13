# File Map (for Agents)

`app.jsx` – app shell, token fields, tab routing, validation
`main.jsx` – Vite entry; renders `App`
`index.html` – HTML with Tailwind CDN
`lib/api.js` – proxy request helpers, retry/backoff, HubSpot pacing
`components/AnomalyDetector.jsx`
`components/PropertyFillRate.jsx`
`components/GeoCorrector.jsx`
`components/DuplicateFinder.jsx`
`components/icons.jsx`
`examples/backend-proxy/server.js` – Express proxy
`vite.config.mjs` – dev proxy configuration
`README.md` – usage & dev guide
`PROGRESS.md` – change log
`AGENT_GUIDE.md` – agent operations
`scripts/smoke-*.mjs` – smoke tests for proxy, HubSpot, OpenAI
# Copilot File Map — DataQualityCorrector

An agent-friendly map of each file with responsibilities, important symbols, and how to extend safely.

## Root
- `app.jsx`
  - Role: App shell; sidebar + tabbed main area.
  - Key state: `hubSpotToken`, `openAiKey`, `activeTab`, `tokenValid`, `isCheckingToken`.
  - Effects:
    - Read query params for `hubSpotToken` and `openAiKey`.
    - Validate token via `hubSpotApiRequest('/oauth/v1/access-tokens/{token}', 'GET', token)`.
  - Export: default `App` component.
  - Extend: Add new tab in `TABS` with `{ label, icon, component }`; pass `hubSpotToken` (and `openAiKey` if needed).

- `README.md`
  - Role: Project overview + Quick start (Vite example).
  - Use: Follow to scaffold a dev server and proxy `/api/hubspot` and `/api/openai`.

- `PROGRESS.md`
  - Role: Change log and refactor rationale.
  - Use: Read before structural changes.

## lib/
- `lib/api.js`
  - Symbols:
    - `apiRequest(endpoint, method, body?)`: JSON fetch wrapper with error message propagation.
    - `hubSpotApiRequest(path, method, token, body?)`: POST `/api/hubspot`.
    - `openAiApiRequest(apiKey, prompt)`: POST `/api/openai`.
  - Extend: Add new calls by composing `hubSpotApiRequest` with correct HubSpot CRM v3 path; do not call HubSpot directly.
  - Pitfalls: Always pass `token`; surface `err.message` to UI.

## components/
- `components/AnomalyDetector.jsx`
  - Role: Scan contacts/companies for invalid `email`/`website`.
  - Patterns: Pagination (`limit=100` + `after`), client-side validation with regex/`new URL()`.
  - Extend: Add more property validators; keep error/loading patterns and table rendering style.

- `components/PropertyFillRate.jsx`
  - Role: Fill-rate across `contacts|companies|deals|tickets` properties.
  - Patterns: `search.total` → list properties → `HAS_PROPERTY` search per prop; group and display with Tailwind.
  - Extend: Add filters or export; preserve `Spinner` and disable buttons while loading.

- `components/GeoCorrector.jsx`
  - Role: AI-driven corrections for `city`, `state`, `country`.
  - Patterns: `search` for relevant records → prompt OpenAI with concise JSON → reconcile to `corrections[]` → optional batch update.
  - Extend: Gate on `openAiKey`; keep prompt short; use `batch/update` for writes when possible.

- `components/DuplicateFinder.jsx`
  - Role: Group contacts by email and merge duplicates.
  - Patterns: Pagination, grouping, sort by `createdate` desc, POST to `/merge` for each secondary.
  - Extend: Add tie-breakers or preview diffs; maintain merge status indicators and error handling.

- `components/icons.jsx`
  - Role: SVG icons + shared `Spinner` component.
  - Extend: Add icons as needed; reuse `Spinner` for loading states.

## Agent Tips
- Data fetches: Always use `hubSpotApiRequest`. For pagination, accumulate `data.results` and loop on `data.paging.next.after`.
- Errors: Capture and show `err.message` in `<p className="text-red-500">`.
- Loading: Disable buttons while in-flight; use `Spinner` from `icons.jsx`.
- Batch writes: Use HubSpot batch endpoints when available; follow `GeoCorrector` shape.
- UI: Follow Tailwind class patterns already in components for consistency.

## Extension Examples
- New tool: Create `components/MyNewTool.jsx` and wire into `TABS` in `app.jsx`.
- New object type support: Mirror existing request patterns; verify HubSpot path/params (e.g., `/crm/v3/objects/{type}` or `/properties/{type}`).
- OpenAI usage: Only via `openAiApiRequest(apiKey, prompt)`; keep prompts JSON-oriented and constrained.
