// pcloud-auth.js — iPad-friendly debug (no alert)

(function () {
  function box() { return document.getElementById('debug'); }
  function log(msg) {
    const el = box();
    const line = `[pcloud] ${new Date().toLocaleTimeString()} — ${msg}`;
    if (el) {
      el.style.display = 'block';
      el.textContent += (el.textContent ? '\n' : '') + line;
      el.scrollTop = el.scrollHeight;
    }
    try { console.log(line); } catch {}
  }

  window.PCLOUD_OAUTH = {
    clientId: "PVqQO9u7C1b",
    redirectUri: "https://aidamn81.github.io/cloudskin/",
    authBase: "https://my.pcloud.com/oauth2/authorize",
    tokenKey: "pcloud_access_token",

    login() {
      const params = new URLSearchParams({
        client_id: this.clientId,
        response_type: "token",
        redirect_uri: this.redirectUri
      });
      const url = `${this.authBase}?${params.toString()}`;
      log(`Redirecting to OAuth: ${url}`);
      window.location.href = url; // no alert; just go
    },

    handleRedirectHash() {
      if (!window.location.hash) return null;
      const h = new URLSearchParams(window.location.hash.substring(1));
      log(`Returned hash params: ${JSON.stringify(Object.fromEntries(h.entries()))}`);
      const token = h.get("access_token");
      if (token) {
        localStorage.setItem(this.tokenKey, token);
        log(`Access token saved (first 10): ${token.slice(0,10)}…`);
        history.replaceState({}, document.title, window.location.pathname + window.location.search);
        return token;
      } else {
        log("No access_token present in hash.");
      }
      return null;
    },

    getToken() {
      const t = localStorage.getItem(this.tokenKey);
      log("getToken() → " + (t ? t.slice(0,10) + "…" : "null"));
      return t;
    },

    logout() {
      try { localStorage.removeItem(this.tokenKey); } catch {}
      log("Token cleared.");
    }
  };
})();
