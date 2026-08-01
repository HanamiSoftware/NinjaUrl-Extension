window.NinjaURL = (function () {

    // =========================
    // TIME (solo logica pura)
    // =========================
    const time = {
        getRelative(date) {
            const now = Date.now();
            const diff = now - date;

            const seconds = Math.floor(diff / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);

            if (seconds < 60) return "adesso";
            if (minutes < 60) return `${minutes} min fa`;
            if (hours < 24) return `${hours} ore fa`;
            if (days < 7) return `${days} giorni fa`;

            const datePart = new Date(date).toLocaleDateString("it-IT", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric"
            });

            const timePart = new Date(date).toLocaleTimeString("it-IT", {
                hour: "2-digit",
                minute: "2-digit"
            });

            return `${datePart} - ${timePart}`;
        },

        formatAbsolute(date) {
            const datePart = new Date(date).toLocaleDateString("it-IT", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric"
            });
            const timePart = new Date(date).toLocaleTimeString("it-IT", {
                hour: "2-digit",
                minute: "2-digit"
            });
            return `${datePart} - ${timePart}`;
        }
    };

    // =========================
    // MANAGERS (stato + loop)
    // =========================
    const managers = {
        liveTimestamp: function ({ interval = 30000 } = {}) {

            const nodes = new Set();
            let timer = null;

            function register(node) {
                if (!node?.dataset?.timestamp) return;

                nodes.add(node);
                if (!timer) start();
            }

            function unregister(node) {
                nodes.delete(node);
                if (nodes.size === 0) stop();
            }

            function start() {
                timer = setInterval(update, interval);
                update();
            }

            function stop() {
                clearInterval(timer);
                timer = null;
            }

            function update() {
                for (const node of nodes) {
                    const ts = Number(node.dataset.timestamp);
                    if (!ts) continue;

                    node.textContent = time.getRelative(new Date(ts));
                }
            }

            return {
                register,
                unregister,
                start,
                stop
            };
        }
    };

    // =========================
    // UI (factory DOM)
    // =========================
    const ui = {
        createTimestamp(timestamp) {
            const el = document.createElement("span");
            el.className = "ninja-timestamp";
            el.dataset.timestamp = String(timestamp);
            return el;
        },

        hydrateTimestamps(root, manager) {
            root.querySelectorAll("[data-timestamp]").forEach((el) => {
                manager.register(el);
            });
        }
    };

    // =========================
    // PUBLIC API
    // =========================
    return {
        time,
        ui,
        managers
    };

})();