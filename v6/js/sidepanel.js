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
    if (msg.type === "USER_UPDATED") {
        currentUser = msg.user || { tier: "anonymous" };
        updateAuthUI();
        renderLinks();
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
// USER / AUTH
// ======================
async function loadUser() {
    const res = await chrome.runtime.sendMessage({ type: "GET_USER" });
    currentUser = res || { tier: "anonymous" };
    updateAuthUI();
}

function updateAuthUI() {

    const isLoggedIn = currentUser.tier !== "anonymous";
    const authBtn = document.getElementById("loginBtn");
    const profilePicture = document.getElementById("profile_picture");

    if (!authBtn || !profilePicture) return;

    if (isLoggedIn) {
        profilePicture.src = currentUser.picture;
        profilePicture.style.display = "block";
        profilePicture.style = "width:25px;height:25px;border-radius:25px";

        authBtn.textContent = `Ciao, ${currentUser.name}`;
        authBtn.style = "vertical-align:super";
        authBtn.dataset.state = "logged-in";

    } else {

        profilePicture.style.display = "none";
        profilePicture.src = "";

        authBtn.textContent = "Login";
        authBtn.dataset.state = "anonymous";
    }
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
    if (!visible.length) {
        const el = document.createElement("div");
        el.className = "no-links";
        el.innerHTML = `
                <div class="empty-img">
                    <img src="../assets/ui-icons/icon-triste.svg" />
                </div> 
                <div class="empty-text">
                    <p>No recent URLs yet.</p>
                </div>`
        container.appendChild(el);
    }
    visible.forEach((link, i) => {
        const el = document.createElement("div");
        el.dataset.id = link.id;
        el.dataset.short = link.short;
        el.classList.add("recent-card", "link-item");
        if (showAll) el.classList.add("show");

        el.innerHTML = `
            <div class="recent-card__content">
                <div class="recent-card__top">
                    <p class="recent-card__short">${link.short.replace(/^https:\/\//, "")}</p>
                    <div class="recent-card__actions">
                     <button class="icon-btn qr">
                            <img src="../assets/ui-icons/qr.svg">
                        </button>
                        <button class="icon-btn copy">
                            <img src="../assets/ui-icons/copy-icon.svg">
                        </button>
                        <button class="icon-btn dropdown-toggle">
                            <img src="../assets/ui-icons/icon-menu.svg">
                        </button>
                        <div class="dropdown-menu">
                            <button data-action="dash">View in Dash</button>
                            <button data-action="delete">Delete</button>
                            <button data-action="share">Share</button>
                        </div>
                    </div>
                </div>
                
                <p class="recent-card__long">${link.long}</p>
                <p class="recent-card__timestamp">${NinjaURL.time.getRelative(new Date(link.createdAt).getTime())}</p>
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
    if (allLinks.length > visibleCount) {
        const btn = document.createElement("button");
        btn.className = "view-all-btn";
        btn.style.textAlign = "left";
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
        if (e.target.closest(".dropdown-toggle")) return;
        if (e.target.closest(".dropdown-menu")) return;

        document.querySelectorAll(".dropdown-menu.open").forEach(menu => {
            menu.classList.remove("open");
        });

        const authBtn = e.target.closest("#loginBtn");
        if (authBtn) {
            if (authBtn.dataset.state === "logged-in") {
                // LOGOUT
                authBtn.textContent = "Logging out...";
                chrome.runtime.sendMessage({ type: "LOGOUT" }, () => {
                    currentUser = { tier: "anonymous" };
                    updateAuthUI();
                    renderLinks();
                });
            } else {
                // LOGIN
                authBtn.textContent = "Logging in...";
                chrome.runtime.sendMessage({ type: "LOGIN" }, (user) => {
                    if (user) {
                        currentUser = user;
                        updateAuthUI();
                        renderLinks();
                    } else {
                        updateAuthUI();
                        
                    }
                });
            }
            return;
        }
    }, true);

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

        // TOGGLE DROPDOWN
        if (e.target.closest(".dropdown-toggle")) {
            e.stopPropagation();

            document.querySelectorAll(".dropdown-menu.open").forEach(m => {
                if (m !== menu) m.classList.remove("open");
            });

            menu.classList.toggle("open");
            return;
        }

        // AZIONI MENU
        const actionBtn = e.target.closest(".dropdown-menu button");
        if (actionBtn) {
            e.stopPropagation();

            const action = actionBtn.dataset.action;
            const id = card.dataset.id;

            switch (action) {
                case "dash":
                    chrome.tabs.create({ url: `https://dash.ninjaurl.io/links/${id}` });
                    break;

                case "delete":
                    chrome.runtime.sendMessage({ type: "DELETE_LINK", payload: { id } }, async (res) => {
                        if (res?.success) {
                            await loadLinks();
                        }
                    });
                    break;
                case "share":
                    share(card.dataset.short);
                    break;
            }

            menu.classList.remove("open");
            return;
        }

        // COPY BUTTON
        if (e.target.closest(".copy")) {
            e.stopPropagation();

            const btn = e.target.closest(".copy");
            const short = card.dataset.short;

            btn.classList.add("copied");
            copy(short, card);

            setTimeout(() => {
                btn.classList.remove("copied");
            }, 1200);

            return;
        }

        // QR BUTTON
        if (e.target.closest(".qr")) {
            e.stopPropagation();

            const short = card.dataset.short;
            showQR(short);

            return;
        }
    });
}

// ======================
// ACTIONS
// ======================
function copy(text, cardEl) {
    navigator.clipboard.writeText(text);
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
    const badge = document.createElement('div');
    badge.className = 'new-badge';

    const badge_image = document.createElement('img');
    badge_image.src = '../assets/ui-icons/Tooltip.svg';
    badge.appendChild(badge_image);

    linkElement.prepend(badge);

    requestAnimationFrame(() => {
        setTimeout(() => {
            badge.classList.add('hide');

            badge.addEventListener('transitionend', () => {
                badge.remove();
            }, { once: true });

        }, 3000);
    });
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

    //impostazioni di base per il piano freemium
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
    //cambiare impostazione a seconda del piano scelto
    if (currentUser.tier === "premium") {
        return {
            ...base,
            image: "../assets/logo/logo-happy.png",
            dotsOptions: { color: "#000", type: "extra-rounded" },
            cornersSquareOptions: {color:"#000", type: "extra-rounded" }
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

    return base;
}

function addUrlParam(url, key, value) {
    const qrUrl = new URL(url);
    qrUrl.searchParams.set(key, value);
    return qrUrl.toString();
}
