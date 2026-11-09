(function () {
  const form = document.getElementById("contactForm");
  const errorBox = document.getElementById("contactError");
  const successBox = document.getElementById("contactSuccess");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorBox.classList.add("d-none");
    successBox.classList.add("d-none");
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const response = await fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" }
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.errors ? result.errors.map((item) => item.message).join(" ") : "Unable to send your message. Please try again later.");
      }
      successBox.textContent = "Your message has been sent. Thank you for contacting MediCore.";
      successBox.classList.remove("d-none");
      form.reset();
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.classList.remove("d-none");
    } finally {
      button.disabled = false;
    }
  });
})();
