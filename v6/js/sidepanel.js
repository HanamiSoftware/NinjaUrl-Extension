// ======================
// STATE
// ======================
let activeTabUrl = "";
let currentUser = { tier: "anonymous" };
let allLinks = [];
let showAll = false;
const visibleCount = 5;

// ======================
// INIT
// ======================
document.addEventListener("DOMContentLoaded", async () => {
    await initActiveTab();
    await loadUser();
    await loadLinks();
    setupEvents();
});

// ======================
// ACTIVE TAB
// ======================
async function initActiveTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tabs[0] || !tabs[0].url || tabs[0].url.startsWith("chrome://")) {
        activeTabUrl = "";
    } else {
        activeTabUrl = tabs[0].url;
    }

    updateCurrentUrlUI();
}

chrome.tabs.onActivated.addListener(initActiveTab);

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tab.active && changeInfo.url) {
        activeTabUrl = changeInfo.url.startsWith("chrome://") ? "" : changeInfo.url;
        updateCurrentUrlUI();
    }
});

function updateCurrentUrlUI() {
    const el = document.getElementById("currentUrl");
    if (el) el.textContent = activeTabUrl || "No valid URL";
}

// ======================
// USER
// ======================
async function loadUser() {
    const res = await chrome.runtime.sendMessage({ type: "GET_USER" });
    currentUser = res || { tier: "anonymous" };

    const badge = document.getElementById("userTier");
    if (badge) badge.textContent = currentUser.tier.toUpperCase();
}

// ======================
// LINKS
// ======================
async function loadLinks() {
    const res = await chrome.runtime.sendMessage({ type: "GET_LINKS" });
    allLinks = res || [];
    renderLinks();
}

function getVisibleLinks() {
    if (showAll) return allLinks;

    if (currentUser.tier === "anonymous") return allLinks.slice(0, 5);
    if (currentUser.tier === "free") return allLinks.slice(0, 20);

    return allLinks; // premium
}

// ======================
// RENDER
// ======================
function renderLinks() {
    const container = document.getElementById("recentsList");
    if (!container) return;

    const visible = showAll ? allLinks : getVisibleLinks();

    container.innerHTML = ""; 

    visible.forEach((link,i) => {
        const el = document.createElement("div");
        el.classList.add("recent-card", "link-item");
        /*el.style.maxHeight = showAll ? el.scrollHeight + "px" : "0";*/
        if (showAll) el.classList.add("show"); 

        el.innerHTML = `
            <div class="recent-card__content">
                <div class="recent-card__top">
                    <p class="recent-card__short">${link.short.replace(/^https:\/\//, "")}</p>
                    <div class="recent-card__actions">
                        <button class="icon-btn copy">
                            <img src="assets/ui-icons/copy-icon.svg" width="24" height="24">
                        </button>
                        <button class="icon-btn dropdown-toggle">
                            <img src="assets/ui-icons/icon-menu.svg" width="24" height="24">
                        </button>
                        <div class="dropdown-menu">
                            <button>Edit</button>
                            <button>View in Dash</button>
                            <button>Delete</button>
                        </div>
                    </div>
                </div>
                
                <p class="recent-card__long">${link.long}</p>
            </div>
            
        `;
        container.appendChild(el);
        const toggle = el.querySelector('.dropdown-toggle');
        const menu = el.querySelector('.dropdown-menu');

        toggle.addEventListener('click', e => {
            e.stopPropagation();
            menu.classList.toggle('open');
        });
        if (link.isNew) {
            showNewBadge(el);
            link.isNew = false;
            chrome.storage.local.set({ links: allLinks });
        }
        // bind eventi
        el.querySelector(".copy").onclick = (e) => {
            e.stopPropagation();
            copy(link.short, el);
        };
        //el.querySelector(".qr").onclick = (e) => {
        //    e.stopPropagation();
        //    showQR(link.short);
        //}
        //el.querySelector(".share").onclick = (e) => {
        //    e.stopPropagation();
        //    share(link.short);
        //}
        el.onclick = (e) => {
            e.stopPropagation();
            if (!e.target.closest(".icon-btn")) {
                copy(link.short, el);
            }
        };
        // gestione animazione
        if (showAll || i < visibleCount) {
            // link visibili subito
            el.style.maxHeight = el.scrollHeight + "px";
        } else {
            // link nascosti
            el.style.maxHeight = "0";
        }
    });

    // Toggle View All / View Less
    // Toggle button
    if (allLinks.length > visibleCount) {
        const btn = document.createElement("button");
        btn.className = "view-all-btn";
        btn.style.textAlign = "right";
        btn.textContent = showAll ? "View Less" : "View All";

        btn.onclick = () => {
            showAll = !showAll;
            // animazione smooth
            const cards = container.querySelectorAll(".link-item");
            cards.forEach((el, i) => {
                if (i >= visibleCount) {
                    if (showAll) {
                        el.style.maxHeight = el.scrollHeight + "px";
                    } else {
                        el.style.maxHeight = "0";
                    }
                }
            });
            btn.textContent = showAll ? "View Less" : "View All";
        };

        container.appendChild(btn);
    }
}

