(function () {
  document.querySelectorAll("button, a, label, p, h1, h2, h3, span, small, div").forEach((element) => {
    if (element.childElementCount === 0) {
      element.textContent = element.textContent.replaceAll("Create account", "Create Account").replaceAll("Create an account", "Create Account");
    }
  });
  const doctors = [
    { name: "Aisha Rahman", specialty: "Cardiology", roomNumber: "101", concerns: "Heart health, high blood pressure, chest pain" },
    { name: "Daniel Wong", specialty: "Dermatology", roomNumber: "102", concerns: "Acne, eczema, rashes, skin allergies" },
    { name: "Priya Nair", specialty: "Pediatrics", roomNumber: "103", concerns: "Childhood illness, fever, infant care" },
    { name: "Lim Wei Jian", specialty: "Orthopedics", roomNumber: "104", concerns: "Back pain, joint pain, fractures, sports injuries" },
    { name: "Nurul Huda", specialty: "Neurology", roomNumber: "105", concerns: "Headaches, migraine, seizures, nerve concerns" },
    { name: "Jonathan Lee", specialty: "ENT", roomNumber: "106", concerns: "Ear infections, sinus concerns, sore throat" },
    { name: "Farah Ismail", specialty: "Obstetrics and Gynecology", roomNumber: "107", concerns: "Pregnancy care, menstrual concerns, women's health" },
    { name: "Arjun Kumar", specialty: "Gastroenterology", roomNumber: "108", concerns: "Stomach pain, acid reflux, digestive concerns" },
    { name: "Mei Tan", specialty: "Ophthalmology", roomNumber: "109", concerns: "Eye infections, vision concerns, eye strain" },
    { name: "Samuel Joseph", specialty: "Endocrinology", roomNumber: "110", concerns: "Diabetes, thyroid concerns, hormone health" },
    { name: "Kavitha Devi", specialty: "Pulmonology", roomNumber: "111", concerns: "Asthma, persistent cough, breathing concerns" },
    { name: "Hafiz Ahmad", specialty: "Urology", roomNumber: "112", concerns: "Urinary concerns, kidney stones, bladder health" },
    { name: "Sarah Lim", specialty: "Psychiatry", roomNumber: "113", concerns: "Anxiety, low mood, sleep concerns, stress" },
    { name: "Benjamin Chua", specialty: "General Practice", roomNumber: "114", concerns: "Fever, cold and flu, general checkups" }
  ];
  let appointments = [
    { patient: "Alex Morgan", doctor: doctors[0].name, date: "Today", time: "09:30", status: "Confirmed" },
    { patient: "Jamie Taylor", doctor: doctors[1].name, date: "Today", time: "10:15", status: "Pending" },
    { patient: "Casey Lee", doctor: doctors[2].name, date: "Today", time: "11:00", status: "Confirmed" }
  ];

  const list = document.getElementById("demoDoctorList");
  const search = document.getElementById("demoDoctorSearch");
  const appointmentList = document.getElementById("demoAppointmentList");
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);

  function showTab(name) {
    document.querySelectorAll("[data-demo-tab]").forEach((button) => {
      const active = button.dataset.demoTab === name;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll(".demo-panel").forEach((panel) => panel.classList.toggle("d-none", panel.id !== `demo-${name}`));
  }

  function renderDoctors() {
    const query = search.value.trim().toLowerCase();
    const visible = doctors.filter((doctor) => `${doctor.name} ${doctor.specialty} ${doctor.concerns}`.toLowerCase().includes(query));
    if (!visible.length) {
      list.innerHTML = '<div class="col-12"><div class="card-panel text-secondary small">No doctors match that search.</div></div>';
      return;
    }
    list.innerHTML = visible.map((doctor) => {
      const initials = doctor.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("");
      return `<div class="col-md-6 col-xl-4"><article class="card-panel demo-doctor-card"><div class="demo-doctor-top"><span class="demo-doctor-avatar">${escapeHtml(initials)}</span><span><strong>${escapeHtml(doctor.name)}</strong><small>${escapeHtml(doctor.specialty)} · Room ${escapeHtml(doctor.roomNumber)}</small></span></div><p class="demo-doctor-concerns">Health concerns: ${escapeHtml(doctor.concerns)}</p><a class="btn btn-outline-primary" href="login.html"><i class="bi bi-calendar-plus me-2"></i>Sign in to request</a></article></div>`;
    }).join("");
  }

  function renderAppointments() {
    appointmentList.innerHTML = appointments.map((appointment, index) => `
      <tr><td class="fw-semibold">${escapeHtml(appointment.patient)}</td>
      <td>${escapeHtml(appointment.doctor)}</td>
      <td>${escapeHtml(appointment.date)}<small class="d-block text-secondary">${escapeHtml(appointment.time)}</small></td>
      <td><span class="status status-${appointment.status.toLowerCase()}">${escapeHtml(appointment.status)}</span></td>
      <td><span class="text-success"><i class="bi bi-door-open me-1"></i>Room ${escapeHtml(doctors.find((doctor) => doctor.name === appointment.doctor).roomNumber)}</span></td></tr>`).join("");
  }

  document.querySelectorAll("[data-demo-tab]").forEach((button) => button.addEventListener("click", () => showTab(button.dataset.demoTab)));
  document.querySelectorAll("[data-open-demo-tab]").forEach((button) => button.addEventListener("click", () => {
    const targetTab = button.dataset.openDemoTab;
    showTab(targetTab);
    document.getElementById(`demo-${targetTab}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }));
  search.addEventListener("input", renderDoctors);
  renderDoctors();
  renderAppointments();
})();
