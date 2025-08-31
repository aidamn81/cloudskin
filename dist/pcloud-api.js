// pcloud-api.js — auto-detect API host (EU/US) and call robustly

const pcloud = (() => {
  let BASE = "https://api.pcloud.com";     // bootstrap endpoint
  let RESOLVED = null;                      // once we know the right host (e.g. https://eapi.pcloud.com)

  async function resolveBase() {
    if (RESOLVED) return RESOLVED;
    try {
      // Ask pCloud which API server to use for this account/region
      const url = `${BASE}/getapiserver`;
      const res = await fetch(url);
      const data = await res.json();
      // Docs return { apiserver: "eapi.pcloud.com" } or similar
      const host =
        data.apiserver ||
        data.api ||
        data.hostname ||
        (data.hosts && data.hosts[0]) ||
        null;

      if (host && typeof host === "string") {
        RESOLVED = /^https?:\/\//i.test(host) ? host : `https://${host}`;
      } else {
        RESOLVED = BASE; // fallback
      }
    } catch {
      RESOLVED = BASE; // if detection fails, keep default
    }
    return RESOLVED;
  }

  async function call(method, params = {}) {
    const token = PCLOUD_OAUTH.getToken();
    if (!token) throw new Error("Not authenticated with pCloud yet.");

    const base = await resolveBase();
    const qp = new URLSearchParams({ access_token: token, ...params });
    const url = `${base}/${method}?${qp.toString()}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // pCloud returns { result: 0 } on success, otherwise a numeric error (e.g., 2094)
    if (typeof data.result !== "undefined" && data.result !== 0) {
      const msg = data.error || "Unknown";
      const err = new Error(`pCloud error ${data.result}: ${msg}`);
      err.code = data.result;
      throw err;
    }
    return data;
  }

  // Convenience wrappers
  const api = {
    // Public: use these from app.js
    async listFolder(folderid) { return call("listfolder", { folderid, recursive: 0 }); },
    async getFileLink(fileid) { return call("getfilelink", { fileid }); },

    // Extra helper: confirm token without clearing it
    async validateToken() {
      const token = PCLOUD_OAUTH.getToken();
      if (!token) return false;
      const base = await resolveBase();
      const qp = new URLSearchParams({ access_token: token });
      const res = await fetch(`${base}/userinfo?${qp.toString()}`);
      const data = await res.json();
      return data && data.result === 0;
    }
  };

  return api;
})();
