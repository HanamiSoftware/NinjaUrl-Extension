/* global chrome */
// @ts-nocheck

console.log("Background worker attivato");

const AUTH_DOMAIN = "https://auth.ninjaconnect.io";
const CLIENT_ID = "bc418ed1dc646a32";
const API_BASE = "https://api.ninjaurl.io/v1";

let currentUrl = "";
let isAuthenticating = false;
let authenticated = false;

// ======================
// INIT
// ======================
initializeAuth();

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tab.active && changeInfo.url && !isAuthenticating) {
        updateUrl(changeInfo.url);
    }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (!isAuthenticating) {

        updateUrl(tab.url);
    } else {

        return;
    }
    
});


chrome.sidePanel.setPanelBehavior({

    openPanelOnActionClick: true
});


function updateUrl(url) {

    currentUrl = normalize(url);

    chrome.runtime.sendMessage({
        type: "URL_UPDATED",
        url: currentUrl
    }).catch(() => { });
}

function normalize(url) {
    if (
        typeof url !== "string" ||
        (!url.startsWith("https://") && !url.startsWith("http://"))
    ) {
        return "This Page cannot be Shortened";
    }

    return url;
}

// ======================
// MESSAGE ROUTER
// ======================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

    if (msg.type === "SHORTEN_URL") {
        handleShorten(msg.payload.url).then(sendResponse);
        return true;
    }

    if (msg.type === "GET_LINKS") {
        getLinks().then(sendResponse);
        return true;
    }

    if (msg.type === "GET_CURRENT_URL") {
        chrome.tabs.query({
        active: true,
        currentWindow: true
    }).then(([tab]) => {

        const url = normalize(tab?.url);

        currentUrl = url;

        sendResponse({
            url,
            tabId: tab?.id ?? null
        });

    });

    return true;
    }

    if (msg.type === "GET_USER") {
        getUser().then(sendResponse);
        return true;
    }

    if (msg.type === "RESTORE_SESSION") {
        console.log("BACKGROUND: RESTORE_SESSION received");
        restoreSession()
            .then((user) => {
                console.log(
                    "BACKGROUND: restoreSession result:",
                    user
                );
                sendResponse({
                    authenticated: !!user,
                    user: user ?? null
                });
            })
            .catch((err) => {
                console.error("RESTORE_SESSION error:", err);

                sendResponse({
                    authenticated: false,
                    user: null
                });
            });

        return true;
    }

    if (msg.type === "DELETE_LINK") {
        deleteLink(msg.payload.id).then(sendResponse);
        return true;
    }

    if (msg.type === "GET_LINKS_NUMBER") {
        countLinks().then(sendResponse);
        return true;
    }

    if (msg.type === "LOGIN") {
        login()
            .then(sendResponse)
            .catch((err) => {
                console.error("LOGIN error:", err);
                sendResponse(null);
            });
        return true;
    }

    if (msg.type === "GET_TOKEN") {
        getValidAccessToken().then(sendResponse);
        return true;
    }

    if (msg.type === "LOGOUT") {
        logout().then(sendResponse);
        return true;
    }


});

// ======================
// LINKS & USER MANAGEMENT
// ======================
async function getUser() {
    const res = await chrome.storage.local.get("user");
    return res.user || null;
}

async function getLinks() {
    const res = await chrome.storage.local.get("links");
    return res.links || [];
}

async function countLinks() {
    const res = await chrome.storage.local.get("links");
    return (res.links || []).length;
}

async function deleteLink(id) {
    try {
        const links = await getLinks();
        const filtered = links.filter((l) => l.id !== id);
        await chrome.storage.local.set({ links: filtered });

        chrome.action.setBadgeText({ text: filtered.length ? String(filtered.length) : "" });

        // creare endpoint per l'eliminazione
        // const token = await getValidAccessToken(); oppure un altro metodo che verifica lo stato dell'utente
        // if (token) {
        //     await fetch(`${API_BASE}/link/${id}`, {
        //         method: "DELETE",
        //         headers: { Authorization: `Bearer ${token}` }
        //     });
        // }

        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false };
    }
}

async function handleShorten(longUrl) {
    try {
        //const token = await getValidAccessToken();

        const { ninja_guest_api_key } =
            await chrome.storage.local.get("ninja_guest_api_key");

        const res = await fetch(`${API_BASE}/link/create`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
               // ...(token ? { Authorization: `Bearer ${token}` } : {}),// Aggiungi l'header x-api-key solo se la chiave esiste 
//                ed inoltre non useremo piu' il token ma il cookie http only tramite credentials:'include'
                ...(ninja_guest_api_key
                    ? { "x-api-key": ninja_guest_api_key }
                    : {})
            },
            body: JSON.stringify({
                url: longUrl
            })
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data?.error ?? `HTTP ${res.status}`);
        }

        const {
            slug,
            apiKey
        } = data.data;

        if (!slug) {
            throw new Error("Invalid API response");
        }

        // Salva la guest api key solo la prima volta
        if (!ninja_guest_api_key && apiKey) {
            await chrome.storage.local.set({
                ninja_guest_api_key: apiKey
            });
        }

        const short = `https://n2l.ink/${slug}`;

        const links = await getLinks();

        const newItem = {
            id: crypto.randomUUID(),
            slug,
            short,
            long: longUrl,
            isNew: true,
            createdAt: new Date().toISOString()
        };

        links.unshift(newItem);

        await chrome.storage.local.set({ links });

        await chrome.action.setBadgeText({
            text: String(links.length)
        });

        return {
            success: true,
            data: newItem
        };

    } catch (err) {
        console.error("handleShorten:", err);

        return {
            success: false,
            error: err.message
        };
    }
}

