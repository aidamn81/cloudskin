// === Aiden's Cloud — App.js (auto-show pCloud root on Home) ===

const DEFAULT_COVER = "assets/foldercover.png";
const LS_LINKED = "pcloud_linked_folders";

// ----- Linked folders storage -----
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

// ----- Minimal local demo so the page never looks empty -----
const localData = { folders: [ { id:"holiday", name:"Holiday", cover: DEFAULT_COVER, files: [] } ] };

// Build OAuth URL (used for plain links too)
function buildOAuthUrl() {
  const params = new URLSearchParams({
    client_id: PCLOUD_OAUTH.clientId,
    response_type: "token",
    redirect_uri: PCLOUD_OAUTH.redirectUri
  });
  return `${PCLOUD_OAUTH.authBase}?${params.toString()}`;
}

// Soft probe (don’t clear token here)
async function tokenSeemsValid() {
  const t = PCLOUD_OAUTH.getToken();
  if (!t) return false;
  try {
    const res = await fetch(`https://api.pcloud.com/userinfo?access_token=${encodeURIComponent(t)}`);
    const data = await res.json();
    return data.result === 0;
  } catch {
    // Network/CORS? allow UI; real API calls will tell us if token truly fails.
    return true;
  }
}

// ===== Home renderer =====
async function renderHome() {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";

  // Auth bar
  const authBar = document.createElement("div");
  authBar.style.cssText = "width:100%;display:flex;flex-direction:column;align-items:center;gap:8px;margin-bottom:14px;";

  const ok = await tokenSeemsValid();
  if (!ok) {
    const oauthUrl = buildOAuthUrl();

    // Big plain link (best for iPad)
    const linkBtn = document.createElement("a");
    linkBtn.href = oauthUrl;
    linkBtn.textContent = "🔑 Connect to pCloud";
    linkBtn.setAttribute("role", "button");
    linkBtn.style.cssText = "padding:12px 16px;border-radius:8px;background:#2a7fff;color:#fff;text-decoration:none;font-weight:bold;";
    authBar.appendChild(linkBtn);

    // Tiny fallback text link
    const help = document.createElement("div");
    help.style.cssText = "font-size:12px;opacity:.85;text-align:center;max-width:92vw;word-break:break-all;";
    help.innerHTML = `If it doesn’t open, long-press and choose <b>Open in New Tab</b>.<br><a href="${oauthUrl}" style="color:#fff;text-decoration:underline;">Direct link</a>`;
    authBar.appendChild(help);
  } else {
    const addBtn = document.createElement("button");
    addBtn.textContent = "Add pCloud folder";
    addBtn.onclick = () => openPicker();

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

  // Auto-show pCloud ROOT folders (if logged in)
  if (ok) {
    await renderRootFoldersSection(grid);
  }

  // Your pinned/linked folders (permanent tiles you chose)
  const linked = loadLinkedFolders();
  linked.forEach(f => {
    const d = document.createElement("div");
    d.className = "folder";
    d.innerHTML = `<img src="${f.cover || DEFAULT_COVER}" class="folder-cover" alt=""><p class="folder-name">${f.name}</p>`;
    d.onclick = () => openPcloudFolder(f.id, f.name);
    grid.appendChild(d);
  });

  document.getElementById("breadcrumbs").innerHTML = "Home";
}

// Renders a section for pCloud root folders
async function renderRootFoldersSection(container) {
  // Title
  const title = document.createElement("div");
  title.style.cssText = "width:100%;text-align:center;font-weight:bold;opacity:.9;margin:6px 0;";
  title.textContent = "Your pCloud (root)";
  container.appendChild(title);

  // Load root listing
  let listing;
  try {
    listing = await pcloud.listFolder(0); // root = 0
  } catch (e) {
    const msg = String(e.message || "");
    if (msg.includes("2094") || msg.toLowerCase().includes("invalid 'access_token'")) {
      PCLOUD_OAUTH.logout();
      const p = document.createElement("p");
      p.style.cssText = "width:100%;text-align:center;";
      p.textContent = "Session expired. Tap “Connect to pCloud”.";
      container.appendChild(p);
      return;
    }
    const p = document.createElement("p");
    p.style.cssText = "width:100%;text-align:center;";
    p.textContent = `Error loading root: ${msg}`;
    container.appendChild(p);
    return;
  }

  const contents = listing.metadata?.contents || [];
  const subfolders = contents.filter(x => x.isfolder);

  if (subfolders.length === 0) {
    const p = document.createElement("p");
    p.style.cssText = "width:100%;text-align:center;opacity:.9;";
    p.textContent = "No folders in root.";
    container.appendChild(p);
    return;
  }

  subfolders.forEach(f => {
    const d = document.createElement("div");
    d.className = "folder";
    d.innerHTML = `<img src="${DEFAULT_COVER}" class="folder-cover" alt=""><p class="folder-name">${f.name}</p>`;
    d.onclick = () => openPcloudFolder(f.folderid, f.name);
    container.appendChild(d);
  });
}

// ===== pCloud folder view =====
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
      grid.innerHTML = `<p style="color:#fff">Session expired or invalid token. Tap “Connect to pCloud”.</p>`;
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

  subfolders.forEach(f => {
    const d = document.createElement("div");
    d.className = "folder";
    d.innerHTML = `<img src="${DEFAULT_COVER}" class="folder-cover" alt=""><p class="folder-name">${f.name}</p>`;
    d.onclick = () => openPcloudFolder(f.folderid, f.name);
    grid.appendChild(d);
  });

  // Files — basic thumbs
  files.forEach(f => {
    const d = document.createElement("div");
    d.className = "file";
    const isImage = /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(f.name);
    d.innerHTML = `<img src="${isImage ? '' : 'https://picsum.photos/200'}" class="file-thumb" alt=""><p class="file-name">${f.name}</p>`;
    grid.appendChild(d);
  });
}

