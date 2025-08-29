
// pcloud-api.js
const pcloud = {
  base: "https://api.pcloud.com",

  async call(method, params = {}) {
    const token = PCLOUD_OAUTH.getToken();
    if (!token) throw new Error("Not authenticated with pCloud yet.");
    const qp = new URLSearchParams({ access_token: token, ...params });
    const url = `${this.base}/${method}?${qp.toString()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (typeof data.result !== "undefined" && data.result !== 0) {
      throw new Error(`pCloud error ${data.result}: ${data.error || "Unknown"}`);
    }
    return data;
  },

  listFolder(folderid) { return this.call("listfolder", { folderid, recursive: 0 }); },
  getFileLink(fileid) { return this.call("getfilelink", { fileid }); }
};