// ======================
// SHORTEN
// ======================
function setupEvents() {
    const btn = document.getElementById("shortenBtn");
    if (!btn) return;

    btn.onclick = async () => {
        if (!activeTabUrl) {
            return;
        }

        btn.textContent = "Shortening...";
        btn.disabled = true;

        try {
            const res = await chrome.runtime.sendMessage({
                type: "SHORTEN_URL",
                payload: { url: activeTabUrl }
            });

            if (!res?.success) throw new Error();
            await loadLinks();

            await navigator.clipboard.writeText(res.data.short);

            btn.textContent = "Copied";

        } catch (e) {
            console.error(e);
            btn.textContent = "Error";
        }

        setTimeout(() => {
            btn.textContent = "Shorten and Copy";
            btn.disabled = false;
        }, 1500);
    };
}

// ======================
// ACTIONS
// ======================
function copy(text, cardEl) {
    navigator.clipboard.writeText(text);

    const el = cardEl.querySelector(".recent-card__short");
    const original = el.textContent;

    el.textContent = "Copied ✅";
    setTimeout(() => el.textContent = original, 1000);
}

function share(url) {
    if (navigator.share) {
        navigator.share({ title: "NinjaURL", url });
    } else {
        navigator.clipboard.writeText(url);
        alert("Link copied!");
    }
}

function showNewBadge(linkElement) {
    const badge = document.createElement('img');
    badge.src = 'assets/ui-icons/Tooltip.svg';
    badge.style.cssText = `
        position: absolute;
        top: 20px;
        left: 16px;
        padding: 2px 6px;
        border-radius: 4px;
        opacity: 1;
        transition: opacity 0.5s ease, transform 0.3s ease;
        z-index: 10;
        transform: translateY(-5px);
    `;

    

    // dopo 6 secondi inizia fade out
    setTimeout(() => badge.style.transform = 'translateY(0)', 50);

    linkElement.style.position = 'relative';

    // appendi il badge direttamente alla card
    linkElement.appendChild(badge);

    // fade out
    setTimeout(() => {
        badge.style.opacity = '0';
        badge.style.transform = 'translateY(-5px)';
    }, 5000);

    setTimeout(() => badge.remove(), 5500);
}
// ======================
// QR
// ======================
let currentQR = null;

function showQR(url) {
    const modal = document.getElementById("qrModal");
    if (!modal) return;

    modal.innerHTML = "";
    modal.classList.remove("hidden");

    currentQR = new QRCodeStyling(getQRConfig(url));
    currentQR.append(modal);

    modal.onclick = () => modal.classList.add("hidden");
}

function getQRConfig(url) {
    url = addUrlParam("https://n2l.ink/Abcdefgh", "source", "qr");
    const base = {
        data: url,
        width: 220,
        height: 220
    };

    if (currentUser.tier === "premium") {
        return {
            ...base,
            image: "assets/logo/logo-happy.png",
            dotsOptions: { color: "#000", type: "rounded" },
            cornersSquareOptions: { type: "extra-rounded" }
        };
    }

    if (currentUser.tier === "free") {
        return {
            ...base,
            dotsOptions: { color: "#000", type: "rounded" }
        };
    }

    return {
        ...base,
        dotsOptions: { color: "#555", type: "rounded" }
    };
}
function addUrlParam(url, key, value) {
    const qrUrl = new URL(url);
    qrUrl.searchParams.set(key, value);
    return qrUrl.toString();
}