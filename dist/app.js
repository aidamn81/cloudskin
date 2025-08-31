// === Aiden's Cloud — App.js (with pre-defined pCloud folders) ===

const DEFAULT_COVER = "assets/foldercover.png";

// --- Hard-coded folders you gave me ---
const PRESET_FOLDERS = [
  { id: 18407348626, name: "Public", cover: DEFAULT_COVER },
  { id: 18397779235, name: "Gallery", cover: DEFAULT_COVER }
];

// ===== Home renderer =====
async function renderHome() {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";

  // Auth bar
  const authBar = document.createElement("div");
  authBar.style.cssText =
    "width:100%;display:flex;flex-direction:column;align-items:center;gap:8px;margin-bottom:14px;";

  const token = PCLOUD_OAUTH.getToken();
  if (!token) {
    const oauthUrl = buildOAuthUrl();

    // Big plain link (best for iPad)
    const linkBtn = document.createElement("a");
    linkBtn.href = oauthUrl;
    linkBtn.textContent = "🔑 Connect to pCloud";
    linkBtn.setAttribute("role", "button");
    linkBtn.style.cssText =
      "padding:12px 16px;border-radius:8px;background:#2a7fff;color:#fff;text-decoration:none;font-weight:bold;";
    authBar.appendChild(linkBtn);
  } else {
    const logoutBtn = document.createElement("button");
    logoutBtn.textContent = "Log out of pCloud";
    logoutBtn.onclick = () => {
      PCLOUD_OAUTH.logout();
      renderHome();
    };
    authBar.appendChild(logoutBtn);
  }

  grid.appendChild(authBar);

  // Show the permanent folders
  PRESET_FOLDERS.forEach(f => {
    const d = document.createElement("div");
    d.className = "folder";
    d.innerHTML = `<img src="${f.cover}" class="folder-cover" alt=""><p class="folder-name">${f.name}</p>`;
    d.onclick = () => openPcloudFolder(f.id, f.name);
    grid.appendChild(d);
  });

  document.getElementById("breadcrumbs").innerHTML = "Home";
}

// ===== Helpers =====
function buildOAuthUrl() {
  const params = new URLSearchParams({
    client_id: PCLOUD_OAUTH.clientId,
    response_type: "token",
    redirect_uri: PCLOUD_OAUTH.redirectUri
  });
  return `${PCLOUD_OAUTH.authBase}?${params.toString()}`;
}

// ===== Folder view =====
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
      grid.innerHTML =
        `<p style="color:#fff">Session expired or invalid token. Tap “Connect to pCloud”.</p>`;
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
    d.innerHTML =
      `<img src="${DEFAULT_COVER}" class="folder-cover" alt=""><p class="folder-name">${f.name}</p>`;
    d.onclick = () => openPcloudFolder(f.folderid, f.name);
    grid.appendChild(d);
  });

  files.forEach(f => {
    const d = document.createElement("div");
    d.className = "file";
    const isImage = /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(f.name);
    d.innerHTML =
      `<img src="${isImage ? '' : 'https://picsum.photos/200'}" class="file-thumb" alt=""><p class="file-name">${f.name}</p>`;
    grid.appendChild(d);
  });
}

// ===== Boot =====
document.addEventListener("DOMContentLoaded", () => {
  PCLOUD_OAUTH.handleRedirectHash(); // save token if returning from OAuth
  renderHome();
});
