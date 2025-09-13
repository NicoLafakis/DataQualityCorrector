# Agent Guide

This repository is optimized for AI/agent maintenance. Below are the minimal, deterministic steps and conventions to operate, validate, and extend the codebase.

## Commands
- Dev (frontend + proxy): `npm run dev`
- Build: `npm run build`
- Preview build: `npm run preview`
- Smoke tests:
  - Proxy health: `npm run smoke:proxy`
  - HubSpot via proxy: `HUBSPOT_TOKEN=... npm run smoke:hubspot`
  - OpenAI via proxy: `OPENAI_KEY=... npm run smoke:openai`

## Environment
- Proxy base URL: `PROXY_BASE` (default `http://localhost:3001`)
- HubSpot: `HUBSPOT_TOKEN` (private app or OAuth token; no `Bearer` prefix needed)
- OpenAI: `OPENAI_KEY`
- Frontend API base (non-dev):
  - Build-time: `VITE_API_BASE`
  - Runtime: `window.__DQC_API_BASE__` (injected before bundle)

## Behaviors
- Token validation (app.jsx):
  1) POST `/oauth/v2/private-apps/get/access-token-info` with `{ tokenKey }`
  2) Fallback GET `/oauth/v1/access-tokens/{token}`
- Rate limiting (lib/api.js):
  - Global retry/backoff for 429/5xx with `Retry-After` support
  - HubSpot scheduler spacing: 200ms interval (~5 rps)
- Session storage:
  - HubSpot token + OpenAI key stored in `sessionStorage`
- Dev telemetry:
  - Console counts for HubSpot validation success/failure

## Conventions
- All external calls go through proxy endpoints `/api/hubspot` and `/api/openai`.
- Avoid UI changes when altering behavior; surface errors via `err.message` in red text.
- Use `Spinner` during async and disable buttons to prevent duplicate actions.
- Keep features isolated under `components/` and wire into `app.jsx` tabs.

## Extension checklists
- Add feature: create `components/MyFeature.jsx`, add tab in `app.jsx` with icon/label.
- HubSpot pagination: `limit=100` and `paging.next.after` loop; push results to array.
- Batch updates: prefer HubSpot batch endpoints (example in `GeoCorrector`).

## Troubleshooting
- 429/5xx: automatic retries; adjust `HUBSPOT_MIN_INTERVAL_MS` if bursty workloads.
- Preview mode failing: set `VITE_API_BASE` or `window.__DQC_API_BASE__` to proxy URL.
- Credentials: ensure `sessionStorage` has `hubSpotToken`, `openAiKey`, or pass via query params.
