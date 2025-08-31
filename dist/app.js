// Aiden's Cloud — App.js (token auto-check + clear only on 2094)

const DEFAULT_COVER = "assets/foldercover.png";
const LS_LINKED = "pcloud_linked_folders";

const localData = {
  folders: [
    {
      id: "holiday",
      name: "Holiday",
      cover: DEFAULT_COVER,
      files: [
        { id: 1, name: "Beach.png", type: "photo", thumb: "https://picsum.photos/300/200?1", url: "https://picsum.photos/1200/800?1" }
      ]
    }
  ]
};

function loadLinkedFolders() {
  try { return JSON.parse(localStorage.getItem(LS_LINKED)) || []; } catch { return []; }
}
function saveLinkedFolders(list) { localStorage.setItem(LS_LINKED, JSON.stringify(list)); }
function addLinkedFolder(id, name, cover) {
  const list = loadLinkedFolders();
  if (!list.find(f => String(f.id) === String(id))) {
    list.push({ id: Number(id), name, cover: cover || DEFAULT_COVER });
    saveLinkedFolders(list);
  }
}

// Soft validation (do NOT clear token here)
async function tokenSeemsValid() {
  const t = PCLOUD_OAUTH.getToken();
  if (!t) return false;
  try {
    const res = await fetch(`https://api.pcloud.com/userinfo?access_token=${encodeURIComponent(t)}`);
    const data = await res.json();
    return data.result === 0;
  } catch { return true; } // network/CORS? don't punish; let real call decide
}

async function renderHome() {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";

  const authBar = document.createElement("div");
  authBar.style.cssText = "width:100%;display:flex;justify-content:center;gap:10px;margin-bottom:10px;";

  const ok = await tokenSeemsValid();
  if (!ok) {
    const b = document.createElement("button");
    b.textContent = "Connect pCloud";
    b.onclick = () => PCLOUD_OAUTH.login();
    authBar.appendChild(b);
  } else {
    const addBtn = document.createElement("button");
    addBtn.textContent = "Add pCloud folder by ID";
    addBtn.onclick = () => {
      const id = prompt("Enter folder ID (0 for root):", "0");
      if (id == null) return;
      const name = prompt("Name for this folder:", id === "0" ? "Root" : `Folder ${id}`);
      addLinkedFolder(id, name, DEFAULT_COVER);
      renderHome();
    };
    const logoutBtn = document.createElement("button");
    logoutBtn.textContent = "Log out of pCloud";
    logoutBtn.onclick = () => { PCLOUD_OAUTH.logout(); renderHome(); };
    authBar.append(addBtn, logoutBtn);
  }
  grid.appendChild(authBar);

  // Demo tile
  localData.folders.forEach(f => {
    const d = document.createElement("div");
    d.className = "folder";
    d.innerHTML = `<img src="${f.cover}" class="folder-cover"><p class="folder-name">${f.name}</p>`;
    grid.appendChild(d);
  });

  // Linked pCloud tiles
  loadLinkedFolders().forEach(f => {
    const d = document.createElement("div");
    d.className = "folder";
    d.innerHTML = `<img src="${f.cover}" class="folder-cover"><p class="folder-name">${f.name}</p>`;
    d.onclick = () => openPcloudFolder(f.id, f.name);
    grid.appendChild(d);
  });

  document.getElementById("breadcrumbs").innerHTML = "Home";
}

async function openPcloudFolder(folderid, name) {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";
  document.getElementById("breadcrumbs").innerHTML = `Home / ${name}`;

  // Try listing; only clear token on an actual 2094
  let listing;
  try {
    listing = await pcloud.listFolder(folderid);
  } catch (e) {
    const msg = String(e.message || "");
    if (msg.includes("2094") || msg.toLowerCase().includes("invalid 'access_token'")) {
      PCLOUD_OAUTH.logout();
      grid.innerHTML = `<p style="color:#fff">Session expired or invalid token. Please tap “Connect pCloud”.</p>`;
      await renderHome();
      return;
    } else {
      grid.innerHTML = `<p style="color:#fff">Error: ${msg}</p>`;
      return;
    }
  }

  (listing.metadata?.contents || []).forEach(c => {
    if (c.isfolder) {
      const d = document.createElement("div");
      d.className = "folder";
      d.innerHTML = `<img src="${DEFAULT_COVER}" class="folder-cover"><p class="folder-name">${c.name}</p>`;
      d.onclick = () => openPcloudFolder(c.folderid, c.name);
      grid.appendChild(d);
    } else if (c.isfile) {
      const d = document.createElement("div");
      d.className = "file";
      const isImage = /\.(png|jpe?g|gif|webp)$/i.test(c.name);
      d.innerHTML = `<img src="${isImage ? "" : "https://picsum.photos/200"}" class="file-thumb"><p class="file-name">${c.name}</p>`;
      grid.appendChild(d);
    }
  });
}

function closeViewer() { document.getElementById("viewer").style.display = "none"; }

document.addEventListener("DOMContentLoaded", () => {
  PCLOUD_OAUTH.handleRedirectHash(); // save token if returning from login
  renderHome();
});
