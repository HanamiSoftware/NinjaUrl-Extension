/* global chrome */
// @ts-nocheck

console.log("Background worker attivato");

const AUTH_DOMAIN = "https://auth.ninjaconnect.io";
const CLIENT_ID = "bc418ed1dc646a32";
const API_BASE = "http://127.0.0.1:8787/v1";

//const API_BASE = "https://api.ninjaurl.io/v1";
const API_RESOURCE = "https://api.ninjaurl.io/v1";
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
		restoreSession()
			.then((user) => {
				sendResponse({
					success: true,
					authenticated: !!user,
					user: user ?? null
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
			.then((response) => {

				console.log("LOGIN response:", response);
				sendResponse({ success: true });
			})
			.catch((err) => {
				console.error("LOGIN error:", err);
				sendResponse({ success: false });
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

	isAuthenticating = true;
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
		`&scope=openid%20profile%20email%20offline_access%20user.read` +
		`&code_challenge=${challenge}` +
		`&code_challenge_method=S256` +
		`&state=${state}` +
		`&resource=${encodeURIComponent(API_RESOURCE)}`




	try {
		const responseUrl = await chrome.identity.launchWebAuthFlow(
			{ url: authUrl, interactive: true });




		if (chrome.runtime.lastError || !responseUrl) {

			isAuthenticating = false;

			throw new Error("Authentication failed or was canceled");

			return;
		}


		const url = new URL(responseUrl);

		const code = url.searchParams.get("code");

		const returnedState = url.searchParams.get("state");



		const storageKey = `oauth_${returnedState}`;

		const result = await chrome.storage.session.get(storageKey);

		const session = result[storageKey];

		if (!session) {

			isAuthenticating = false;
			throw new Error("Session not found or state mismatch: " + returnedState);

			return;
		}



		const tokens = await exchangeCode(

			state,
			code,
			session.verifier,
			session.redirectUri
		);


		const user = await getSession();


		await chrome.storage.local.set({ user });
		chrome.runtime.sendMessage({ type: "USER_UPDATED", user }).catch(() => { });
		isAuthenticating = false;
		return user;
		//  Avvisa il sidepanel che l'utente ha fatto login




	} catch (e) {
		chrome.runtime.sendMessage({ type: "LOGIN_CANCELED", user: null, error: e.message }).catch(() => { });
		isAuthenticating = false;
		throw new Error("Authentication failed: " + e.message);
		return;

	} finally {

		//eliminare la sessione oauth
		await chrome.storage.session.remove(`oauth_${returnedState}`);
	}

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
	const { user } = await chrome.storage.local.get("user");

	await chrome.storage.local.remove("user");

	await fetch(`${API_BASE}/logout`, {
		method: "POST",
		credentials: "include"
	});

	const anonymousUser = { tier: "anonymous" };
	chrome.runtime.sendMessage({ type: "USER_UPDATED", user }).catch(() => { });

	return true;
}

function isAuthenticated() {
	return authenticated;
}


async function getSession() {
	const res = await fetch(`${API_BASE}/session`, {
		method: "GET",
		credentials: "include",
		headers: {
			"Accept": "application/json"
		}
	});

	let result;

	try {
		result = await res.json();
	} catch {
		throw new Error("Invalid JSON response from session endpoint");
	}

	if (!res.ok || !result.success) {
		const error = new Error(
			result.message ||
			result.error?.message ||
			`Session request failed: HTTP ${res.status}`
		);

		error.code = result.error?.code || "SESSION_REQUEST_FAILED";
		error.status = res.status;

		throw error;
	}

	const data = result.data;

	if (
		!data ||
		typeof data.authenticated !== "boolean"
	) {
		console.error("Invalid session response structure");
	}

	if (data.authenticated && !data.user) {
		console.error("Authenticated session without user");
	}

	return {
		authenticated: data.authenticated,
		user: data.user || null,
		session: data.session || null
	};
}




async function restoreSession() {
	try {
		const session = await getSession();

		authenticated = session.authenticated;

		if (!session.authenticated) {
			await chrome.storage.local.remove("user");
			return null;
		}

		await chrome.storage.local.set({
			user: session.user
		});

		return session.user;

	} catch (error) {
		console.error("Session restoration failed:", error);

		// Non cancelliamo la cache in caso di errore temporaneo.
		authenticated = false;

		throw error;
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

