// pcloud-api.js — minimal wrapper
const pcloud = {
  base: "https://api.pcloud.com",

  async call(method, params = {}) {
    const token = PCLOUD_OAUTH.getToken();
    if (!token) throw new Error("Not authenticated with pCloud yet.");
    const qp = new URLSearchParams({ access_token: token, ...params });
    const res = await fetch(`${this.base}/${method}?${qp}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.result !== 0) throw new Error(`pCloud error ${data.result}: ${data.error || "Unknown"}`);
    return data;
  },

  listFolder(folderid) { return this.call("listfolder", { folderid }); },
  getFileLink(fileid) { return this.call("getfilelink", { fileid }); }
};
