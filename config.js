// ============================================================
// FreeCoins — Deployment API Configuration
// ============================================================
// On localhost: uses local relative routes ('').
// On GitHub Pages or external domains: connects directly to the
// live Vercel backend (connected to TiDB Cloud MySQL).
// ============================================================

const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

window.APP_CONFIG = {
    BACKEND_URL: localStorage.getItem('BACKEND_API_URL') || (isLocalhost ? '' : 'https://freecoins-main.vercel.app')
};
