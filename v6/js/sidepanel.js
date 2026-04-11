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
    await setupEvents();
});

chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "URL_UPDATED") {
        activeTabUrl = msg.url;
        updateCurrentUrlUI();
    }
    if (msg.type === "URL_UNSUPPORTED") {
        activeTabUrl = msg.url;
        updateCurrentUrlUI();
    }
});


// ======================
// ACTIVE TAB
// ======================
async function initActiveTab() {

    chrome.runtime.sendMessage({ type: "GET_CURRENT_URL" }, (response) => {

        if (!response?.url || !isValidUrl(response.url)) {
            activeTabUrl = "This Page cannot be Shortened";
        } else {

            activeTabUrl = response.url;
        }
        updateCurrentUrlUI();
    })
}

function isValidUrl(url) {
    return typeof url === "string" && (url.startsWith("http://") || url.startsWith("https://"));
}

function updateCurrentUrlUI() {
    const el = document.getElementById("currentUrl");
    const shortenBtn = document.getElementById("shortenBtn");

    if (!el || !shortenBtn) return;

    const isValid = isValidUrl(activeTabUrl);

    el.textContent = isValid
        ? activeTabUrl
        : "This Page cannot be Shortened";

    shortenBtn.disabled = !isValid;
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

    const visible = showAll ? allLinks : getVisibleLinks();
    const container = document.getElementById("recentsList");
    if (!container) return;
    container.innerHTML = "";
    visible.forEach((link, i) => {
        const el = document.createElement("div");
        el.dataset.id = link.id;
        el.dataset.short = link.short;
        el.classList.add("recent-card", "link-item");
        /*el.style.maxHeight = showAll ? el.scrollHeight + "px" : "0";*/
        if (showAll) el.classList.add("show");

        el.innerHTML = `
            <div class="recent-card__content">
                <div class="recent-card__top">
                    <p class="recent-card__short">${link.short.replace(/^https:\/\//, "")}</p>
                    <div class="recent-card__actions">
                        <button class="icon-btn copy">
                            <img src="../assets/ui-icons/copy-icon.svg" width="24" height="24">
                        </button>
                        <button class="icon-btn dropdown-toggle">
                            <img src="../assets/ui-icons/icon-menu.svg" width="24" height="24">
                        </button>
                        <div class="dropdown-menu">
                            <button data-action="qr" class="qr">Show QR</button>
                            <button data-action="dash">View in Dash</button>
                            <button data-action="delete">Delete</button>
                        </div>
                    </div>
                </div>
                
                <p class="recent-card__long">${link.long}</p>
            </div>
            
        `;
        container.appendChild(el);

        if (link.isNew) {
            showNewBadge(el);
            link.isNew = false;
            chrome.storage.local.set({ links: allLinks });
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
            renderLinks();
        };

        container.appendChild(btn);
    }
}

// ======================
// EVENTS
// ======================
async function setupEvents() {

    document.addEventListener("click", (e) => {
        document.querySelectorAll(".dropdown-menu.open").forEach(menu => {
            menu.classList.remove("open");
        });
    });
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
    const container = document.getElementById("recentsList");
    container.addEventListener("click", (e) => {
        const card = e.target.closest(".link-item");
        if (!card) return;

        const menu = card.querySelector(".dropdown-menu");
        // ======================
        // TOGGLE DROPDOWN
        // ======================
        if (e.target.closest(".dropdown-toggle")) {
            e.stopPropagation();


            document.querySelectorAll(".dropdown-menu.open").forEach(m => {
                if (m !== menu) m.classList.remove("open");
            });

            menu.classList.toggle("open");
            return;
        }

        // ======================
        // AZIONI MENU
        // ======================
        const actionBtn = e.target.closest(".dropdown-menu button");
        if (actionBtn) {
            e.stopPropagation();

            const action = actionBtn.dataset.action;
            const id = card.dataset.id;

            switch (action) {
                case "qr":
                    showQR(card.dataset.short);
                    break;
                case "edit":
                    console.log("Edit", id);
                    break;

                case "view":
                    console.log("View", id);
                    break;

                case "delete":
                    console.log("Delete", id);
                    break;
            }

            menu.classList.remove("open");
            return;
        }

        // ======================
        // COPY BUTTON
        // ======================
        if (e.target.closest(".copy")) {
            e.stopPropagation();

            const short = card.dataset.short;
            copy(short, card);
            return;
        }

        // ======================
        // CLICK SU CARD -> COPY
        // ======================
        if (
            !e.target.closest(".icon-btn") &&
            !e.target.closest(".dropdown-menu")
        ) {
            const short = card.dataset.short;
            copy(short, card);
        }
    });
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
    badge.src = '../assets/ui-icons/Tooltip.svg';
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


    setTimeout(() => badge.style.transform = 'translateY(0)', 50);

    linkElement.style.position = 'relative';

    linkElement.appendChild(badge);

    setTimeout(() => {
        badge.style.opacity = '0';
        badge.style.transform = 'translateY(-5px)';
    }, 5000);

    setTimeout(() => badge.remove(), 5500);
}

// ======================
// QR
// ======================

function showQR(url) {
    let currentQR = null;

    const modal = document.getElementById("qrModal");
    const qrContainer = document.getElementById("qrContainer");

    if (!modal || !qrContainer) return;

    
    qrContainer.innerHTML = "";

    modal.classList.remove("hidden");

    currentQR = new QRCodeStyling(getQRConfig(url));

    
    currentQR.append(qrContainer);

    modal.onclick = () => modal.classList.add("hidden");
}

function getQRConfig(url) {
    url = addUrlParam(url, "source", "qr");

    const base = {
        data: url,
        width: 180,
        height: 180,
        image: "../assets/logo/logo-happy.png",
        imageOptions: {
            imageSize: 0.45,
            hidebackgroundDots: true
        },
        backgroundOptions: {
            color: "transparent"
        },
        qrOptions: {
            errorCorrectionLevel: "H"
        },
        dotsOptions: {
            color: "#000000",
            type: "rounded"
        },

        cornersSquareOptions: {
            color: "#000000",
            type: "extra-rounded"
        },

        cornersDotOptions: {
            color: "#000000",
            type: "dots"
        }
    };

    //if (currentUser.tier === "premium") {
    //    return {
    //        ...base,
    //        image: "../assets/logo/logo-happy.png",
    //        dotsOptions: { color: "#000", type: "extra-rounded" },
    //        cornersSquareOptions: {color:"#000", type: "extra-rounded" }
    //    };
    //}

    //if (currentUser.tier === "free") {
    //    return {
    //        ...base,
    //        dotsOptions: { color: "#000", type: "rounded" }
    //    };
    //}

    //return {
    //    ...base,
    //    dotsOptions: { color: "#555", type: "rounded" }
    //};

    return base;
}

function addUrlParam(url, key, value) {
    const qrUrl = new URL(url);
    qrUrl.searchParams.set(key, value);
    return qrUrl.toString();
}