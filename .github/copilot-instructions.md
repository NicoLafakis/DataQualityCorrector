# Copilot Instructions for DataQualityCorrector

Purpose: Enable AI coding agents to contribute productively to this small, client-side React app that audits and fixes HubSpot CRM data quality using two backend proxy endpoints.

## Architecture & Data Flow
- Single-page React app. Entry is `app.jsx` which renders a sidebar + tabbed main area.
- Four feature modules under `components/`:
  - `AnomalyDetector.jsx` — scans contacts/companies for invalid `email`/`website` formats.
  - `PropertyFillRate.jsx` — computes fill rates for all properties on contacts/companies/deals/tickets.
  - `GeoCorrector.jsx` — proposes location fixes (`city/state/country`) using OpenAI; can batch update via HubSpot.
  - `DuplicateFinder.jsx` — finds and bulk merges contact duplicates by email (newest record kept as primary).
- All external calls go through proxies defined in `lib/api.js`:
  - `hubSpotApiRequest(path, method, token, body?)` → POST `/api/hubspot` with `{ path, method, token, body }`.
  - `openAiApiRequest(apiKey, prompt)` → POST `/api/openai` with `{ apiKey, prompt }`.
- The UI never hits HubSpot or OpenAI directly. Token/key live only in the browser and are sent to the proxy.

## Configuration & Runtime Assumptions
- HubSpot Private App Token is required to enable tools. Token validation calls `/oauth/v1/access-tokens/{token}` via the proxy.
- Optional OpenAI API key is required only for `GeoCorrector`.
- Both can be provided via query params: `?hubSpotToken=<token>&openAiKey=<key>`.
- The hosting environment must expose two endpoints: `POST /api/hubspot` and `POST /api/openai`.

## Development Workflow
- This repo is front-end only; bring your own dev server/bundler (e.g., Vite). Typical setup:
  - Serve `app.jsx` as the entry (or import it from your own entry point).
  - Ensure your dev server proxies `/api/hubspot` and `/api/openai` to your backend.
- No additional client deps are required by this refactor. Styling uses Tailwind utility classes already present in markup (no config in this repo).

## Patterns & Conventions
- Data fetching:
  - Use `hubSpotApiRequest` for any HubSpot CRM v3 operation, including pagination. Example:
    - `GET /crm/v3/objects/{type}?limit=100&properties=...&after=...` loop until `paging.next.after` is falsy.
  - Use `openAiApiRequest` only in features that need LLM assistance (keep prompts concise and JSON-oriented).
- Error handling: Bubble `err.message` to component state and render simple `<p className="text-red-500">` messages.
- Loading states: Prefer the shared `Spinner` from `components/icons.jsx` and disable action buttons while loading.
- Batch operations: Follow HubSpot batch formats used in `GeoCorrector` (`/crm/v3/objects/contacts/batch/update`).
- UX consistency: Keep the sidebar/tab model from `app.jsx`. New tools should be added to the `TABS` map with icon + label.

## Examples from Codebase
- Pagination pattern (see `AnomalyDetector`/`DuplicateFinder`):
  - Build path with `limit=100` and carry `after` cursor until exhausted; push `data.results` into an accumulator array.
- Duplicate merge pattern (see `DuplicateFinder`):
  - Sort group by `createdate` desc, choose newest as primary, then POST to `/crm/v3/objects/contacts/{primaryId}/merge` for each remaining id.
- Fill-rate computation (see `PropertyFillRate`):
  - Get `total` via `search`, iterate `properties` list, run `HAS_PROPERTY` searches per property, compute percentage.

## When Extending the App
- Add new features under `components/` and wire into `TABS` in `app.jsx`.
- Reuse `hubSpotApiRequest` and shared UI pieces; keep backend-agnostic by calling only the two proxies.
- Validate inputs client-side (e.g., email/URL regex) before making write calls.

## Gotchas
- If buttons are disabled, token validation likely failed — see the check icon in the sidebar (`app.jsx`).
- `GeoCorrector` requires a non-empty `openAiKey`; otherwise the action button is disabled and a notice is shown.
- Large portals: API-heavy features (fill rates, duplicates) may take time; ensure pagination and button disabling are respected.

## Key Files
- `app.jsx` — shell, nav, config panel, token validation, feature routing.
- `lib/api.js` — proxy request helpers and shared error handling.
- `components/*` — isolated feature implementations and shared `icons.jsx`.
- `PROGRESS.md` — recent refactor notes; review before structural changes.

## Local dev proxy (Vite example)
If you use Vite, ensure your dev server proxies the required endpoints to your backend proxy:

```js
// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const target = 'http://localhost:3001'; // your backend proxy host/port

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/hubspot': { target, changeOrigin: true },
      '/api/openai': { target, changeOrigin: true },
    },
  },
});
```

## Adding a new tool tab
1) Create a component under `components/`, reusing shared patterns:

```jsx
// components/MyNewTool.jsx
import React, { useState, useCallback } from 'react';
import { hubSpotApiRequest } from '../lib/api';
import { Spinner } from './icons';

export default function MyNewTool({ token }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);

  const run = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const body = { limit: 1, filterGroups: [] };
      const { results = [] } = await hubSpotApiRequest('/crm/v3/objects/contacts/search', 'POST', token, body);
      setItems(results);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm">
      <button onClick={run} disabled={isLoading} className="bg-blue-600 text-white px-4 py-2 rounded-md disabled:bg-blue-300 flex items-center">
        {isLoading ? <Spinner /> : 'Run My Tool'}
      </button>
      {error && <p className="text-red-500">{error}</p>}
      {!isLoading && items.length > 0 && (
        <p className="text-gray-700 mt-2">Fetched {items.length} item(s).</p>
      )}
    </div>
  );
}
```

2) Wire it into `app.jsx`:

```jsx
// app.jsx (imports)
import MyNewTool from './components/MyNewTool';
import { ShieldCheckIcon } from './components/icons'; // or another icon

// app.jsx (inside TABS)
const TABS = {
  // ...existing tabs
  myTool: { label: 'My Tool', icon: <ShieldCheckIcon />, component: <MyNewTool token={hubSpotToken} /> },
};
```

Notes:
- New tabs automatically respect the token gating in the sidebar. If your feature needs OpenAI, pass `openAiKey` as in `GeoCorrector`.
- For pagination-heavy features, copy the `limit=100` + `after` loop pattern from `AnomalyDetector`/`DuplicateFinder`.

## Extension checklist
- Entry and routing
  - Add new tools under `components/` and wire into `TABS` in `app.jsx` with an icon and label.
  - Gate actions behind a valid HubSpot token; optionally require `openAiKey` where applicable.
- API usage
  - Call HubSpot via `hubSpotApiRequest(path, method, token, body?)` only; never call HubSpot directly.
  - For heavy reads, use `limit=100` with `after` pagination; accumulate `data.results` until no `paging.next.after`.
  - Prefer batch write endpoints where available (see `GeoCorrector` for `batch/update`).
- UX behaviors
  - Show loading with `Spinner` and disable buttons while in-flight.
  - Surface errors via `err.message` in a `<p className="text-red-500">`.
  - Keep UI consistent with Tailwind utility classes used elsewhere.
- Data patterns
  - When analyzing properties (like fill rate), fetch properties via `/crm/v3/properties/{objectType}` and run `HAS_PROPERTY` searches to compute rates.
  - For dedupe flows, sort by `createdate` descending and merge into the newest record (see `DuplicateFinder`).
- Configuration
  - Respect query params `hubSpotToken` and `openAiKey` already handled in `app.jsx`.
  - Do not store tokens/keys server-side; the UI passes them to a proxy only.
