console.log("TS Background worker attivato");
let currentUrl = "";
//init background worker
chrome.action.onClicked.addListener((tab) => {
    if (!tab.id)
        return;
    chrome.sidePanel.open({ tabId: tab.id });
});
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (!tab.url)
        return;
    updateUrl(tab.url);
});
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tab.active && changeInfo.url) {
        updateUrl(changeInfo.url);
    }
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
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
    if (msg.type === "SHORTEN_URL") {
        await handleShorten(msg.payload.url).then(sendResponse);
        return true;
    }
    if (msg.type === "GET_LINKS") {
        getLinks().then(sendResponse);
        return true;
    }
    if (msg.type === "GET_CURRENT_URL") {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            sendResponse({ url: currentUrl });
        });
        return true;
    }
    if (msg.type === "GET_USER") {
        getUser().then(sendResponse);
        return true;
    }
    if (msg.type === "DELETE_LINK") {
        return;
    }
    if (msg.type === "GET_LINKS_NUMBER") {
        countLinks().then(sendResponse);
    }
});
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
async function handleShorten(longUrl) {
    try {
        const res = await fetch("https://api.ninjaurl.io/v1/link/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: longUrl }),
        });
        const data = await res.json();
        const slug = data?.data?.slug;
        if (!slug)
            throw new Error("Invalid API");
        const short = "https://n2l.ink/" + slug;
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
        chrome.action.setBadgeText({ text: String(links.length) });
        return { success: true, data: newItem };
    }
    catch (e) {
        console.error(e);
        return { success: false };
    }
}
export {};