// ======================
// NINJACONNECT - PKCE
// ======================

async function generatePKCE() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);

    const verifier = base64UrlEncode(array);

    const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(verifier)
    );

    const challenge = base64UrlEncode(new Uint8Array(digest));

    return { verifier, challenge };
}

function base64UrlEncode(buffer) {
    return btoa(String.fromCharCode(...buffer))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

async function login() {
    const redirectUri = chrome.identity.getRedirectURL("auth");

    const { verifier, challenge } = await generatePKCE();
    const state = crypto.randomUUID();

    await chrome.storage.session.set({
    [`oauth_${state}`]: {
        verifier,
        redirectUri,
        createdAt: Date.now()
    }
});

    const authUrl =
        `${AUTH_DOMAIN}/oauth2/authorize` +
        `?response_type=code` +
        `&client_id=${CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=openid%20profile%20email%20offline_access` +
        `&code_challenge=${challenge}` +
        `&code_challenge_method=S256` +
        `&state=${state}`;

    return new Promise((resolve, reject) => {
        isAuthenticating = true;
        chrome.identity.launchWebAuthFlow(
            { url: authUrl, interactive: true },
            async (responseUrl) => {
                isAuthenticating = false;

                const url = new URL(responseUrl);

                const code = url.searchParams.get("code");

                const returnedState = url.searchParams.get("state");
                if (chrome.runtime.lastError || !responseUrl) {
                    //eliminare la sessione oauth
                    await chrome.storage.session.remove(`oauth_${returnedState}`);
                    return reject(chrome.runtime.lastError?.message || "Auth failed");
                }

                
                const storageKey = `oauth_${returnedState}`;

const result = await chrome.storage.session.get(storageKey);

const session = result[storageKey];

if (!session) {
    return reject(
        "Invalid or expired auth session (state mismatch)"
    );
}
                

                try {
                    const tokens = await exchangeCode(

                        state,
                        code,
                        session.verifier,
                        session.redirectUri
                    );
await chrome.storage.session.remove(storageKey);

                    const user = await getCurrentUser();
                    

                    await chrome.storage.local.set({ user });

                    //  Avvisa il sidepanel che l'utente ha fatto login/logout
                     chrome.runtime.sendMessage({ type: "USER_UPDATED", user }).catch(() => { });

                    resolve(user);

                } catch (e) {
                    reject(e);
                }
            }
        );
    });
}

async function exchangeCode(

    state,
    code,
    codeVerifier,
    redirectUri
) {

    const body = {

        state,
        code: code,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri,
        client_id: CLIENT_ID
    };

    const res = await fetch(
        `${API_BASE}/exchange`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        }
    );

    const result = await res.json();

    if (!res.ok || !result.success) {
        throw new Error(
            result.error?.message ||
            "Authentication exchange failed"
        );
    }

    return result.data;
}

async function logout() {
    const { auth } = await chrome.storage.local.get("auth");

    await chrome.storage.local.remove(["auth", "user"]);
    chrome.action.setBadgeText({ text: "" });

    
    if (auth?.refresh_token) {
        fetch(`${AUTH_DOMAIN}/oauth2/revoke`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: CLIENT_ID,
                token: auth.refresh_token
            }).toString()
        }).catch(() => { });
    }

    const anonymousUser = { tier: "anonymous" };
    chrome.runtime.sendMessage({ type: "USER_UPDATED", user: anonymousUser }).catch(() => { });

    return true;
}

function isAuthenticated() {
    return authenticated;
}

async function getCurrentUser() {
    const res = await fetch(`${API_BASE}/user/me`, {
        method: "GET",
        credentials: "include"
    });
    console.log("GET /user/me status:", res.status);

    if (!res.ok) {
        throw new Error(`Failed to get current user: ${res.status}`);
    }

    const result = await res.json();
    //console.log("Results: ", result);
    return result.data.user;
}


async function restoreSession() {

    try {

        const user = await getCurrentUser();

        authenticated = true;

        await chrome.storage.local.set({ user });

        return user;

    } catch (error) {

        console.log("No active NinjaConnect session", error.message);

        authenticated = false;

        await chrome.storage.local.remove("user");

        return null;
    }
}


async function initializeAuth() {

    const user = await restoreSession();

    if (user) {

        chrome.runtime.sendMessage({
            type: "USER_UPDATED",
            user
        }).catch(() => { });

        return;
    }

    const anonymousUser = {
        tier: "anonymous"
    };

    chrome.runtime.sendMessage({
        type: "USER_UPDATED",
        user: anonymousUser
    }).catch(() => { });
}

