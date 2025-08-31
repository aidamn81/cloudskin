// === Aiden's Cloud — App.js (robust Connect flow) ===

const DEFAULT_COVER = "assets/foldercover.png";
const LS_LINKED = "pcloud_linked_folders";

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

// Minimal demo tile
const localData = { folders: [ { id:"holiday", name:"Holiday", cover: DEFAULT_COVER, files: [] } ] };

// Build the exact OAuth URL we need
function buildOAuthUrl() {
  const params = new URLSearchParams({
    client_id: PCLOUD_OAUTH.clientId,
    response_type: "token",
    redirect_uri: PCLOUD_OAUTH.redirectUri
  });
  const url = `${PCLOUD_OAUTH.authBase}?${params.toString()}`;
  // Log into the on-page debug box if present
  try {
    const el = document.getElementById("debug");
    if (el) {
      el.style.display = "block";
      el.textContent += (el.textContent ? "\n" : "") + `[app] OAuth URL: ${url}`;
      el.scrollTop = el.scrollHeight;
    }
  } catch {}
  return url;
}

// Soft probe; don't clear token on probe failure
async function tokenSeemsValid() {
  const t = PCLOUD_OAUTH.getToken();
  if (!t) return false;
  try {
    const res = await fetch(`https://api.pcloud.com/userinfo?access_token=${encodeURIComponent(t)}`);
    const data = await res.json();
    return data.result === 0;
  } catch { return true; }
}

async function renderHome() {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";

  const authBar = document.createElement("div");
  authBar.style.cssText = "width:100%;display:flex;flex-direction:column;align-items:center;gap:8px;margin-bottom:12px;";

  const ok = await tokenSeemsValid();

  if (!ok) {
    const oauthUrl = buildOAuthUrl();

    // 1) Real link button (best for iPad)
    const linkBtn = document.createElement("a");
    linkBtn.href = oauthUrl;
    linkBtn.textContent = "Connect pCloud";
    linkBtn.setAttribute("role", "button");
    linkBtn.style.cssText = "padding:8px 12px;border-radius:6px;background:rgba(255,255,255,0.18);color:#fff;text-decoration:none;display:inline-block;";

    // 2) JS fallback button
    const jsBtn = document.createElement("button");
    jsBtn.textContent = "Try again";
    jsBtn.onclick = () => { window.location.assign(oauthUrl); };

    // 3) Plain URL fallback
    const urlLine = document.createElement("div");
    urlLine.style.cssText = "font-size:12px;opacity:.85;text-align:center;max-width:92vw;word-break:break-all;";
    urlLine.innerHTML = `If it still doesn’t open, tap this link: <a href="${oauthUrl}" style="color:#fff;text-decoration:underline;">${oauthUrl}</a>`;

    // Force reconnect (clears any token then opens)
    const forceBtn = document.createElement("button");
    forceBtn.textContent = "Force reconnect to pCloud";
    forceBtn.onclick = () => { PCLOUD_OAUTH.logout(); window.location.replace(oauthUrl); };

    authBar.append(linkBtn, jsBtn, forceBtn, urlLine);
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

  // Demo tile
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

// ---- pCloud folder view (unchanged logic) ----
async function openPcloudFolder(folderid, name) {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";
  document.getElementById("breadcrumbs").innerHTML = `Home / ${name}`;

  let listing;
  try { listing = await pcloud.listFolder(folderid); }
  catch (e) {
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

  subfolders.forEach(f => {
    const d = document.createElement("div");
    d.className = "folder";
    d.innerHTML = `<img src="${DEFAULT_COVER}" class="folder-cover" alt=""><p class="folder-name">${f.name}</p>`;
    d.onclick = () => openPcloudFolder(f.folderid, f.name);
    grid.appendChild(d);
  });

  files.forEach(f => {
    const d = document.createElement("div");
    d.className = "file";
    const isImage = /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(f.name);
    d.innerHTML = `<img src="${isImage ? '' : 'https://picsum.photos/200'}" class="file-thumb" alt=""><p class="file-name">${f.name}</p>`;
    grid.appendChild(d);
  });
}

// ===== Folder Picker (unchanged) =====
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

document.addEventListener("DOMContentLoaded", ()=>{
  PCLOUD_OAUTH.handleRedirectHash();
  renderHome();
});
