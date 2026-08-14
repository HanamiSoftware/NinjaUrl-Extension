/* global chrome */
// @ts-nocheck

console.log("Background worker attivato");

const AUTH_DOMAIN = "https://auth.ninjaconnect.io";
const CLIENT_ID = "bc418ed1dc646a32";
const API_BASE = "https://api.ninjaurl.io/v1";

let currentUrl = "";
let isAuthenticating = false;
let isAuthenticated = false;

// ======================
// INIT
// ======================

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
    if (!url && !(url.startsWith("https://") || url.startsWith("http://"))){
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
        sendResponse({ url: currentUrl });
        return true;
    }

    if (msg.type === "GET_USER") {
        getUser().then(sendResponse);
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
    return res.user || { tier: "anonymous" };
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
        // const token = await getValidAccessToken();
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
        const token = await getValidAccessToken();

        const { ninja_guest_api_key } =
            await chrome.storage.local.get("ninja_guest_api_key");

        const res = await fetch(`${API_BASE}/link/create`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
const authSessions = new Map();

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

    authSessions.set(state, {
        verifier,
        challenge,
        createdAt: Date.now(),
        redirectUri
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
                if (chrome.runtime.lastError || !responseUrl) {
                    authSessions.delete(state);
                    return reject(chrome.runtime.lastError?.message || "Auth failed");
                }

                const url = new URL(responseUrl);

                const code = url.searchParams.get("code");
                const returnedState = url.searchParams.get("state");
                const errorParam = url.searchParams.get("error");

                if (errorParam) {
                    authSessions.delete(returnedState);
                    return reject(errorParam);
                }

                const session = authSessions.get(returnedState);

                if (!session) {
                    return reject("Invalid or expired auth session (state mismatch)");
                }

                authSessions.delete(returnedState);

                if (!code) return reject("No code");

                try {
                    const tokens = await exchangeCode(
                        code,
                        session.verifier,
                        session.redirectUri
                    );

                    await chrome.storage.local.set({ auth: tokens });

                    // Recupera il profilo utente + tier di abbonamento
                    const user = await fetchUserProfile(tokens.access_token);

                    await chrome.storage.local.set({ user });

                    // Avvisa il sidepanel che l'utente ha fatto login/logout
                    chrome.runtime.sendMessage({ type: "USER_UPDATED", user }).catch(() => { });

                    resolve(user);

                } catch (e) {
                    reject(e);
                }
            }
        );
    });
}

async function exchangeCode(code, codeVerifier, redirectUri) {

    const body = new URLSearchParams({
        grant_type: "authorization_code",
        client_id: CLIENT_ID,
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier
    });

    const res = await fetch(`${AUTH_DOMAIN}/oauth2/token`, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: body.toString()
    });

    const text = await res.text();

    if (!res.ok) {
        throw new Error(text);
    }

    const tokens = JSON.parse(text);

    
    tokens.expires_at = Math.floor(Date.now() / 1000) + tokens.expires_in;

    return tokens;
}

async function refreshToken() {
    const { auth } = await chrome.storage.local.get("auth");

    if (!auth?.refresh_token) throw new Error("No refresh token");

    const res = await fetch(`${AUTH_DOMAIN}/oauth2/token`, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
            client_id: CLIENT_ID,
            refresh_token: auth.refresh_token,
            grant_type: "refresh_token"
        }).toString()
    });

    if (!res.ok) throw new Error("Refresh failed");

    const newTokens = await res.json();
    newTokens.expires_at = Math.floor(Date.now() / 1000) + newTokens.expires_in;

    const merged = { ...auth, ...newTokens };

    await chrome.storage.local.set({ auth: merged });

    return merged;
}

async function getValidAccessToken() {
    const { auth } = await chrome.storage.local.get("auth");

    if (!auth) return null;

    const now = Math.floor(Date.now() / 1000);

    // Rinnova se manca meno di 60s alla scadenza
    if (!auth.expires_at || auth.expires_at - now < 60) {
        try {
            const refreshed = await refreshToken();
            return refreshed.access_token;
        } catch (e) {
            console.error("Token refresh failed, logging out:", e);
            await logout();
            return null;
        }
    }

    return auth.access_token;
}

async function fetchUserProfile(accessToken) {
    // 1. Profilo base da Authgear (email, nome, sub id)
    const res = await fetch(`${AUTH_DOMAIN}/oauth2/userinfo`, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!res.ok) throw new Error("Failed to fetch userinfo from Authgear");

    const profile = await res.json();

    // 2. Tier / dati di abbonamento dal database
    let tier = "free";
    try {
        const meRes = await fetch(`${API_BASE}/user/me`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (meRes.ok) {
            const me = await meRes.json();
            tier = me?.tier || "free";
        }
    } catch (e) {
        console.warn("Could not fetch tier from backend, defaulting to 'free'", e);
    }

    return {
        sub: profile.sub,
        email: profile.email,
        name: profile.given_name,
        picture: profile.picture,
        tier
    };
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
