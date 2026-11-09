(async function () {
  const form = document.getElementById("googleProfileForm");
  const errorBox = document.getElementById("profileError");
  const submitButton = form.querySelector('button[type="submit"]');

  if (!HospitalApi.hasToken()) {
    window.location.replace("login.html");
    return;
  }

  try {
    const { data } = await HospitalApi.get("/auth/me");
    if (data.user.role !== "patient") {
      window.location.replace(data.user.role === "receptionist" ? "appointments.html" : "dashboard.html");
      return;
    }
    if (data.user.profileId) {
      window.location.replace("patient.html");
      return;
    }
    document.getElementById("googleFullName").value = data.user.displayName || "";
  } catch (error) {
    errorBox.textContent = `Unable to load your Google account: ${error.message}`;
    errorBox.classList.remove("d-none");
    submitButton.disabled = true;
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorBox.classList.add("d-none");
    submitButton.disabled = true;
    try {
      await HospitalApi.post("/auth/google/complete-profile", Object.fromEntries(new FormData(form).entries()));
      window.location.replace("patient.html");
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.classList.remove("d-none");
      submitButton.disabled = false;
    }
  });

  document.getElementById("googleProfileSignOut").addEventListener("click", async (event) => {
    event.preventDefault();
    try {
      await HospitalApi.post("/auth/logout", {});
      HospitalApi.clearToken();
      window.location.replace("login.html");
    } catch (error) {
      errorBox.textContent = `Could not cancel sign-up: ${error.message}`;
      errorBox.classList.remove("d-none");
    }
  });
})();