// ===== Folder Picker (kept, for pinning tiles) =====
let pickerStack = [];
let pickerSelection = null;

function openPicker() {
  pickerStack = [{ id: 0, name: "/" }];
  pickerSelection = null;
  const modal = document.getElementById("picker");
  modal.setAttribute("aria-hidden", "false");
  document.getElementById("picker-use").disabled = true;
  loadPickerLevel(0);
}
function closePicker() {
  document.getElementById("picker").setAttribute("aria-hidden", "true");
  pickerStack = []; pickerSelection = null;
}
async function loadPickerLevel(folderid) {
  const bcEl = document.getElementById("picker-breadcrumbs");
  bcEl.innerHTML = pickerStack.map((n,i)=>`<span class="crumb" data-i="${i}">${n.name}</span>`).join(" / ");
  bcEl.querySelectorAll(".crumb").forEach(el=>{
    el.onclick = ()=>{ const i=+el.dataset.i; pickerStack=pickerStack.slice(0,i+1); loadPickerLevel(pickerStack[pickerStack.length-1].id); };
  });

  const listEl = document.getElementById("picker-list");
  listEl.innerHTML = `<p>Loading…</p>`;
  let listing;
  try { listing = await pcloud.listFolder(folderid); }
  catch (e) { listEl.innerHTML = `<p style="color:#fff">Error: ${e.message}</p>`; return; }

  const folders = (listing.metadata?.contents || []).filter(x=>x.isfolder);
  listEl.innerHTML = folders.length ? "" : "<p>No subfolders.</p>";

  folders.forEach(f=>{
    const row = document.createElement("div");
    row.className = "picker-row";
    row.innerHTML = `
      <div>${f.name}</div>
      <div>
        <button data-open="${f.folderid}">Open</button>
        <button data-select="${f.folderid}">Select</button>
      </div>`;
    listEl.appendChild(row);
  });

  listEl.querySelectorAll("button[data-open]").forEach(b=>{
    b.onclick = ()=>{
      const id = +b.getAttribute("data-open");
      const name = b.closest(".picker-row").firstElementChild.textContent.trim();
      pickerStack.push({ id, name });
      loadPickerLevel(id);
    };
  });
  listEl.querySelectorAll("button[data-select]").forEach(b=>{
    b.onclick = ()=>{
      pickerSelection = {
        id: +b.getAttribute("data-select"),
        name: b.closest(".picker-row").firstElementChild.textContent.trim()
      };
      document.getElementById("picker-use").disabled = false;
    };
  });

  document.getElementById("picker-use").onclick = ()=>{
    const chosen = pickerSelection || pickerStack[pickerStack.length-1];
    addLinkedFolder(chosen.id, chosen.name, DEFAULT_COVER);
    closePicker(); renderHome();
  };
}

// ===== Boot =====
document.addEventListener("DOMContentLoaded", ()=>{
  PCLOUD_OAUTH.handleRedirectHash(); // save token if returning from OAuth
  renderHome();
});
