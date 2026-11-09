(async function () {
  if (!(await window.appReady)) return;
  try {
    const { data } = await HospitalApi.get("/reports");
    document.getElementById("reportPatients").textContent = data.totalPatients;
    document.getElementById("reportAppointments").textContent = data.totalAppointments;
    if (data.mostBookedDoctor) {
      document.getElementById("mostBookedDoctor").textContent = data.mostBookedDoctor.fullName || "Doctor";
      document.getElementById("mostBookedDetail").textContent = `${data.mostBookedDoctor.specialization || "Provider"} · ${data.mostBookedDoctor.appointments} appointments`;
    } else {
      document.getElementById("mostBookedDoctor").textContent = "No data yet";
      document.getElementById("mostBookedDetail").textContent = "Appointments will appear here once booked.";
    }
    const rows = data.monthlySummary;
    document.getElementById("reportRows").innerHTML = rows.length
      ? rows.map((row) => `<tr><td class="fw-semibold">${escapeHtml(new Date(`${row.month}-02T00:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" }))}</td><td>${row.total}</td><td><span class="status status-confirmed">${row.confirmed}</span></td><td><span class="status status-cancelled">${row.cancelled}</span></td></tr>`).join("")
      : '<tr><td class="empty-state" colspan="4">No appointment data available yet.</td></tr>';
  } catch (error) {
    document.getElementById("reportRows").innerHTML = `<tr><td class="empty-state" colspan="4">Unable to load report: ${escapeHtml(error.message)}</td></tr>`;
    showToast(`Could not load reports: ${error.message}`, true);
  }
})();
