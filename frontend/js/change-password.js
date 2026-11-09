(async function () {
  const form = document.getElementById("passwordForm");
  const errorBox = document.getElementById("passwordError");
  let destination = "dashboard.html";
  try {
    const result = await HospitalApi.get("/auth/me");
    if (result.data.user.role === "patient") destination = "patient.html";
    document.getElementById("returnLink").href = destination;
  } catch (error) {
    if (HospitalApi.hasToken()) errorBox.textContent = `Unable to load your account: ${error.message}`;
    errorBox.classList.remove("d-none");
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorBox.classList.add("d-none");
    const data = Object.fromEntries(new FormData(form).entries());
    if (data.newPassword !== data.confirmPassword) {
      errorBox.textContent = "New passwords do not match.";
      errorBox.classList.remove("d-none");
      return;
    }
    delete data.confirmPassword;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const result = await HospitalApi.post("/auth/change-password", data);
      HospitalApi.setToken(result.data.token);
      window.location.replace(destination);
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.classList.remove("d-none");
    } finally {
      button.disabled = false;
    }
  });
})();
