(async function () {
  if (!(await window.appReady)) return;
  try {
    const { data } = await HospitalApi.get("/dashboard");
    if (window.currentUser.role === "doctor") {
      document.getElementById("dashboardDescription").textContent = "Your clinical workspace for patient records and appointments.";
      const primaryAction = document.getElementById("dashboardPrimaryAction");
      primaryAction.href = "appointments.html";
      primaryAction.innerHTML = '<i class="bi bi-calendar2-check me-2"></i>View appointments';
      document.getElementById("doctorWorkspaceActions").classList.remove("d-none");
    }
    document.getElementById("totalPatients").textContent = data.totalPatients;
    document.getElementById("totalDoctors").textContent = data.totalDoctors;
    document.getElementById("todaysAppointments").textContent = data.todaysAppointments;
    if (window.currentUser.role === "admin") {
      const renderRevenue = (revenue) => {
        for (const currency of ["MYR", "USD"]) {
          const value = revenue.totals[currency] / 100;
          document.getElementById(`monthlyRevenue${currency}`).textContent = new Intl.NumberFormat(undefined, {
            style: "currency",
            currency,
            maximumFractionDigits: 2
          }).format(value);
        }
      };
      renderRevenue(data.monthlyRevenue);
      const refreshRevenue = async () => {
        const result = await HospitalApi.get("/dashboard/revenue");
        renderRevenue(result.data);
      };
      window.setInterval(() => {
        refreshRevenue().catch((error) => showToast(`Could not refresh revenue: ${error.message}`, true));
      }, 30000);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          refreshRevenue().catch((error) => showToast(`Could not refresh revenue: ${error.message}`, true));
        }
      });
      document.getElementById("availableBeds").textContent = data.availableBeds;
    } else {
      document.getElementById("monthlyRevenueCard").classList.add("d-none");
      document.getElementById("availableBedsCard").classList.add("d-none");
    }
    document.getElementById("totalAppointments").textContent = data.totalAppointments;
    document.getElementById("patientRatio").textContent = data.totalDoctors ? `${(data.totalPatients / data.totalDoctors).toFixed(1)} : 1` : "—";

    const baseOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, border: { display: false } }, y: { beginAtZero: true, grid: { color: "#eef1f6" }, border: { display: false }, ticks: { precision: 0 } } } };
    new Chart(document.getElementById("patientChart"), { type: "line", data: { labels: data.months, datasets: [{ label: "Patients", data: data.patientGrowth, borderColor: "#159bb2", backgroundColor: "rgba(21,155,178,.12)", fill: true, tension: .38, pointRadius: 3, pointBackgroundColor: "#159bb2" }] }, options: baseOptions });
    new Chart(document.getElementById("appointmentChart"), { type: "bar", data: { labels: data.months, datasets: [{ label: "Appointments", data: data.appointmentTrend, backgroundColor: "#45b7c8", borderRadius: 5, maxBarThickness: 32 }] }, options: baseOptions });
    new Chart(document.getElementById("doctorChart"), { type: "doughnut", data: { labels: data.doctorDistribution.map((item) => item.name), datasets: [{ data: data.doctorDistribution.map((item) => item.count), backgroundColor: ["#159bb2", "#45b7c8", "#f5a000", "#20b89c", "#16869a", "#78cbd5"], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: "68%", plugins: { legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 7, padding: 14, font: { size: 10 } } } } } });
  } catch (error) {
    showToast(`Could not load dashboard: ${error.message}`, true);
  }
})();
