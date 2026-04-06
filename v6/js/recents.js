function createCard(item) {
    const div = document.createElement("div");
    div.className = "recent-card";
    div.innerHTML = `
    <div class="recent-card__content">
      <p class="recent-card__short">${item.ninjaLink}</p>
      <p class="recent-card__long">${item.long}</p>
    </div>
    <div class="recent-card__actions">
      <button class="icon-btn copy">📋</button>
      <button class="icon-btn qr">📱</button>
      <button class="icon-btn share">🔗</button>
    </div>
  `;
    div.addEventListener("click", () => copy(item.ninjaLink, div));
    div.querySelector(".copy").onclick = e => { e.stopPropagation(); copy(item.ninjaLink, div); };
    div.querySelector(".qr").onclick = e => { e.stopPropagation(); showQR(item.ninjaLink); };
    div.querySelector(".share").onclick = e => { e.stopPropagation(); share(item.ninjaLink); };
    return div;
}

async function renderRecents() {
    const container = document.getElementById("recentsList");
    const recents = await getRecents();
    container.innerHTML = "";
    if (!recents.length) {
        container.innerHTML = `<div class="empty"><span>No links here</span></div>`;
        return;
    }
    recents.forEach(item => container.appendChild(createCard(item)));
}