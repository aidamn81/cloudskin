
// pcloud-auth.js — set your real Client ID
const PCLOUD_OAUTH = {
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
    window.location.href = `${this.authBase}?${params.toString()}`;
  },

  handleRedirectHash() {
    if (!window.location.hash) return null;
    const h = new URLSearchParams(window.location.hash.substring(1));
    const token = h.get("access_token");
    if (token) {
      localStorage.setItem(this.tokenKey, token);
      history.replaceState({}, document.title, window.location.pathname + window.location.search);
      return token;
    }
    return null;
  },

  getToken() { return localStorage.getItem(this.tokenKey); },
  logout() { localStorage.removeItem(this.tokenKey); }
};
