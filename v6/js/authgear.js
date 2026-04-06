document.addEventListener("DOMContentLoaded", async () => {

    const loginBtn = document.getElementById("loginBtn");
    loginBtn.onclick = () => {
        const CLIENT_ID = "c2106621de092298";

        const REDIRECT_URI = chrome.identity.getRedirectURL("auth");

        const AUTH_URL = `https://auth.ninjaconnect.io/oauth2/authorize` +
            `?response_type=token` +
            `&client_id=${CLIENT_ID}` +
            `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;


        chrome.identity.launchWebAuthFlow(
            {
                url: AUTH_URL,
                interactive: true
            },
            async (redirectUrl) => {
                if (chrome.runtime.lastError || !redirectUrl) {
                    console.log("Login failed");
                }

                // 👉 estrai token da fragment (#access_token=...)
                const hash = new URL(redirectUrl).hash.substring(1);
                const params = new URLSearchParams(hash);

                const accessToken = params.get("access_token");

                if (!accessToken) {
                    console.log("No token");
                }

                // salva token
                await chrome.storage.local.set({ accessToken });


            }
        );
    };
});