(function () {
  const forgotForm = document.getElementById("forgotPasswordForm");
  const resetForm = document.getElementById("resetPasswordForm");
  const errorBox = document.getElementById("resetError");

  if (forgotForm) {
    forgotForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      errorBox.classList.add("d-none");
      const notice = document.getElementById("resetNotice");
      notice.classList.add("d-none");
      const button = forgotForm.querySelector('button[type="submit"]');
      button.disabled = true;
      try {
        const { email, role } = Object.fromEntries(new FormData(forgotForm).entries());
        let message;
        if (["patient", "doctor"].includes(role)) {
          if (!window.MediCoreFirebaseAuth) throw new Error("Firebase authentication is unavailable. Refresh the page and try again.");
          await window.MediCoreFirebaseAuth.sendPasswordResetEmail(email.trim(), {
            url: `${window.location.origin}/login.html?reset=firebase`,
            handleCodeInApp: false
          });
          message = "If a matching account exists, Firebase has sent a password reset link to that email address.";
        } else {
          const result = await HospitalApi.post("/auth/forgot-password", { email });
          message = result.message;
        }
        notice.textContent = message;
        notice.className = "alert alert-success";
        forgotForm.classList.add("d-none");
      } catch (error) {
        errorBox.textContent = error.message;
        errorBox.classList.remove("d-none");
      } finally {
        button.disabled = false;
      }
    });
  }

  if (resetForm) {
    const token = new URLSearchParams(window.location.search).get("token") || "";
    if (!token) {
      errorBox.textContent = "This password reset link is invalid or has expired.";
      errorBox.classList.remove("d-none");
      resetForm.classList.add("d-none");
    }

    resetForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      errorBox.classList.add("d-none");
      const values = Object.fromEntries(new FormData(resetForm).entries());
      if (values.password !== values.confirmPassword) {
        errorBox.textContent = "Passwords do not match.";
        errorBox.classList.remove("d-none");
        return;
      }
      const button = resetForm.querySelector('button[type="submit"]');
      button.disabled = true;
      try {
        const result = await HospitalApi.post("/auth/reset-password", { token, password: values.password });
        window.location.replace(`login.html?reset=success&message=${encodeURIComponent(result.message)}`);
      } catch (error) {
        errorBox.textContent = error.message;
        errorBox.classList.remove("d-none");
      } finally {
        button.disabled = false;
      }
    });
  }
})();
