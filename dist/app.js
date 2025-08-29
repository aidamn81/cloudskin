// === Aiden's Cloud — App.js with token auto-check + visible notices ===

const DEFAULT_COVER = "assets/foldercover.png";
const LS_LINKED = "pcloud_linked_folders";

// Local demo data so there's always something to see
const localData = {
  folders: [
    {
      id: "holiday",
      name: "Holiday",
      cover: DEFAULT_COVER,
      files: [
        { id: 1, name: "Beach.png", type: "photo", thumb: "https://picsum.photos/300/200?1", url: "https://picsum.photos/1200/800?1" },
        { id: 2, name: "Party.mp4", type: "video", thumb: "https://picsum.photos/300/200?3", url: "https://www.w3schools.com/html/mov_bbb.mp4" }
      ]
    }
  ]
};

// --- Linked folders storage helpers ---
function loadLinkedFolders() {
  try { return JSON.parse(localStorage.getItem(LS_LINKED)) || []; } catch { return []; }
}
function saveLinkedFolders(list) { localStorage.setItem(LS_LINKED, JSON.stringify(list)); }
function addLinkedFolder(folderid, name, cover) {
  const list = loadLinkedFolders();
  if (!list.find(f => String(f.id) === String(folderid))) {
    list.push({ id: Number(folderid), name: name || `Folder ${folderid}`, cover: cover || DEFAULT_COVER });
    saveLinkedFolders(list);
  }
}

// --- UI state ---
let currentProvider = "home";
let currentFolderCtx = null;

// --- Notice (visible message) ---
let noticeMessage = "";
function setNotice(msg) { noticeMessage = msg || ""; }
function renderNotice(containerEl) {
  // Remove old
  const old = containerEl.querySelector(".notice");
  if (old) old.remove();

  if (!noticeMessage) return;
  const n = document.createElement("div");
  n.className = "notice";
  // Inline styles so you don't need to edit CSS
  n.style.cssText = "width:100%;max-width:900px;margin:0 auto 12px auto;padding:10px 14px;border-radius:8px;background:rgba(255,255,255,0.16);color:#fff;text-align:center;font-weight:bold;";
  n.textContent = noticeMessage;
  containerEl.prepend(n);
}

// --- Token check ---
async function validateToken() {
  const t = PCLOUD_OAUTH.getToken();
  if (!t) return false;
  try {
    const res = await fetch(`https://api.pcloud.com/userinfo?access_token=${encodeURIComponent(t)}`);
    const data = await res.json();
    console.log("[app.js] /userinfo check →", data);
    if (data.result === 0) return true;
  } catch (e) {
    console.warn("[app.js] Token validation failed:", e);
  }
  // If here → invalid
  PCLOUD_OAUTH.logout();
  return false;
}

// --- Home view ---
async function renderHome() {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";

  // Show notice (if any)
  renderNotice(grid);

  // Auth bar
  const authBar = document.createElement("div");
  authBar.style.cssText = "width:100%;display:flex;justify-content:center;gap:10px;margin-bottom:10px;";

  const tokenOk = await validateToken();

  if (!tokenOk) {
    const b = document.createElement("button");
    b.textContent = "Connect pCloud";
    b.onclick = () => PCLOUD_OAUTH.login();
    authBar.appendChild(b);
  } else {
    const addBtn = document.createElement("button");
    addBtn.textContent = "Add pCloud folder by ID";
    addBtn.onclick = () => {
      const folderid = prompt("Enter pCloud folder ID (0 = root):", "0");
      if (folderid == null) return;
      const customName = prompt("Display name for this folder:", folderid === "0" ? "pCloud Root" : `Folder ${folderid}`);
      addLinkedFolder(folderid, customName, DEFAULT_COVER);
      render();
    };

    const logoutBtn = document.createElement("button");
    logoutBtn.textContent = "Log out of pCloud";
    logoutBtn.onclick = () => { PCLOUD_OAUTH.logout(); setNotice("Logged out of pCloud."); render(); };

    authBar.append(addBtn, logoutBtn);
  }
  grid.appendChild(authBar);

  // Local demo folder
  localData.folders.forEach(folder => {
    const div = document.createElement("div");
    div.className = "folder";
    div.innerHTML = `
      <img src="${folder.cover}" class="folder-cover" alt="Folder cover">
      <p class="folder-name">${folder.name}</p>
    `;
    div.onclick = () => openLocalFolder(folder);
    grid.appendChild(div);
  });

  // Linked pCloud folders
  loadLinkedFolders().forEach(folder => {
    const div = document.createElement("div");
    div.className = "folder";
    div.innerHTML = `
      <img src="${folder.cover || DEFAULT_COVER}" class="folder-cover" alt="Folder cover">
      <p class="folder-name">${folder.name}</p>
    `;
    div.onclick = () => openPcloudFolder(folder.id, folder.name);
    grid.appendChild(div);
  });

  document.getElementById("breadcrumbs").innerHTML = "Home";
}

