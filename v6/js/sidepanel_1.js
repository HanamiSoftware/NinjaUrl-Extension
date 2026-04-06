/* global chrome, QRCodeStyling */
import { loadUser, USER } from "js/user.js";
import { renderQR, downloadQR } from "js/qr.js";
document.addEventListener("DOMContentLoaded", async () => {
    console.log("Sidepanel avviato");
    const container = document.getElementById("links-container");
    container.innerHTML = ""; // pulisco prima di aggiungere le card

    // Prendi l'URL del tab attivo
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return;

    const longUrl = tab.url;

    async function createShortLink(longUrl) {
        const res = await fetch("https://api.ninjaurl.io/v1/link/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: longUrl })
        });
        if (!res.ok) throw new Error("API error " + res.status);
        return await res.json();
    }

    try {
        const data = await createShortLink(longUrl);
        console.log("Risposta API:", data);
        const shortUrl = data.data.slug || [];

        // Salva nello storage
        const result = await chrome.storage.local.get("urls");
        const urls = result.urls || [];
        urls.unshift(shortUrl);
        await chrome.storage.local.set({ urls: JSON.stringify(data) });
        chrome.action.setBadgeText({ text: urls.length.toString() });

        // Append della card come facevi tu
        const card = document.createElement("div");
        card.className = "link-card";

        const text = document.createElement("p");
        text.textContent = "Link accorciato: https://n2l.ink/" + shortUrl;
        card.appendChild(text);

        const qrContainer = document.createElement("div");
        card.appendChild(qrContainer);

        const qrCode = new QRCodeStyling({
            width: 120,
            height: 120,
            data: `https://n2l.ink/${shortUrl}`,
            dotsOptions: { color: "#1A1A1A", type: "rounded" },
            backgroundOptions: { color: "#ffffff" }
        });
        qrCode.append(qrContainer);

        container.appendChild(card);

        // Notifica
        chrome.notifications.create({
            type: "basic",
            iconUrl: "icons/icon48.png",
            title: "Ninja Url",
            message: "Link accorciato! Controlla il sidepanel.",
        });

    } catch (err) {
        console.error("Errore sidepanel:", err);
        const msg = document.createElement("p");
        msg.textContent = "Errore: " + err.message;
        container.appendChild(msg);
    }
})();