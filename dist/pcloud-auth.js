// pcloud-auth.js — Minimal OAuth (Implicit Flow)
const PCLOUD_OAUTH = {
  clientId: "PVqQO9u7C1b", // your pCloud App Client ID
  redirectUri: "https://aidamn81.github.io/cloudskin/", // must match your app settings
  authBase: "https://my.pcloud.com/oauth2/authorize",
  tokenKey: "pcloud_access_token",

  // Start OAuth login
  login() {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: "token",
      redirect_uri: this.redirectUri
    });
    window.location.href = `${this.authBase}?${params.toString()}`;
  },

  // Capture access_token from redirect URL
  handleRedirectHash() {
    if (!window.location.hash) return null;
    const h = new URLSearchParams(window.location.hash.substring(1));
    const token = h.get("access_token");
    if (token) {
      localStorage.setItem(this.tokenKey, token);
      // clean up URL so token isn’t visible
      history.replaceState({}, document.title, this.redirectUri);
      return token;
    }
    return null;
  },

  // Get token from localStorage
  getToken() {
    return localStorage.getItem(this.tokenKey);
  },

  // Clear token
  logout() {
    localStorage.removeItem(this.tokenKey);
  }
};
