const USER = {
    tier: "anonymous" // "free" | "standard"
};

// In futuro:
//async function loadUser() {
//    const data = await chrome.storage.local.get("user");
//    if (data.user) {
//        USER.tier = data.user.tier;
//    }
//}