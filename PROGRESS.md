# Project Progress & Change Log

This document tracks notable changes and ongoing progress.

## 2025-09-13 — Alpha-ready setup, validation, and rate limits
- Local dev enablement:
  - Added Vite tooling (`vite.config.mjs`, `index.html`, `main.jsx`) and dev scripts to run frontend + example proxy concurrently.
  - Updated `package.json` with `react`, `react-dom`, and Vite scripts; added `.gitignore`.
  - Updated `README.md` with quick start, build/preview, and proxy notes.
- Production-ready API targeting:
  - `lib/api.js` selects base URL via `import.meta.env.DEV` (proxy in dev; `VITE_API_BASE`/`window.__DQC_API_BASE__` or `http://localhost:3001` in preview/prod).
  - Token sanitization to avoid `Bearer Bearer` errors.
- HubSpot token validation rewrite:
  - First try Private App introspection: `POST /oauth/v2/private-apps/get/access-token-info` with `{ tokenKey }`.
  - Fallback to OAuth metadata: `GET /oauth/v1/access-tokens/{token}`.
  - All calls go through the proxy; errors surface in UI; success enables tools.
  - Session persistence: HubSpot token and OpenAI key are stored in `sessionStorage` and rehydrated on load (also read from query params).
- Dev-only telemetry:
  - Track and console-log HubSpot validation success/failure counts in development to spot regressions.
- Rate limit resilience (HubSpot/OpenAI via proxy):
  - `fetchWithRetry` with exponential backoff + full jitter for 429/5xx and network errors; respects `Retry-After` header.
  - Lightweight HubSpot scheduler spaces requests by `HUBSPOT_MIN_INTERVAL_MS = 200ms` (~5 rps) to reduce bursts; dev logs when delaying.

### Agent-oriented improvements
- Added smoke scripts under `scripts/` for proxy, HubSpot, and OpenAI checks; wired npm scripts (`smoke:*`).
- Added `.editorconfig` and `.prettierrc.json` for consistent agent edits.
- Added `.github/copilot-codemap.md` and `.github/copilot-filemap.md` for quick agent discovery.
- Introduced `AGENT_GUIDE.md` to document commands, env vars, and conventions.

### Notes
- No UI/feature changes besides validation and stability improvements.
- For non-dev hosting, set `VITE_API_BASE` at build time or inject `window.__DQC_API_BASE__` at runtime to point to your backend proxy.

## 2025-09-12 — Modularization Refactor
- Extracted shared icons (including `Spinner`) into `components/icons.jsx`.
- Moved API utilities into `lib/api.js` (`apiRequest`, `hubSpotApiRequest`, `openAiApiRequest`).
- Split features into their own components:
  - `components/AnomalyDetector.jsx`
  - `components/PropertyFillRate.jsx`
  - `components/GeoCorrector.jsx`
  - `components/DuplicateFinder.jsx`
- Updated `app.jsx` to import and orchestrate the new modules.
- Preserved all UI and behavior (no visual or functional changes intended).
- Minor hardening: default empty array when parsing `response.corrections` in GeoCorrector to prevent runtime errors.

### Rationale
Improves readability, maintainability, and future evolution without altering the user experience. Each tool is now easier to test and enhance independently.

### Next Potential Improvements
- Add unit tests for `lib/api.js` and light render tests for components.
- Consider TypeScript for type safety across shared utilities and props.
- Extract shared table or button primitives if more reuse emerges.

---
Add new entries above this line with date (YYYY-MM-DD), a short title, and bullet points of changes.