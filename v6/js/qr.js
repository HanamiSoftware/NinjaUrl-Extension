import { USER } from "js/user.js";
import { QRCodeStyling } from "libs/qr-code-styling.js";
let currentQR = null;

export function getQRConfig(url, options = {}) {
    const base = {
        data: url,
        width: 220,
        height: 220
    };

    if (USER.tier === "standard") {
        return {
            ...base,
            image: options.logo || "assets/logo-small.png",
            dotsOptions: {
                color: options.color || "#000",
                type: options.shape || "rounded"
            },
            cornersSquareOptions: {
                type: "extra-rounded"
            }
        };
    }

    if (USER.tier === "free") {
        return {
            ...base,
            dotsOptions: {
                color: "#000",
                type: "square"
            }
        };
    }

    // anonymous
    return {
        ...base,
        dotsOptions: {
            color: "#555",
            type: "square"
        }
    };
}

export function renderQR(container, url, options = {}) {
    container.innerHTML = "";

    currentQR = new QRCodeStyling(getQRConfig(url, options));
    currentQR.append(container);
}

export function downloadQR() {
    if (currentQR) {
        currentQR.download({ name: "ninja-qr", extension: "png" });
    }
}