// --- Local demo viewer ---
function openLocalFolder(folder) {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";
  document.getElementById("breadcrumbs").innerHTML = `<span onclick="goHome()">Home</span> / ${folder.name}`;

  // Clear any old notice in folder views
  setNotice("");
  renderNotice(grid);

  folder.files.forEach(f => {
    const div = document.createElement("div");
    div.className = "file";
    div.innerHTML = `
      <img src="${f.thumb}" class="file-thumb" alt="${f.name}">
      <p class="file-name">${f.name}</p>
    `;
    div.onclick = () => openViewer(f);
    grid.appendChild(div);
  });
}

// --- pCloud folder views ---
async function openPcloudFolder(folderid, name) {
  currentProvider = "pcloud";
  currentFolderCtx = { folderid, name };
  await renderPcloudFolder();
}

async function renderPcloudFolder() {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";
  document.getElementById("breadcrumbs").innerHTML = `<span onclick="goHome()">Home</span> / ${currentFolderCtx.name}`;

  // Validate token first
  const ok = await validateToken();
  if (!ok) {
    setNotice("Session expired or invalid token. Please reconnect to pCloud.");
    currentProvider = "home";
    await renderHome();
    return;
  }

  // Clear notice if we made it here
  setNotice("");
  renderNotice(grid);

  // List the folder
  let listing;
  try {
    listing = await pcloud.listFolder(currentFolderCtx.folderid);
  } catch (e) {
    setNotice(`Could not load folder: ${e.message}`);
    currentProvider = "home";
    await renderHome();
    return;
  }

  const contents = listing.metadata?.contents || [];
  const subfolders = contents.filter(c => c.isfolder);
  const files = contents.filter(c => c.isfile);

  // Subfolders
  subfolders.forEach(f => {
    const div = document.createElement("div");
    div.className = "folder";
    div.innerHTML = `
      <img src="${DEFAULT_COVER}" class="folder-cover" alt="Folder cover">
      <p class="folder-name">${f.name}</p>
    `;
    div.onclick = () => openPcloudFolder(f.folderid, f.name);
    grid.appendChild(div);
  });

  // Files
  for (const f of files) {
    let linkUrl = "";
    try {
      const linkRes = await pcloud.getFileLink(f.fileid);
      if (linkRes?.hosts?.length && linkRes.path) {
        linkUrl = `https://${linkRes.hosts[0]}${linkRes.path}`;
      } else if (linkRes?.downloadlink) {
        linkUrl = linkRes.downloadlink;
      }
    } catch {}

    const isImage = /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(f.name);
    const thumb = isImage && linkUrl ? linkUrl : "https://picsum.photos/300/200?blur=2";

    const div = document.createElement("div");
    div.className = "file";
    div.innerHTML = `
      <img src="${thumb}" class="file-thumb" alt="${f.name}">
      <p class="file-name">${f.name}</p>
    `;
    div.onclick = () => openViewer({ type: isImage ? "photo" : "video", url: linkUrl || "#", name: f.name });
    grid.appendChild(div);
  }
}

// --- Navigation + viewer ---
function goHome() { currentProvider = "home"; currentFolderCtx = null; renderHome(); }

function openViewer(file) {
  const viewer = document.getElementById("viewer");
  const content = document.getElementById("viewer-content");
  content.innerHTML = file.type === "photo"
    ? `<img src="${file.url}" alt="${file.name}">`
    : `<video src="${file.url}" controls autoplay></video>`;
  viewer.style.display = "flex";
}
function closeViewer() {
  document.getElementById("viewer").style.display = "none";
  document.getElementById("viewer-content").innerHTML = "";
}

// --- Boot ---
document.addEventListener("DOMContentLoaded", () => {
  PCLOUD_OAUTH.handleRedirectHash(); // pick up token on login redirect
  renderHome();
});

// Expose for HTML buttons (if any)
window.goHome = goHome;
window.openViewer = openViewer;
window.closeViewer = closeViewer;
