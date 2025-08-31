// === Aiden's Cloud — App.js (Folder Picker UI) ===

const DEFAULT_COVER = "assets/foldercover.png";
const LS_LINKED = "pcloud_linked_folders";

// --- Linked folders storage ---
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

// --- Minimal local demo so the page never looks empty ---
const localData = {
  folders: [
    { id: "holiday", name: "Holiday", cover: DEFAULT_COVER, files: [] }
  ]
};

// --- Soft token check (don’t clear here; real calls will decide) ---
async function tokenSeemsValid() {
  const t = PCLOUD_OAUTH.getToken();
  if (!t) return false;
  try {
    const res = await fetch(`https://api.pcloud.com/userinfo?access_token=${encodeURIComponent(t)}`);
    const data = await res.json();
    return data.result === 0;
  } catch {
    // If network/CORS blocks this probe, just allow and let API calls decide
    return true;
  }
}

// --- Render HOME ---
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
    addBtn.textContent = "Add pCloud folder";
    addBtn.onclick = () => openPicker(); // ← new UI picker
    const logoutBtn = document.createElement("button");
    logoutBtn.textContent = "Log out of pCloud";
    logoutBtn.onclick = () => { PCLOUD_OAUTH.logout(); renderHome(); };
    authBar.append(addBtn, logoutBtn);
  }
  grid.appendChild(authBar);

  // Local demo tile
  localData.folders.forEach(f => {
    const d = document.createElement("div");
    d.className = "folder";
    d.innerHTML = `<img src="${f.cover}" class="folder-cover" alt=""><p class="folder-name">${f.name}</p>`;
    grid.appendChild(d);
  });

  // Linked pCloud tiles
  loadLinkedFolders().forEach(f => {
    const d = document.createElement("div");
    d.className = "folder";
    d.innerHTML = `<img src="${f.cover || DEFAULT_COVER}" class="folder-cover" alt=""><p class="folder-name">${f.name}</p>`;
    d.onclick = () => openPcloudFolder(f.id, f.name);
    grid.appendChild(d);
  });

  document.getElementById("breadcrumbs").innerHTML = "Home";
}

// --- Open a pCloud folder view ---
async function openPcloudFolder(folderid, name) {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";
  document.getElementById("breadcrumbs").innerHTML = `Home / ${name}`;

  let listing;
  try {
    listing = await pcloud.listFolder(folderid);
  } catch (e) {
    const msg = String(e.message || "");
    if (msg.includes("2094") || msg.toLowerCase().includes("invalid 'access_token'")) {
      PCLOUD_OAUTH.logout();
      grid.innerHTML = `<p style="color:#fff">Session expired or invalid token. Tap “Connect pCloud”.</p>`;
      await renderHome();
      return;
    } else {
      grid.innerHTML = `<p style="color:#fff">Error: ${msg}</p>`;
      return;
    }
  }

  const items = listing.metadata?.contents || [];
  const subfolders = items.filter(x => x.isfolder);
  const files = items.filter(x => x.isfile);

  // Subfolders
  subfolders.forEach(f => {
    const d = document.createElement("div");
    d.className = "folder";
    d.innerHTML = `<img src="${DEFAULT_COVER}" class="folder-cover" alt=""><p class="folder-name">${f.name}</p>`;
    d.onclick = () => openPcloudFolder(f.folderid, f.name);
    grid.appendChild(d);
  });

  // Files (simple thumbs)
  files.forEach(f => {
    const d = document.createElement("div");
    d.className = "file";
    const isImage = /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(f.name);
    d.innerHTML = `<img src="${isImage ? '' : 'https://picsum.photos/200'}" class="file-thumb" alt=""><p class="file-name">${f.name}</p>`;
    grid.appendChild(d);
  });
}

// =====================
// Folder Picker (UI)
// =====================
let pickerStack = [];     // [{id, name}]
let pickerSelection = null;

function openPicker() {
  pickerStack = [{ id: 0, name: "/" }];  // start at root
  pickerSelection = null;
  const modal = document.getElementById("picker");
  modal.setAttribute("aria-hidden", "false");
  document.getElementById("picker-use").disabled = true;
  loadPickerLevel(0);
}

function closePicker() {
  const modal = document.getElementById("picker");
  modal.setAttribute("aria-hidden", "true");
  pickerStack = [];
  pickerSelection = null;
}

async function loadPickerLevel(folderid) {
  // Build breadcrumbs
  const bcHtml = pickerStack
    .map((n, i) => `<span class="crumb" data-i="${i}">${n.name}</span>`)
    .join(" / ");
  const bcEl = document.getElementById("picker-breadcrumbs");
  bcEl.innerHTML = bcHtml;
  bcEl.querySelectorAll(".crumb").forEach(el => {
    el.onclick = () => {
      const i = Number(el.dataset.i);
      pickerStack = pickerStack.slice(0, i + 1);
      loadPickerLevel(pickerStack[pickerStack.length - 1].id);
    };
  });

  // Load current folder
  const listEl = document.getElementById("picker-list");
  listEl.innerHTML = `<p>Loading…</p>`;

  let listing;
  try {
    listing = await pcloud.listFolder(folderid);
  } catch (e) {
    listEl.innerHTML = `<p style="color:#fff">Error: ${e.message}</p>`;
    return;
  }

  const folders = (listing.metadata?.contents || []).filter(x => x.isfolder);
  listEl.innerHTML = folders.length ? "" : `<p>No subfolders.</p>`;

  folders.forEach(f => {
    const row = document.createElement("div");
    row.className = "picker-row";
    row.innerHTML = `
      <div>${f.name}</div>
      <div>
        <button data-open="${f.folderid}">Open</button>
        <button data-select="${f.folderid}">Select</button>
      </div>
    `;
    listEl.appendChild(row);
  });

  // Wire buttons
  listEl.querySelectorAll("button[data-open]").forEach(b => {
    b.onclick = () => {
      const id = Number(b.getAttribute("data-open"));
      const name = b.closest(".picker-row").firstElementChild.textContent.trim();
      pickerStack.push({ id, name });
      loadPickerLevel(id);
    };
  });
  listEl.querySelectorAll("button[data-select]").forEach(b => {
    b.onclick = () => {
      pickerSelection = {
        id: Number(b.getAttribute("data-select")),
        name: b.closest(".picker-row").firstElementChild.textContent.trim()
      };
      document.getElementById("picker-use").disabled = false;
    };
  });

  // “Use this folder” = selected or current level
  document.getElementById("picker-use").onclick = () => {
    const chosen = pickerSelection || pickerStack[pickerStack.length - 1];
    addLinkedFolder(chosen.id, chosen.name, DEFAULT_COVER);
    closePicker();
    renderHome();
  };
}

// --- Boot ---
document.addEventListener("DOMContentLoaded", () => {
  PCLOUD_OAUTH.handleRedirectHash(); // save token if returning from OAuth
  renderHome();
});
