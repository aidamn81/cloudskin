// === Aiden's Cloud — App.js (presets + careful token handling) ===

const DEFAULT_COVER = "assets/foldercover.png";

// Your permanent pCloud tiles
const PRESET_FOLDERS = [
  { id: 18407348626, name: "Public",  cover: DEFAULT_COVER },
  { id: 18397779235, name: "Gallery", cover: DEFAULT_COVER }
];

// Build OAuth URL (plain link works best on iPad)
function buildOAuthUrl() {
  const params = new URLSearchParams({
    client_id: PCLOUD_OAUTH.clientId,
    response_type: "token",
    redirect_uri: PCLOUD_OAUTH.redirectUri
  });
  return `${PCLOUD_OAUTH.authBase}?${params.toString()}`;
}

// Ensure login; if not logged in, navigate to OAuth
function ensureAuthOrLogin() {
  const t = PCLOUD_OAUTH.getToken();
  if (t) return true;
  window.location.replace(buildOAuthUrl());
  return false;
}

// ===== Home =====
async function renderHome() {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";

  const bar = document.createElement("div");
  bar.style.cssText = "width:100%;display:flex;flex-direction:column;align-items:center;gap:8px;margin-bottom:14px;";

  const token = PCLOUD_OAUTH.getToken();
  if (!token) {
    const oauthUrl = buildOAuthUrl();
    const linkBtn = document.createElement("a");
    linkBtn.href = oauthUrl;
    linkBtn.textContent = "🔑 Connect to pCloud";
    linkBtn.setAttribute("role", "button");
    linkBtn.style.cssText = "padding:12px 16px;border-radius:8px;background:#2a7fff;color:#fff;text-decoration:none;font-weight:bold;";
    bar.appendChild(linkBtn);

    const hint = document.createElement("div");
    hint.style.cssText = "font-size:12px;opacity:.85;text-align:center;max-width:92vw;word-break:break-all;";
    hint.innerHTML = `If it doesn’t open, long-press and choose <b>Open in New Tab</b>.<br><a href="${oauthUrl}" style="color:#fff;text-decoration:underline;">Direct link</a>`;
    bar.appendChild(hint);
  } else {
    const logout = document.createElement("button");
    logout.textContent = "Log out of pCloud";
    logout.onclick = () => { PCLOUD_OAUTH.logout(); renderHome(); };
    bar.appendChild(logout);
  }
  grid.appendChild(bar);

  // Preset tiles (tap will auto-login if needed)
  PRESET_FOLDERS.forEach(f => {
    const d = document.createElement("div");
    d.className = "folder";
    d.innerHTML = `<img src="${f.cover}" class="folder-cover" alt=""><p class="folder-name">${f.name}</p>`;
    d.onclick = () => openPcloudFolderOrLogin(f.id, f.name);
    grid.appendChild(d);
  });

  document.getElementById("breadcrumbs").innerHTML = "Home";
}

// Open with auth guard
function openPcloudFolderOrLogin(folderid, name) {
  if (!ensureAuthOrLogin()) return; // will redirect to OAuth
  openPcloudFolder(folderid, name);
}

// ===== Folder view =====
async function openPcloudFolder(folderid, name) {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";
  document.getElementById("breadcrumbs").innerHTML = `Home / ${name}`;

  try {
    const listing = await pcloud.listFolder(folderid);
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

  } catch (e) {
    const msg = String(e.message || "");
    // If we *think* the token is bad, double-check before clearing it
    if (msg.includes("2094") || msg.toLowerCase().includes("invalid 'access_token'")) {
      const stillValid = await pcloud.validateToken().catch(()=>false);
      if (!stillValid) {
        PCLOUD_OAUTH.logout();
        grid.innerHTML = `<p style="color:#fff">Session expired or invalid token. Tap “Connect to pCloud”.</p>`;
        await renderHome();
        return;
      }
      // Token is valid → show error instead of logging out
      grid.innerHTML = `<p style="color:#fff">Temporary error from pCloud. Please try again.</p>`;
      return;
    }

    grid.innerHTML = `<p style="color:#fff">Error: ${msg}</p>`;
    return;
  }
}

// ===== Boot =====
document.addEventListener("DOMContentLoaded", () => {
  // Save token if returning from OAuth
  PCLOUD_OAUTH.handleRedirectHash();
  renderHome();
});
