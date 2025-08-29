// pcloud-auth.js — iPad-friendly debug version

(function () {
  function getBox() { return document.getElementById('debug'); }
  function log(msg) {
    const box = getBox();
    const line = `[pcloud] ${new Date().toLocaleTimeString()} — ${msg}`;
    if (box) {
      box.style.display = 'block';
      box.textContent += (box.textContent ? '\n' : '') + line;
      box.scrollTop = box.scrollHeight;
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
      alert("Going to pCloud to log in… Tap OK.");
      window.location.href = url;
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
      } else { log("No access_token present in hash."); }
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

  window.debugPcloud = {
    show() { const t = PCLOUD_OAUTH.getToken(); alert(t ? t.slice(0,40)+"…" : "No token"); },
    clear() { PCLOUD_OAUTH.logout(); alert("Cleared. Reloading…"); location.reload(); },
    async validate() {
      const t = PCLOUD_OAUTH.getToken();
      if (!t) { alert("No token saved"); return; }
      try {
        const res = await fetch(`https://api.pcloud.com/userinfo?access_token=${encodeURIComponent(t)}`);
        const data = await res.json();
        log(`/userinfo → ${JSON.stringify(data)}`);
        alert(data.result === 0 ? "Token looks valid ✅" : `Token invalid ❌ (result ${data.result})`);
      } catch (e) { log("Validate failed: " + e); alert("Validation failed."); }
    }
  };
})();
