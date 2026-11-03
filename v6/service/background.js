/* global chrome */
// @ts-nocheck

importScripts("../libs/ninja-auth.iife.js");

console.log("Background worker attivato");

const CLIENT_ID = "bc418ed1dc646a32";
const AUTH_ENVIRONMENT = "development";
const API_BASE = "http://127.0.0.1:8787/v1";

let currentUrl = "";
let isAuthenticating = false;
let ninjaAuthInitialized = false;

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
		restoreSession()
			.then((session) => {
				sendResponse({
					success: true,
					authenticated: session.authenticated,
					user: session.user,
					session: session.session,
					data: session
				});
			})
			.catch((err) => {
				sendResponse({
					success: false,
					authenticated: null,
					user: null,
					error: {
						code: err.code || "SESSION_ERROR",
						message: err.message
					}
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
			.then((session) => {
				sendResponse({ success: true, data: session });
			})
			.catch((err) => {
				console.error("LOGIN error:", err);
				sendResponse({
					success: false,
					error: { code: err.code || "LOGIN_ERROR", message: err.message }
				});
			});
		return true;
	}

	if (msg.type === "LOGOUT") {
		logout()
			.then((session) => {
				sendResponse({ success: true, data: session });
			})
			.catch((err) => {
				sendResponse({
					success: false,
					error: { code: err.code || "LOGOUT_ERROR", message: err.message }
				});
			});
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

		chrome.action.setBadgeText({
			text: links.length.toString()
		});


		chrome.action.setBadgeBackgroundColor
			({

				color: "#FF0000"

			});
		chrome.action.setBadgeTextColor({ color: "#FFFFFF" });

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
/* NinjaAuth integration */
// ======================

function getNinjaAuth() {
	if (!globalThis.NinjaConnect?.NinjaAuth) {
		throw new Error("NinjaAuth SDK bundle is not available in the Background worker.");
	}

	if (!ninjaAuthInitialized) {
		globalThis.NinjaConnect.NinjaAuth.init({
			clientId: CLIENT_ID,
			redirectUri: chrome.identity.getRedirectURL("auth"),
			platform: "extension",
			environment: AUTH_ENVIRONMENT
		});
		ninjaAuthInitialized = true;
	}

	return globalThis.NinjaConnect.NinjaAuth;
}

function anonymousSession() {
	return {
		authenticated: false,
		user: null,
		session: null
	};
}

async function saveSession(session) {
	if (session.authenticated && session.user) {
		await chrome.storage.local.set({ user: session.user });
	} else {
		await chrome.storage.local.remove("user");
	}
}

function notifySessionUpdate(session) {
	chrome.runtime.sendMessage({
		type: "USER_UPDATED",
		data: session
	}).catch(() => { });
}

async function login() {
	isAuthenticating = true;

	try {
		const auth = getNinjaAuth();
		await auth.login();
		const session = await auth.getSession();

		if (!session.authenticated || !session.user) {
			throw new Error("NinjaAuth login completed without an authenticated session.");
		}

		await saveSession(session);
		notifySessionUpdate(session);
		return session;
	} catch (error) {
		const messageType =
			error?.code === "OAUTH_DENIED" ||
			error?.code === "AUTHORIZATION_FAILED"
				? "LOGIN_CANCELED"
				: "LOGIN_ERROR";

		chrome.runtime.sendMessage({
			type: messageType,
			error: {
				code: error?.code || "LOGIN_ERROR",
				message: error?.message || "Authentication failed."
			}
		}).catch(() => { });

		throw error;
	} finally {
		isAuthenticating = false;
	}
}

async function restoreSession() {
    try {
        const user = await getUser();

        if (user) {
            return {
                authenticated: true,
                user,
                session: null
            };
        }

        const session = await getNinjaAuth().getSession();

        if (session?.authenticated && session.user) {
            await saveSession(session);
        }

        return session;

    } catch (error) {
        console.error("[Background] Session restore failed:", error);
        throw error;
    }
}

async function logout() {
	const auth = getNinjaAuth();
	await auth.logout();

	const session = anonymousSession();
	await saveSession(session);
	notifySessionUpdate(session);
	return session;
}

async function initializeAuth() {
	try {
		const session = await restoreSession();
		notifySessionUpdate(session);
	} catch (error) {
		console.error("NinjaAuth initialization could not resolve the session:", error);
	}
}
