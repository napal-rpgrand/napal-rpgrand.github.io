// ============================================================
// FreeCoins — Deployment API Configuration
// ============================================================
// When running locally on http://localhost:3000, BACKEND_URL is empty
// and uses local relative routes automatically.
//
// When deployed on GitHub Pages (e.g. napal-rpgrand.github.io),
// set your public backend server URL below (Render, Railway, or tunnel),
// or configure it directly in the Admin Panel settings.
// ============================================================

window.APP_CONFIG = {
    BACKEND_URL: localStorage.getItem('BACKEND_API_URL') || ''
};
