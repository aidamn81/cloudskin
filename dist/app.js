// === Aiden's Cloud — App.js (Connect as real link) ===

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

// Minimal demo so the screen isn't empty
const localData = { folders: [ { id:"holiday", name:"Holiday", cover: DEFAULT_COVER, files: [] } ] };

// Soft token probe (don’t clear token here)
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
  authBar.style.cssText = "width:100%;display:flex;justify-content:center;gap:10px;margin-bottom:10px;";

  const ok = await tokenSeemsValid();

  if (!ok) {
    // Build the REAL OAuth URL and use an <a> so iPad always navigates.
    const params = new URLSearchParams({
      client_id: PCLOUD_OAUTH.clientId,
      response_type: "token",
      redirect_uri: PCLOUD_OAUTH.redirectUri
    });
    const oauthUrl = `${PCLOUD_OAUTH.authBase}?${params.toString()}`;

    const a = document.createElement("a");
    a.href = oauthUrl;
    a.textContent = "Connect pCloud";
    a.setAttribute("role", "button");
    a.style.cssText = "padding:6px 10px;border-radius:6px;background:rgba(255,255,255,0.18);color:#fff;text-decoration:none;display:inline-block;";
    // As a backup, also call login() if JS click runs:
    a.addEventListener("click", (e) => {
      // let the link work; but if something intercepts, we still force it:
      if (e.defaultPrevented) return;
      try { PCLOUD_OAUTH.login(); } catch {}
    });

    // Optional: text link fallback below
    const help = document.createElement("div");
    help.style.cssText = "font-size:12px;opacity:.8;text-align:center;";
    help.innerHTML = `If the button doesn’t open pCloud, <a href="${oauthUrl}" style="color:#fff;text-decoration:underline;">tap here</a>.`;

    authBar.appendChild(a);
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

// ----- pCloud folder view (unchanged) -----
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

// ===== Folder Picker (same as before) =====
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
