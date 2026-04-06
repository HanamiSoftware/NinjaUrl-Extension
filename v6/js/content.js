/* global chrome */
console.log("NinjaURL Content Script Avviato");
chrome.runtime.sendMessage({ type: "TEST", info: window.location.href }, res => {
    console.log("Risposta dal worker:", res);
});
//function createShortLink(longUrl) {
//    if (!longUrl) return null;

//    const endpoint = "https://api.ninjaurl.io/v1/link/create";
//    const payload = { url: longUrl }; // <-- così come vuole la tua API

//    const xhr = new XMLHttpRequest();
//    xhr.open("POST", endpoint, false); // false = sincrono
//    xhr.setRequestHeader("Content-Type", "application/json");
//    xhr.send(JSON.stringify(payload));

//    if (xhr.status >= 200 && xhr.status < 300) {
//        return JSON.parse(xhr.responseText);
//    } else {
//        console.error("Errore API:", xhr.status, xhr.responseText);
//        return null;
//    }
//}

//const longUrl = window.location.href;
//const data = createShortLink(longUrl);

//if (data && data.slug) {
//    const shortUrl = data.slug;
//    try {
//        navigator.clipboard.writeText(shortUrl);
//        console.log("URL accorciato e copiato: " + shortUrl);
//    } catch (err) {
//        console.warn("Impossibile copiare negli appunti:", err.message);
//    }

//    chrome.runtime.sendMessage({ type: "shortened", url: shortUrl, meta: data });
//} else {
//    chrome.runtime.sendMessage({ type: "error", message: "Creazione short URL fallita" });
//}