(function () {
  const form = document.getElementById("authForm");
  const doctorForm = document.getElementById("doctorAuthForm");
  const errorBox = document.getElementById("authError");
  const patientRoleOption = document.getElementById("patientRoleOption");
  const doctorRoleOption = document.getElementById("doctorRoleOption");
  const roleOptions = document.getElementById("authRoleOptions");
  const registerChoices = document.getElementById("registerChoices");
  const accountHeading = document.getElementById("accountHeading");
  const accountDescription = document.getElementById("accountDescription");
  const doctorApplicationSubmitted = document.getElementById("doctorApplicationSubmitted");

  if (patientRoleOption && doctorRoleOption && doctorForm) {
    patientRoleOption.addEventListener("click", () => {
      patientRoleOption.setAttribute("aria-pressed", "true");
      doctorRoleOption.setAttribute("aria-pressed", "false");
      doctorForm.classList.add("d-none");
      registerChoices.classList.add("d-none");
      form.classList.remove("d-none");
      accountHeading.textContent = "Create your patient account";
      accountDescription.textContent = "Enter your details to get started.";
      errorBox.classList.add("d-none");
      document.getElementById("fullName").focus();
    });

    doctorRoleOption.addEventListener("click", () => {
      doctorRoleOption.setAttribute("aria-pressed", "true");
      patientRoleOption.setAttribute("aria-pressed", "false");
      form.classList.add("d-none");
      registerChoices.classList.add("d-none");
      doctorForm.classList.remove("d-none");
      accountHeading.textContent = "Submit doctor registration";
      accountDescription.textContent = "Your application will be reviewed by an administrator.";
      errorBox.classList.add("d-none");
      document.getElementById("doctorFullName").focus();
    });

    const showRoleOptions = () => {
      form.classList.add("d-none");
      doctorForm.classList.add("d-none");
      registerChoices.classList.remove("d-none");
      patientRoleOption.setAttribute("aria-pressed", "false");
      doctorRoleOption.setAttribute("aria-pressed", "false");
      accountHeading.textContent = "Select your account type";
      accountDescription.textContent = "Patients can register now. Doctor registrations are reviewed before access is enabled.";
      errorBox.classList.add("d-none");
    };
    document.getElementById("backToRoleOptionsPatient").addEventListener("click", showRoleOptions);
    document.getElementById("backToRoleOptionsDoctor").addEventListener("click", showRoleOptions);
  }

  const loginRole = new URLSearchParams(window.location.search).get("role");
  const loginRoleSelect = document.getElementById("loginRole");
  const loginNotice = document.getElementById("loginNotice");
  if (new URLSearchParams(window.location.search).get("reset") === "success" && loginNotice) {
    loginNotice.textContent = "Your password has been updated. Login with your new password.";
    loginNotice.classList.remove("d-none");
  }
  if (loginRoleSelect && ["patient", "doctor", "receptionist", "admin"].includes(loginRole)) loginRoleSelect.value = loginRole;

  async function submitRegistrationForm(event, activeForm) {
    event.preventDefault();
    errorBox.classList.add("d-none");
    const data = Object.fromEntries(new FormData(activeForm).entries());
    const mode = activeForm.dataset.mode;
    if (mode !== "login" && data.password !== data.confirmPassword) {
      errorBox.textContent = "Passwords do not match.";
      errorBox.classList.remove("d-none");
      return;
    }
    if (mode === "register") {
      data.age = Number(data.age);
    }
    delete data.confirmPassword;

    const submitButton = activeForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    let firebaseUser = null;
    try {
      const selectedRole = mode === "login" ? loginRoleSelect.value : mode === "register-doctor" ? "doctor" : "patient";
      const usesFirebase = ["patient", "doctor"].includes(selectedRole);
      if (usesFirebase) {
        if (!window.MediCoreFirebaseAuth) throw new Error("Firebase authentication is unavailable. Check your internet connection and refresh the page.");
        if (mode === "login") {
          const credential = await window.MediCoreFirebaseAuth.signInWithEmailAndPassword(data.email.trim(), data.password);
          firebaseUser = credential.user;
        } else {
          const credential = await window.MediCoreFirebaseAuth.createUserWithEmailAndPassword(data.email.trim(), data.password);
          firebaseUser = credential.user;
          await firebaseUser.sendEmailVerification().catch(() => {});
        }
        data.firebaseIdToken = await firebaseUser.getIdToken(true);
      }
      const endpoint = mode === "register-doctor" ? "/auth/register-doctor" : `/auth/${mode}`;
      const result = await HospitalApi.post(endpoint, data);
      if (mode === "register-doctor") {
        if (firebaseUser) await window.MediCoreFirebaseAuth.signOut();
        roleOptions.classList.add("d-none");
        doctorForm.classList.add("d-none");
        if (result.notificationWarning) {
          doctorApplicationSubmitted.querySelector("span").textContent += ` ${result.notificationWarning}`;
        }
        doctorApplicationSubmitted.classList.remove("d-none");
        return;
      }
      const expectedRole = mode === "login" ? loginRoleSelect.value : null;
      if (mode === "login" && expectedRole && result.data.user.role !== expectedRole) {
        if (firebaseUser) await window.MediCoreFirebaseAuth.signOut();
        errorBox.textContent = `This account is registered as ${result.data.user.role}, not ${expectedRole === "admin" ? "administrator" : expectedRole}. Choose the correct account type and try again.`;
        errorBox.classList.remove("d-none");
        return;
      }
      HospitalApi.setToken(result.data.token);
      if (firebaseUser) await window.MediCoreFirebaseAuth.signOut();
      const destination = result.data.user.role === "patient" ? "patient.html"
        : result.data.user.role === "receptionist" ? "appointments.html" : "dashboard.html";
      window.location.replace(destination);
    } catch (error) {
      if (firebaseUser && mode !== "login") await firebaseUser.delete().catch(() => {});
      errorBox.textContent = error.message;
      errorBox.classList.remove("d-none");
    } finally {
      submitButton.disabled = false;
    }
  }

  form.addEventListener("submit", (event) => submitRegistrationForm(event, form));
  if (doctorForm) doctorForm.addEventListener("submit", (event) => submitRegistrationForm(event, doctorForm));
})();
