console.log("TS Background worker attivato");
let currentUrl = "";
//init background worker
chrome.action.onClicked.addListener((tab) => {
    if (!tab.id)
        return;
    chrome.sidePanel.open({ tabId: tab.id });
});
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (tab.url)
            updateUrl(tab.url);
    }
    catch (error) {
        console.error("Unable to read the active tab", error);
    }
});
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
    if (tab.active && changeInfo.url)
        updateUrl(changeInfo.url);
});
function updateUrl(url) {
    currentUrl = normalize(url);
    // PROVA a notificare (ma senza rompere)
    chrome.runtime.sendMessage({
        type: "URL_UPDATED",
        url: currentUrl
    }).catch(() => { });
}
function normalize(url) {
    if (!url || url.startsWith("chrome://") || url.startsWith("about:") || url.startsWith("edge://")) {
        return "This Page cannot be Shortened";
    }
    return url;
}
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!isBackgroundMessage(msg))
        return false;
    if (msg.type === "SHORTEN_URL") {
        void handleShorten(msg.payload.url).then(sendResponse);
        return true;
    }
    if (msg.type === "GET_LINKS") {
        void getLinks().then(sendResponse);
        return true;
    }
    if (msg.type === "GET_CURRENT_URL") {
        sendResponse({ url: currentUrl });
        return false;
    }
    if (msg.type === "GET_USER") {
        void getUser().then(sendResponse);
        return true;
    }
    if (msg.type === "DELETE_LINK")
        return false;
    void countLinks().then(sendResponse);
    return true;
});
function isBackgroundMessage(message) {
    if (!message || typeof message !== "object" || !("type" in message))
        return false;
    const type = message.type;
    if (type !== "SHORTEN_URL")
        return [
            "GET_LINKS",
            "GET_CURRENT_URL",
            "GET_USER",
            "DELETE_LINK",
            "GET_LINKS_NUMBER",
        ].includes(type);
    if (!("payload" in message) || !message.payload || typeof message.payload !== "object")
        return false;
    return "url" in message.payload && typeof message.payload.url === "string";
}
async function getUser() {
    const res = await chrome.storage.local.get("user");
    return res.user || { tier: "anonymous" };
}
async function getLinks() {
    const res = await chrome.storage.local.get("links");
    return res.links || [];
}
async function countLinks() {
    return (await getLinks()).length;
}
async function handleShorten(longUrl) {
    try {
        const res = await fetch("https://api.ninjaurl.io/v1/link/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: longUrl }),
        });
        if (!res.ok)
            throw new Error(`API request failed with status ${res.status}`);
        const data = await res.json();
        const slug = data.data?.slug;
        if (!slug)
            throw new Error("Invalid API");
        const links = await getLinks();
        const newItem = {
            id: crypto.randomUUID(),
            slug,
            short: `https://n2l.ink/${slug}`,
            long: longUrl,
            isNew: true,
            createdAt: new Date().toISOString(),
        };
        links.unshift(newItem);
        await chrome.storage.local.set({ links });
        chrome.action.setBadgeText({ text: String(links.length) });
        return { success: true, data: newItem };
    }
    catch (error) {
        console.error(error);
        return { success: false };
    }
}
export {};
