// === Aiden's Cloud — Script (rollback: demo tiles + Add pCloud by ID) ===

// -------- Settings --------
const DEFAULT_COVER = "assets/foldercover.png";

// Optional local demo data
const localData = {
  id: "local-root",
  name: "Local Demo",
  folders: [
    {
      id: "holiday",
      name: "Holiday",
      cover: DEFAULT_COVER,
      folders: [],
      files: [
        { id:1, name:"Beach.png", type:"photo", size:2000, date:"2024-08-01", thumb:"https://picsum.photos/300/200?1", url:"https://picsum.photos/1200/800?1", favorite:true },
        { id:2, name:"Party.mp4", type:"video", size:50000, date:"2024-08-03", thumb:"https://picsum.photos/300/200?3", url:"https://www.w3schools.com/html/mov_bbb.mp4", favorite:true }
      ]
    }
  ],
  files: [
    { id:4, name:"Mountains.png", type:"photo", size:3000, date:"2024-08-05", thumb:"https://picsum.photos/300/200?2", url:"https://picsum.photos/1200/800?2", favorite:false }
  ]
};

// pCloud-linked folders saved in localStorage
const LS_LINKED = "pcloud_linked_folders";
function loadLinkedFolders() {
  try { return JSON.parse(localStorage.getItem(LS_LINKED)) || []; } catch { return []; }
}
function saveLinkedFolders(list) {
  localStorage.setItem(LS_LINKED, JSON.stringify(list));
}
function addLinkedFolder(folderid, name, cover) {
  const list = loadLinkedFolders();
  if (!list.find(f => String(f.id) === String(folderid))) {
    list.push({ id: Number(folderid), name: name || `Folder ${folderid}`, cover: cover || DEFAULT_COVER });
    saveLinkedFolders(list);
  }
}

// UI State
let currentProvider = "home"; // "home" | "pcloud"
let currentFolderCtx = null;  // { provider:"pcloud", folderid, name }
let currentFilter = "all";
let currentSearch = "";
let currentSort = "name";

// Rendering
function render() {
  if (currentProvider === "home") renderHome();
  else if (currentProvider === "pcloud") renderPcloudFolder();
}

function renderHome() {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";

  // Auth bar
  const token = PCLOUD_OAUTH.getToken();
  const authBar = document.createElement("div");
  authBar.style.width = "100%";
  authBar.style.display = "flex";
  authBar.style.justifyContent = "center";
  authBar.style.gap = "10px";
  authBar.style.marginBottom = "10px";

  if (!token) {
    const b = document.createElement("button");
    b.textContent = "Connect pCloud";
    b.onclick = () => PCLOUD_OAUTH.login();
    authBar.appendChild(b);
  } else {
    const addBtn = document.createElement("button");
    addBtn.textContent = "Add pCloud folder by ID";
    addBtn.onclick = async () => {
      const folderid = prompt("Enter pCloud folder ID (0 for root /):", "0");
      if (folderid == null) return;
      const customName = prompt("Display name for this folder:", folderid === "0" ? "pCloud Root" : `Folder ${folderid}`);
      addLinkedFolder(folderid, customName, DEFAULT_COVER);
      render();
    };

    const logoutBtn = document.createElement("button");
    logoutBtn.textContent = "Log out of pCloud";
    logoutBtn.onclick = () => { PCLOUD_OAUTH.logout(); render(); };

    authBar.append(addBtn, logoutBtn);
  }
  grid.appendChild(authBar);

  // Local demo tiles
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

  // pCloud linked folders
  const linked = loadLinkedFolders();
  linked.forEach(folder => {
    const div = document.createElement("div");
    div.className = "folder";
    div.innerHTML = `
      <img src="${folder.cover || DEFAULT_COVER}" class="folder-cover" alt="Folder cover">
      <p class="folder-name">${folder.name}</p>
    `;
    div.onclick = () => openPcloudFolder(folder.id, folder.name);
    grid.appendChild(div);
  });

  // breadcrumbs
  document.getElementById("breadcrumbs").innerHTML = `Home`;
}

function openLocalFolder(folder) {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";
  document.getElementById("breadcrumbs").innerHTML = `<span onclick="goHome()">Home</span> / <span>${folder.name}</span>`;

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

// pCloud folder navigation
async function openPcloudFolder(folderid, name) {
  currentProvider = "pcloud";
  currentFolderCtx = { provider: "pcloud", folderid, name };
  await renderPcloudFolder();
}

async function renderPcloudFolder() {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";

  // breadcrumbs
  const bc = document.getElementById("breadcrumbs");
  bc.innerHTML = `<span onclick="goHome()">Home</span> / <span>${currentFolderCtx.name}</span>`;

  // fetch listing
  let listing;
  try {
    listing = await pcloud.listFolder(currentFolderCtx.folderid);
  } catch (e) {
    grid.innerHTML = `<p style="color:#fff">Error loading folder: ${e.message}</p>`;
    return;
  }

  const contents = listing.metadata && listing.metadata.contents ? listing.metadata.contents : [];
  const subfolders = contents.filter(c => c.isfolder);
  const files = contents.filter(c => c.isfile);

  // subfolders
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

  // files
  for (const f of files) {
    const div = document.createElement("div");
    div.className = "file";

    // Attempt a direct link for preview
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

    div.innerHTML = `
      <img src="${thumb}" class="file-thumb" alt="${f.name}">
      <p class="file-name">${f.name}</p>
    `;
    div.onclick = () => openViewer({ type: isImage ? "photo" : "video", url: linkUrl || "#", name: f.name });
    grid.appendChild(div);
  }
}

// Navigation
function goHome() {
  currentProvider = "home";
  currentFolderCtx = null;
  render();
}

// Search / Sort / Filter hooks (placeholders)
function setFilter(f) { currentFilter = f; render(); }

// Viewer
function openViewer(file) {
  const viewer = document.getElementById("viewer");
  const content = document.getElementById("viewer-content");
  if (file.type === "photo") {
    content.innerHTML = `<img src="${file.url}" alt="${file.name}">`;
  } else {
    content.innerHTML = `<video src="${file.url}" controls autoplay></video>`;
  }
  viewer.style.display = "flex";
}
function closeViewer() {
  document.getElementById("viewer").style.display = "none";
  document.getElementById("viewer-content").innerHTML = "";
}

// Boot
document.addEventListener("DOMContentLoaded", () => {
  // Handle OAuth redirect (first login)
  PCLOUD_OAUTH.handleRedirectHash();

  const searchEl = document.getElementById("search");
  const sortEl = document.getElementById("sort");

  if (searchEl) {
    searchEl.addEventListener("input", e => {
      currentSearch = e.target.value;
      render();
    });
  }
  if (sortEl) {
    sortEl.addEventListener("change", e => {
      currentSort = e.target.value;
      render();
    });
  }

  render();
});
