(async function () {
  if (!(await window.appReady)) return;
  const page = document.body.dataset.page;
  const isAppointments = page === "appointments";
  const endpoint = `/${page}`;
  const tableBody = document.getElementById("tableBody");
  const applicationsSection = page === "doctors" ? document.getElementById("pendingDoctorApplications") : null;
  const applicationsBody = page === "doctors" ? document.getElementById("doctorApplicationsBody") : null;
  const applicationsSearch = page === "doctors" && window.currentUser.role === "admin" ? document.createElement("input") : null;
  const form = document.getElementById("recordForm");
  const formError = document.getElementById("formError");
  const modal = new bootstrap.Modal(document.getElementById("recordModal"));
  const doctorAccountModal = page === "doctors" ? new bootstrap.Modal(document.getElementById("doctorAccountModal")) : null;
  const doctorAccountForm = page === "doctors" ? document.getElementById("doctorAccountForm") : null;
  const receptionistAccountButton = isAppointments ? document.getElementById("addReceptionistButton") : null;
  const receptionistAccountForm = isAppointments ? document.getElementById("receptionistAccountForm") : null;
  const receptionistAccountModal = receptionistAccountForm ? new bootstrap.Modal(document.getElementById("receptionistAccountModal")) : null;
  const walkInPatientButton = isAppointments ? document.getElementById("walkInPatientButton") : null;
  const walkInPatientForm = isAppointments ? document.getElementById("walkInPatientForm") : null;
  const walkInPatientModal = walkInPatientForm ? new bootstrap.Modal(document.getElementById("walkInPatientModal")) : null;
  const patientAccountModal = page === "patients" ? new bootstrap.Modal(document.getElementById("patientAccountModal")) : null;
  const patientAccountForm = page === "patients" ? document.getElementById("patientAccountForm") : null;
  const search = document.getElementById("searchInput");
  let records = [];
  let editingId = null;
  let patients = [];
  let doctors = [];
  let doctorApplications = [];

  if (applicationsSearch) {
    applicationsSearch.type = "search";
    applicationsSearch.className = "search-input mb-3";
    applicationsSearch.placeholder = "Search requests by name, email, phone, or specialty…";
    applicationsSearch.setAttribute("aria-label", "Search doctor registration requests");
    applicationsSection.querySelector(".table-wrap").before(applicationsSearch);
    search.placeholder = "Search by name, doctor ID, specialty, phone, email, or room…";
    search.setAttribute("aria-label", "Search doctors by name, doctor ID, specialty, phone, email, or room");
  }

  const person = (name, subtitle) => `<div class="person-cell"><span class="person-avatar">${escapeHtml((name || "?").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase())}</span><span>${escapeHtml(name || "Unknown")}<small class="d-block text-secondary fw-normal">${escapeHtml(subtitle || "")}</small></span></div>`;
  const dateText = (date) => {
    if (!date) return "—";
    const [year, month, day] = String(date).slice(0, 10).split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  };

  function render() {
    const query = search.value.trim().toLowerCase();
    const status = isAppointments ? document.getElementById("statusFilter").value : "";
    const gender = page === "patients" ? document.getElementById("genderFilter").value : "";
    const specialization = page === "doctors" ? document.getElementById("specializationFilter").value : "";
    const visible = records.filter((row) => {
      const text = isAppointments
        ? [row.appointmentId, row.patient && row.patient.fullName, row.doctor && row.doctor.fullName, row.doctor && row.doctor.roomNumber, row.healthConcern, row.appointmentDate, row.appointmentTime, row.status].join(" ")
        : [row.fullName, row.patientId || row.doctorId, row.phone, row.email, row.disease, row.specialization, row.roomNumber, ...(row.healthConcerns || [])].join(" ");
      return text.toLowerCase().includes(query) &&
        (!status || row.status === status) &&
        (!gender || row.gender === gender) &&
        (!specialization || row.specialization === specialization);
    });
    document.getElementById("recordCount").textContent = `${visible.length} record${visible.length === 1 ? "" : "s"}`;
    if (!visible.length) {
      const columnCount = page === "doctors" ? 8 : 7;
      tableBody.innerHTML = `<tr><td class="empty-state" colspan="${columnCount}">${records.length ? "No records match your search." : `No ${page} have been added yet.`}</td></tr>`;
      return;
    }
    tableBody.innerHTML = visible.map((row) => {
      const viewAction = page === "patients" ? `<button class="btn btn-sm btn-light text-secondary" data-action="view" data-id="${row._id}" aria-label="View details"><i class="bi bi-eye"></i></button>` : "";
      const canEdit = ["admin", "receptionist"].includes(window.currentUser.role) ||
        isAppointments && window.currentUser.role === "doctor" && row.doctor && row.doctor._id === window.currentUser.profileId;
      const createAccountAction = ["doctors", "patients"].includes(page) && window.currentUser.role === "admin" && !row.hasAccount && (page !== "doctors" || !row.reviewStatus || row.reviewStatus === "approved")
        ? `<button class="btn btn-sm btn-light text-primary" data-action="create-account" data-id="${row._id}" aria-label="Create sign-in account"><i class="bi bi-person-plus"></i></button>` : "";
      const actions = `<div class="d-flex gap-1">${viewAction}${createAccountAction}${canEdit ? `<button class="btn btn-sm btn-light text-primary" data-action="edit" data-id="${row._id}" aria-label="Edit"><i class="bi bi-pencil"></i></button>` : ""}${window.currentUser.role === "admin" ? `<button class="btn btn-sm btn-light text-danger" data-action="delete" data-id="${row._id}" aria-label="Delete"><i class="bi bi-trash3"></i></button>` : ""}</div>`;
      if (isAppointments) {
        const statusClass = row.status.toLowerCase();
        const roomNumber = row.doctor && row.doctor.roomNumber;
        const roomCell = roomNumber && roomNumber !== "Unassigned" ? `Room ${escapeHtml(roomNumber)}` : "Room not assigned";
        const doctorLabel = row.doctor
          ? person(row.doctor.fullName, row.doctor.specialization)
          : person(row.needsDoctorAssignment ? "Needs doctor assignment" : "Not assigned", row.healthConcern || "Reception follow-up");
        return `<tr><td class="fw-semibold">${escapeHtml(row.appointmentId)}</td><td>${person(row.patient && row.patient.fullName, row.patient && row.patient.patientId)}</td><td>${doctorLabel}${row.healthConcern ? `<small class="d-block text-secondary mt-1">Condition: ${escapeHtml(row.healthConcern)}</small>` : ""}</td><td>${dateText(row.appointmentDate)}<small class="d-block text-secondary">${escapeHtml(row.appointmentTime)}</small></td><td><span class="status status-${statusClass}">${escapeHtml(row.status)}</span></td><td>${roomCell}</td><td>${actions}</td></tr>`;
      }
      if (page === "patients") {
        return `<tr><td>${person(row.fullName, row.address)}</td><td class="fw-semibold">${escapeHtml(row.patientId)}</td><td>${escapeHtml(row.age)} / ${escapeHtml(row.gender)}</td><td>${escapeHtml(row.phone)}</td><td>${escapeHtml(row.disease)}</td><td>${dateText(row.admissionDate)}</td><td>${actions}</td></tr>`;
      }
      const concerns = (row.healthConcerns || []).map(escapeHtml).join(", ");
      const doctorName = person(row.fullName, row.reviewStatus === "pending" ? "Pending review" : row.email);
      return `<tr><td>${doctorName}</td><td class="fw-semibold">${escapeHtml(row.doctorId)}</td><td>${escapeHtml(row.specialization)}${concerns ? `<small class="d-block text-secondary">Treats: ${concerns}</small>` : ""}</td><td>${row.roomNumber && row.roomNumber !== "Unassigned" ? `Room ${escapeHtml(row.roomNumber)}` : "Not assigned"}</td><td>${escapeHtml(row.phone)}</td><td>${escapeHtml(row.email)}</td><td>${escapeHtml(row.availability)}</td><td>${actions}</td></tr>`;
    }).join("");
  }

  function renderDoctorApplications() {
    const query = applicationsSearch.value.trim().toLowerCase();
    const visibleApplications = doctorApplications.filter((application) =>
      [application.fullName, application.email, application.phone, application.specialization, application.availability]
        .join(" ").toLowerCase().includes(query)
    );
    if (!visibleApplications.length) {
      applicationsBody.innerHTML = `<tr><td class="empty-state" colspan="6">${doctorApplications.length ? "No doctor requests match your search." : "No pending doctor registration requests."}</td></tr>`;
      return;
    }
    applicationsBody.innerHTML = visibleApplications.map((application) => `
        <tr>
          <td>${person(application.fullName, application.email)}</td>
          <td>${escapeHtml(application.specialization)}</td>
          <td>${escapeHtml(application.phone)}</td>
          <td>${escapeHtml(application.availability)}</td>
          <td>${dateText(application.createdAt)}</td>
          <td><div class="d-flex gap-1">
            <button class="btn btn-sm btn-primary" type="button" data-application-action="approve" data-id="${escapeHtml(application._id)}">Approve</button>
            <button class="btn btn-sm btn-outline-danger" type="button" data-application-action="reject" data-id="${escapeHtml(application._id)}">Reject</button>
          </div></td>
        </tr>`).join("");
  }

  async function load() {
    try {
      const result = await HospitalApi.get(endpoint);
      records = result.data;
      if (page === "doctors") {
        const filter = document.getElementById("specializationFilter");
        const current = filter.value;
        const specializations = [...new Set(records.map((doctor) => doctor.specialization).filter(Boolean))].sort();
        filter.innerHTML = '<option value="">All specializations</option>' +
          specializations.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
        filter.value = specializations.includes(current) ? current : "";
        await loadDoctorApplications();
      }
      render();
    } catch (error) {
      tableBody.innerHTML = `<tr><td class="empty-state" colspan="7">Unable to load records: ${escapeHtml(error.message)}</td></tr>`;
      showToast(`Could not load ${page}: ${error.message}`, true);
    }

    async function loadDoctorApplications() {
      if (!applicationsSection || window.currentUser.role !== "admin") {
        if (applicationsSection) applicationsSection.classList.add("d-none");
        return;
      }
      applicationsSection.classList.remove("d-none");
      try {
        const result = await HospitalApi.get("/auth/doctor-applications");
        doctorApplications = result.data;
        renderDoctorApplications();
      } catch (error) {
        applicationsBody.innerHTML = `<tr><td class="empty-state" colspan="6">Unable to load doctor requests: ${escapeHtml(error.message)}</td></tr>`;
        showToast(`Could not load doctor registration requests: ${error.message}`, true);
      }
    }

  }

  function setSelectOptions(name, values, idKey, labelBuilder) {
    const select = form.elements[name];
    const previous = select.value;
    select.innerHTML = `<option value="">Choose ${name}</option>` + values.map((item) => `<option value="${item[idKey]}">${escapeHtml(labelBuilder(item))}</option>`).join("");
    if (previous) select.value = previous;
  }

  async function openCreate(selectedPatientId) {
    editingId = null;
    form.reset();
    if (page === "doctors") {
      const canCreateDoctorAccount = window.currentUser.role === "admin";
      form.elements.password.required = canCreateDoctorAccount;
      document.getElementById("doctorPasswordField").classList.toggle("d-none", !canCreateDoctorAccount);
    }
    if (isAppointments && !["admin", "receptionist"].includes(window.currentUser.role)) return;
    if (["patients", "doctors"].includes(page) && !["admin", "receptionist"].includes(window.currentUser.role)) return;
    formError.classList.add("d-none");
    formError.textContent = "";
    document.getElementById("modalTitle").textContent = isAppointments ? "New appointment" : page === "patients" ? "Add patient" : "Add doctor";
    if (isAppointments) {
      try {
        const [patientResult, doctorResult] = await Promise.all([HospitalApi.get("/patients"), HospitalApi.get("/doctors")]);
        patients = patientResult.data;
        doctors = doctorResult.data;
        setSelectOptions("patient", patients, "_id", (item) => `${item.fullName} · ${item.patientId}`);
        setSelectOptions("doctor", doctors, "_id", (item) => `${item.fullName} · ${item.specialization}`);
        if (!patients.length || !doctors.length) throw new Error("Add at least one patient and one doctor before scheduling.");
        if (selectedPatientId) form.elements.patient.value = selectedPatientId;
      } catch (error) {
        showToast(error.message, true);
        return;
      }
    } else if (page === "patients") {
      form.elements.admissionDate.value = new Date().toISOString().slice(0, 10);
    }
    modal.show();
  }

  async function editRecord(id) {
    const row = records.find((item) => item._id === id);
    if (!row) return;
    editingId = id;
    form.reset();
    if (page === "doctors") {
      form.elements.password.required = false;
      document.getElementById("doctorPasswordField").classList.add("d-none");
    }
    formError.classList.add("d-none");
    formError.textContent = "";
    if (isAppointments) {
      const [patientResult, doctorResult] = await Promise.all([HospitalApi.get("/patients"), HospitalApi.get("/doctors")]);
      patients = patientResult.data;
      doctors = doctorResult.data;
      setSelectOptions("patient", patients, "_id", (item) => `${item.fullName} · ${item.patientId}`);
      setSelectOptions("doctor", doctors, "_id", (item) => `${item.fullName} · ${item.specialization}`);
    }
    Object.entries(row).forEach(([key, value]) => {
      const input = form.elements[key];
      if (!input) return;
      if (isAppointments && (key === "patient" || key === "doctor")) input.value = value && value._id || "";
      else if (key === "admissionDate" || key === "appointmentDate") input.value = String(value).slice(0, 10);
      else if (key === "healthConcerns" && Array.isArray(value)) input.value = value.join(", ");
      else if (typeof value !== "object" || value === null) input.value = value;
    });
    if (isAppointments && window.currentUser.role === "doctor") {
      ["patient", "doctor", "appointmentDate", "appointmentTime"].forEach((name) => {
        form.elements[name].disabled = true;
      });
    }
    document.getElementById("modalTitle").textContent = "Edit record";
    modal.show();
  }

  const addButton = document.getElementById("addButton");
  if (["patients", "doctors", "appointments"].includes(page) &&
      !["admin", "receptionist"].includes(window.currentUser.role)) addButton.classList.add("d-none");
  if (walkInPatientButton && walkInPatientForm && window.currentUser.role === "receptionist") {
    walkInPatientButton.classList.remove("d-none");
    walkInPatientButton.addEventListener("click", () => {
      walkInPatientForm.reset();
      document.getElementById("walkInPatientError").classList.add("d-none");
      document.getElementById("walkInAdmissionDate").value = new Date().toISOString().slice(0, 10);
      walkInPatientModal.show();
    });
    walkInPatientForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const error = document.getElementById("walkInPatientError");
      const button = walkInPatientForm.querySelector('button[type="submit"]');
      error.classList.add("d-none");
      button.disabled = true;
      try {
        const data = Object.fromEntries(new FormData(walkInPatientForm).entries());
        data.age = Number(data.age);
        const result = await HospitalApi.post("/patients", data);
        walkInPatientModal.hide();
        walkInPatientForm.reset();
        showToast(`Patient registered · ${result.data.patientId}`);
        await openCreate(result.data._id);
      } catch (requestError) {
        error.textContent = requestError.message;
        error.classList.remove("d-none");
      } finally {
        button.disabled = false;
      }
    });
  }
  if (receptionistAccountButton && window.currentUser.role === "admin") {
    receptionistAccountButton.classList.remove("d-none");
    receptionistAccountButton.addEventListener("click", () => {
      receptionistAccountForm.reset();
      document.getElementById("receptionistAccountError").classList.add("d-none");
      receptionistAccountModal.show();
    });
  }
  addButton.addEventListener("click", openCreate);
  search.addEventListener("input", render);
  if (applicationsSearch) applicationsSearch.addEventListener("input", renderDoctorApplications);
  if (isAppointments) document.getElementById("statusFilter").addEventListener("change", render);
  if (page === "patients") document.getElementById("genderFilter").addEventListener("change", render);
  if (page === "doctors") document.getElementById("specializationFilter").addEventListener("change", render);

  if (applicationsBody) {
    applicationsBody.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-application-action]");
      if (!button) return;
      const action = button.dataset.applicationAction;
      const application = button.closest("tr");
      const applicant = application && application.querySelector(".person-cell")?.innerText.split("\n")[0];
      if (action === "approve" && !window.confirm(`Approve ${applicant || "this applicant"}? Verify their professional credentials before granting doctor access to patient records.`)) return;
      if (action === "reject" && !window.confirm(`Reject ${applicant || "this doctor registration request"}?`)) return;
      button.disabled = true;
      try {
        await HospitalApi.post(`/auth/doctor-applications/${button.dataset.id}/${action}`, {});
        showToast(action === "approve" ? "Doctor approved and can now sign in" : "Doctor registration rejected");
        await load();
      } catch (error) {
        showToast(`Could not ${action} doctor registration: ${error.message}`, true);
        button.disabled = false;
      }
    });
  }

  if (receptionistAccountForm) {
    receptionistAccountForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const error = document.getElementById("receptionistAccountError");
      error.classList.add("d-none");
      const button = receptionistAccountForm.querySelector('button[type="submit"]');
      button.disabled = true;
      try {
        const data = Object.fromEntries(new FormData(receptionistAccountForm).entries());
        await HospitalApi.post("/auth/receptionist-accounts", data);
        receptionistAccountModal.hide();
        showToast("Receptionist sign-in created");
        receptionistAccountForm.reset();
      } catch (requestError) {
        error.textContent = requestError.message;
        error.classList.remove("d-none");
      } finally {
        button.disabled = false;
      }
    });
  }

  tableBody.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    if (button.dataset.action === "create-account") {
      const record = records.find((item) => item._id === button.dataset.id);
      if (!record) return;
      if (page === "doctors") {
        doctorAccountForm.reset();
        doctorAccountForm.elements.doctorId.value = record._id;
        document.getElementById("doctorAccountName").textContent = `${record.fullName} · ${record.email}`;
        document.getElementById("doctorAccountError").classList.add("d-none");
        doctorAccountModal.show();
      } else {
        patientAccountForm.reset();
        patientAccountForm.elements.patientId.value = record._id;
        document.getElementById("patientAccountName").textContent = `${record.fullName} · ${record.patientId}`;
        document.getElementById("patientAccountError").classList.add("d-none");
        patientAccountModal.show();
      }
      return;
    }
    if (button.dataset.action === "view") {
      const patient = records.find((item) => item._id === button.dataset.id);
      if (!patient) return;
      const fields = [
        ["Patient ID", patient.patientId],
        ["Full name", patient.fullName],
        ["Age", patient.age],
        ["Gender", patient.gender],
        ["Phone", patient.phone],
        ["Address", patient.address],
        ["Condition", patient.disease],
        ["Admission date", dateText(patient.admissionDate)]
      ];
      document.getElementById("detailsContent").innerHTML = fields.map(([label, value]) =>
        `<div class="d-flex justify-content-between gap-3 border-bottom py-2"><span class="text-secondary">${escapeHtml(label)}</span><strong class="text-end">${escapeHtml(value == null || value === "" ? "—" : value)}</strong></div>`
      ).join("");
      bootstrap.Modal.getOrCreateInstance(document.getElementById("detailsModal")).show();
      return;
    }
    if (button.dataset.action === "edit") {
      try { await editRecord(button.dataset.id); } catch (error) { showToast(error.message, true); }
      return;
    }
    const row = records.find((item) => item._id === button.dataset.id);
    if (!row || !window.confirm(`Delete ${row.fullName || row.appointmentId}? This cannot be undone.`)) return;
    try {
      await HospitalApi.delete(`${endpoint}/${row._id}`);
      showToast("Record deleted");
      await load();
    } catch (error) {
      showToast(error.message, true);
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton.disabled) return;
    const data = Object.fromEntries(new FormData(form).entries());
    if (page === "patients") data.age = Number(data.age);
    if (page === "doctors") data.healthConcerns = data.healthConcerns.split(",").map((concern) => concern.trim()).filter(Boolean);
    if (page === "doctors" && editingId) delete data.password;
    if (isAppointments && window.currentUser.role === "doctor") {
      Object.keys(data).forEach((key) => { if (key !== "status") delete data[key]; });
    }
    const originalLabel = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = "Saving…";
    try {
      if (editingId) await HospitalApi.put(`${endpoint}/${editingId}`, data);
      else if (page === "doctors" && window.currentUser.role === "admin") await HospitalApi.post("/auth/doctor-accounts", data);
      else await HospitalApi.post(endpoint, data);
      modal.hide();
      showToast(editingId ? "Record updated" : "Record created");
      await load();
    } catch (error) {
      formError.textContent = error.message;
      formError.classList.remove("d-none");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = originalLabel;
    }
  });

  if (doctorAccountForm) {
    doctorAccountForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const error = document.getElementById("doctorAccountError");
      error.classList.add("d-none");
      const button = doctorAccountForm.querySelector('button[type="submit"]');
      button.disabled = true;
      try {
        const { doctorId, password } = Object.fromEntries(new FormData(doctorAccountForm).entries());
        await HospitalApi.post(`/auth/doctor-accounts/${doctorId}`, { password });
        doctorAccountModal.hide();
        showToast("Doctor sign-in created");
        await load();
      } catch (requestError) {
        error.textContent = requestError.message;
        error.classList.remove("d-none");
      } finally {
        button.disabled = false;
      }
    });
  }

  if (patientAccountForm) {
    patientAccountForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const error = document.getElementById("patientAccountError");
      error.classList.add("d-none");
      const button = patientAccountForm.querySelector('button[type="submit"]');
      button.disabled = true;
      try {
        const { patientId, email, password } = Object.fromEntries(new FormData(patientAccountForm).entries());
        await HospitalApi.post(`/auth/patient-accounts/${patientId}`, { email, password });
        patientAccountModal.hide();
        showToast("Patient sign-in created");
        await load();
      } catch (requestError) {
        error.textContent = requestError.message;
        error.classList.remove("d-none");
      } finally {
        button.disabled = false;
      }
    });
  }

  load();
})();
