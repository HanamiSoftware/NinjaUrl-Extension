const STORAGE_KEY = "recents";

async function getRecents() {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    return data[STORAGE_KEY] || [];
}

async function saveRecent(item) {
    const recents = await getRecents();
    const filtered = recents.filter(r => r.ninjaLink !== item.ninjaLink);
    filtered.unshift(item);
    const trimmed = filtered.slice(0, 20);
    await chrome.storage.local.set({ [STORAGE_KEY]: trimmed });
    return trimmed;
}