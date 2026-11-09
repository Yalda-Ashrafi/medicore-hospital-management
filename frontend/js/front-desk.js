(async function () {
  if (!(await window.appReady)) return;
  const form = document.getElementById("walkInForm");
  const errorBox = document.getElementById("frontDeskError");
  const receiptPanel = document.getElementById("receiptPanel");
  const currencyInput = document.getElementById("currency");
  const today = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  };
  document.getElementById("visitDate").value = today();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorBox.classList.add("d-none");
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    try {
      const data = Object.fromEntries(new FormData(form).entries());
      const amount = Number(data.amountPaid);
      if (!Number.isFinite(amount) || !Number.isSafeInteger(Math.round(amount * 100)) || amount <= 0) {
        throw new Error("Enter a valid payment amount greater than zero.");
      }
      data.age = Number(data.age);
      data.amountMinor = Math.round(amount * 100);
      delete data.amountPaid;
      const result = await HospitalApi.post("/front-desk/walk-ins", data);
      const { patient, visit } = result.data;
      const formattedAmount = new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: visit.currency
      }).format(visit.amountMinor / 100);
      document.getElementById("receiptId").textContent = visit.receiptId;
      document.getElementById("receiptPatient").textContent = patient.fullName;
      document.getElementById("receiptPatientId").textContent = patient.patientId;
      document.getElementById("receiptDate").textContent = String(visit.visitDate).slice(0, 10);
      document.getElementById("receiptCondition").textContent = visit.condition;
      document.getElementById("receiptMethod").textContent = visit.paymentMethod;
      document.getElementById("receiptAmount").textContent = formattedAmount;
      form.reset();
      document.getElementById("visitDate").value = today();
      currencyInput.value = data.currency;
      receiptPanel.classList.remove("d-none");
      receiptPanel.scrollIntoView({ behavior: "smooth", block: "start" });
      window.showToast(result.message);
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.classList.remove("d-none");
    } finally {
      submitButton.disabled = false;
    }
  });

  document.getElementById("printReceipt").addEventListener("click", () => window.print());
  document.getElementById("newWalkIn").addEventListener("click", () => {
    receiptPanel.classList.add("d-none");
    form.reset();
    document.getElementById("visitDate").value = today();
    currencyInput.value = "MYR";
    document.getElementById("walkInName").focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
})();
