// Analytics endpoints (docs/analytics-plan.md, docs/first-party-analytics-plan.md).
// Both stay empty until the services exist, and each side is inert while its value is empty.
export const ANALYTICS = {
  // GA4 measurement id, e.g. 'G-XXXXXXXXXX'. Supplied later.
  gaMeasurementId: '',
  // Base URL of the API Worker that serves /config and /events, e.g. 'https://api.freecellworlds.com'.
  api: '',
};

// Build id. tools/prepare-pages.mjs stamps this line for each Pages deploy.
export const APP_VERSION = 'dev';
