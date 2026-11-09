(function () {
  const messages = {
    not_configured: "Google sign-in is not set up yet. An administrator must add the Google OAuth settings to backend/.env.",
    auth_not_configured: "Sign-in is not configured yet. An administrator must set AUTH_TOKEN_SECRET in backend/.env.",
    cancelled: "Google sign-in was cancelled.",
    state_mismatch: "Google sign-in could not be verified. Please try again.",
    account_conflict: "That Google email is already reserved for another account or pending doctor request. Sign in with your existing account or contact the hospital.",
    unverified: "Google could not verify this email address. Choose a verified Google account and try again.",
    failed: "Google sign-in could not be completed. Please try again."
  };
  const query = new URLSearchParams(window.location.search);
  const error = messages[query.get("google_error")];
  if (error) {
    const errorBox = document.getElementById("authError");
    if (errorBox) {
      errorBox.textContent = error;
      errorBox.classList.remove("d-none");
    }
    query.delete("google_error");
    const cleanSearch = query.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${cleanSearch ? `?${cleanSearch}` : ""}`);
  }

  const fragment = new URLSearchParams(window.location.hash.slice(1));
  const token = fragment.get("token");
  if (!token) return;
  HospitalApi.setToken(token);
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  if (/google-profile\.html$/.test(window.location.pathname)) return;

  (async () => {
    try {
      const { data } = await HospitalApi.get("/auth/me");
      const destination = data.user.role === "patient" ? "patient.html"
        : data.user.role === "receptionist" ? "appointments.html" : "dashboard.html";
      window.location.replace(destination);
    } catch (requestError) {
      HospitalApi.clearToken();
      const errorBox = document.getElementById("authError");
      if (errorBox) {
        errorBox.textContent = `Google sign-in succeeded, but the account could not be loaded: ${requestError.message}`;
        errorBox.classList.remove("d-none");
      }
    }
  })();
})();
