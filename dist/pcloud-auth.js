// pcloud-auth.js — OAuth (Implicit Flow) with DEBUG logs

const PCLOUD_OAUTH = {
  // ✅ Your app details (already filled in)
  clientId: "PVqQO9u7C1b",
  redirectUri: "https://aidamn81.github.io/cloudskin/",
  authBase: "https://my.pcloud.com/oauth2/authorize",
  tokenKey: "pcloud_access_token",

  /**
   * Start OAuth login by redirecting to pCloud
   * (DEBUG: logs the exact URL being used)
   */
  login() {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: "token", // REQUIRED for implicit flow
      redirect_uri: this.redirectUri
    });

    const url = `${this.authBase}?${params.toString()}`;
    // 🔎 DEBUG
    console.log("[pcloud-auth] Redirecting to:", url);

    window.location.href = url;
  },

  /**
   * Handle redirect and capture #access_token from the URL fragment.
   * (DEBUG: logs the returned hash params and whether token was saved)
   */
  handleRedirectHash() {
    if (!window.location.hash) return null;

    const hashString = window.location.hash.substring(1);
    const h = new URLSearchParams(hashString);

    // 🔎 DEBUG: show *all* returned params
    console.log("[pcloud-auth] Redirect hash params:", Object.fromEntries(h.entries()));

    const token = h.get("access_token");
    if (token) {
      // Save token
      localStorage.setItem(this.tokenKey, token);

      // 🔎 DEBUG: confirm saved (partial token for safety)
      console.log("[pcloud-auth] Access token saved:", token.slice(0, 10) + "…");

      // Clean the URL (remove the fragment) but keep current path
      history.replaceState({}, document.title, window.location.pathname + window.location.search);

      return token;
    } else {
      console.warn("[pcloud-auth] No access_token found in redirect hash.");
    }
    return null;
  },

  /** Get saved token (or null) */
  getToken() {
    const t = localStorage.getItem(this.tokenKey);
    // 🔎 DEBUG (comment out if noisy)
    console.log("[pcloud-auth] getToken() →", t ? (t.slice(0, 10) + "…") : null);
    return t;
  },

  /** Clear token */
  logout() {
    try { localStorage.removeItem(this.tokenKey); } catch {}
    console.log("[pcloud-auth] Token cleared.");
  }
};

/**
 * Optional: simple debug helpers you can call from the console:
 *   debugPcloud.showToken()
 *   debugPcloud.clearToken()
 *   debugPcloud.login()
 *   debugPcloud.validate()  // calls a harmless endpoint to check token validity
 */
window.debugPcloud = {
  showToken() {
    const t = PCLOUD_OAUTH.getToken();
    alert(t ? `Token (first 40 chars):\n${t.slice(0, 40)}…` : "No token saved");
  },
  clearToken() {
    PCLOUD_OAUTH.logout();
    alert("Token cleared. Reloading…");
    location.reload();
  },
  login() {
    PCLOUD_OAUTH.login();
  },
  async validate() {
    const t = PCLOUD_OAUTH.getToken();
    if (!t) { alert("No token saved."); return; }
    try {
      const res = await fetch(`https://api.pcloud.com/userinfo?access_token=${encodeURIComponent(t)}`);
      const data = await res.json();
      console.log("[pcloud-auth] /userinfo →", data);
      alert(data.result === 0 ? "Token looks valid ✅" : `Token invalid ❌ (result ${data.result})`);
    } catch (e) {
      console.error(e);
      alert("Validation failed (network or CORS). Check console.");
    }
  }
};
