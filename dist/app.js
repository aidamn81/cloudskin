// === Aiden's Cloud — App.js ===

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

async function validateToken() {
  const t = PCLOUD_OAUTH.getToken();
  if (!t) return false;
  try {
    const res = await fetch(`https://api.pcloud.com/userinfo?access_token=${encodeURIComponent(t)}`);
    const data = await res.json();
    if (data.result === 0) return true;
  } catch {}
  PCLOUD_OAUTH.logout();
  return false;
}

async function renderHome() {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";

  const authBar = document.createElement("div");
  authBar.style.cssText = "width:100%;display:flex;justify-content:center;gap:10px;margin-bottom:10px;";

  const ok = await validateToken();
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

  localData.folders.forEach(f => {
    const d = document.createElement("div");
    d.className = "folder";
    d.innerHTML = `<img src="${f.cover}" class="folder-cover"><p class="folder-name">${f.name}</p>`;
    grid.appendChild(d);
  });

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

  const ok = await validateToken();
  if (!ok) { renderHome(); return; }

  let listing;
  try { listing = await pcloud.listFolder(folderid); }
  catch (e) { grid.innerHTML = `<p>Error: ${e.message}</p>`; return; }

  (listing.metadata.contents || []).forEach(c => {
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
  PCLOUD_OAUTH.handleRedirectHash();
  renderHome();
});
