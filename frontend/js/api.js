(function () {
  const isLocalPreview = window.location.protocol === "file:" ||
    ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const API_BASE = window.HOSPITAL_API_BASE ||
    (isLocalPreview ? "http://localhost:5000/api" : "/api");
  const TOKEN_KEY = "medicoreAuthToken";
  const handoff = new URLSearchParams(window.location.hash.slice(1));
  const handoffToken = handoff.get("token");
  if (handoffToken) {
    sessionStorage.setItem(TOKEN_KEY, handoffToken);
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }

  async function request(path, options) {
    let response;
    try {
      response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(sessionStorage.getItem(TOKEN_KEY) ? { Authorization: `Bearer ${sessionStorage.getItem(TOKEN_KEY)}` } : {}),
          ...(options && options.headers)
        }
      });
    } catch (error) {
      if (error instanceof TypeError) {
        const guidance = window.location.protocol === "file:" ||
          ["localhost", "127.0.0.1"].includes(window.location.hostname)
          ? `This page is opened as a local file preview. From the project root run "npm run setup" once, configure backend/.env with your Atlas URI, start the app with "npm run dev", then open http://localhost:5000.`
          : `The deployed API is unavailable at ${API_BASE}. Check that the web service is running and that /api/health reports "database":"connected".`;
        throw new Error(
          `Cannot reach the API at ${API_BASE}. ${guidance}`
        );
      }
      throw error;
    }
    const result = await response.json().catch(() => ({}));
    if (response.status === 401 && !path.startsWith("/auth/login") && !path.startsWith("/auth/register")) {
      sessionStorage.removeItem(TOKEN_KEY);
      if (!/login\.html$/.test(window.location.pathname)) window.location.replace("login.html");
    }
    if (!response.ok) throw new Error(result.message || `Request failed (${response.status})`);
    if (result.notificationWarning) {
      if (typeof window.showToast === "function") window.showToast(result.notificationWarning, true);
      else console.error(result.notificationWarning);
    }
    return result;
  }

  window.HospitalApi = {
    get: (path) => request(path),
    post: (path, data) => request(path, { method: "POST", body: JSON.stringify(data) }),
    patch: (path, data) => request(path, { method: "PATCH", body: JSON.stringify(data) }),
    put: (path, data) => request(path, { method: "PUT", body: JSON.stringify(data) }),
    delete: (path) => request(path, { method: "DELETE" }),
    setToken: (token) => sessionStorage.setItem(TOKEN_KEY, token),
    clearToken: () => sessionStorage.removeItem(TOKEN_KEY),
    hasToken: () => Boolean(sessionStorage.getItem(TOKEN_KEY))
  };
})();
