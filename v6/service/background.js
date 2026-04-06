/* global chrome */
// @ts-check

console.log("Background worker attivato");
chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ tabId: tab.id });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "SHORTEN_URL") {
        handleShorten(msg.payload.url).then(sendResponse);
        return true;
    }

    if (msg.type === "GET_LINKS") {
        getLinks().then(sendResponse);
        return true;
    }

    if (msg.type === "GET_USER") {
        getUser().then(sendResponse);
        return true;
    }

    if (msg.type === "DELETE_LINK") { return; }

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

        if (!slug) throw new Error("Invalid API");

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

    } catch (e) {
        console.error(e);
        return { success: false };
    }
}