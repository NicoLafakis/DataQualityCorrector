# Project Progress & Change Log

This document tracks notable changes and ongoing progress.

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