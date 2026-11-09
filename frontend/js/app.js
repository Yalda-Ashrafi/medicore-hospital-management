window.appReady = (async function () {
  const page = document.body.dataset.page;
  let currentUser;
  if (page === "contact" && !HospitalApi.hasToken()) return true;
  try {
    const session = await HospitalApi.get("/auth/me");
    currentUser = session.data.user;
  } catch (error) {
    if (!HospitalApi.hasToken()) {
      if (!/login\.html$/.test(window.location.pathname)) window.location.replace("login.html");
    } else {
      const message = document.createElement("p");
      message.className = "alert alert-danger m-4";
      message.textContent = `Unable to verify your account: ${error.message}`;
      document.body.replaceChildren(message);
    }
    return;
  }
  window.currentUser = currentUser;
  if (page === "contact" && currentUser.role === "patient") return true;
  if (page === "contact") document.body.classList.add("staff-contact");
  if (currentUser.role === "patient" || page === "patient") {
    window.location.replace(currentUser.role === "patient" ? "patient.html" : "dashboard.html");
    return;
  }
  if (currentUser.role === "receptionist" && page === "dashboard") {
    window.location.replace("appointments.html");
    return;
  }
  if (page === "patients" && !["admin", "doctor", "receptionist"].includes(currentUser.role) ||
      ["doctors"].includes(page) && !["admin", "doctor", "receptionist"].includes(currentUser.role) ||
      page === "front-desk" && !["admin", "receptionist"].includes(currentUser.role) ||
      page === "chat" && !["admin", "receptionist"].includes(currentUser.role) ||
      page === "reports" && currentUser.role !== "admin") {
    window.location.replace("dashboard.html");
    return;
  }
  const pages = [
    { key: "dashboard", label: "Dashboard", href: "dashboard.html", icon: "bi-grid-1x2" },
    { key: "patients", label: "Patients", href: "patients.html", icon: "bi-people" },
    { key: "doctors", label: "Doctors", href: "doctors.html", icon: "bi-person-badge" },
    { key: "appointments", label: "Appointments", href: "appointments.html", icon: "bi-calendar2-check" },
    { key: "front-desk", label: "Front desk", href: "front-desk.html", icon: "bi-person-walking" },
    { key: "chat", label: "Patient chat", href: "chat.html", icon: "bi-chat-dots" },
    { key: "reports", label: "Reports", href: "reports.html", icon: "bi-file-earmark-bar-graph" },
    { key: "contact", label: "Contact", href: "contact.html", icon: "bi-chat-dots" }
  ];
  const visiblePages = pages.filter((item) =>
    (currentUser.role !== "receptionist" || ["patients", "doctors", "appointments", "front-desk", "chat", "contact"].includes(item.key)) &&
    (item.key !== "chat" || ["admin", "receptionist"].includes(currentUser.role)) &&
    (item.key !== "reports" || currentUser.role === "admin")
  );
  const labels = Object.fromEntries(pages.map((item) => [item.key, item.label]));
  const escapeHtml = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
  window.escapeHtml = escapeHtml;

  const malaysiaTimeZone = "Asia/Kuala_Lumpur";
  const now = new Date();
  const dateLabel = new Intl.DateTimeFormat(undefined, {
    timeZone: malaysiaTimeZone,
    weekday: "short",
    month: "short",
    day: "numeric"
  }).format(now);
  const malaysiaHour = Number(new Intl.DateTimeFormat("en-GB", {
    timeZone: malaysiaTimeZone,
    hour: "2-digit",
    hourCycle: "h23"
  }).format(now));
  const greetingText = document.getElementById("greetingText");
  if (greetingText) {
    const greeting = malaysiaHour < 12 ? "Good morning" : malaysiaHour < 18 ? "Good afternoon" : "Good evening";
    greetingText.textContent = `${greeting}, ${currentUser.displayName}`;
  }
  if (currentUser.role === "doctor") {
    document.querySelectorAll('a[href="appointments.html"].btn-primary').forEach((link) => link.classList.add("d-none"));
  }

  document.getElementById("sidebar").innerHTML = `
    <a class="brand" href="${currentUser.role === "receptionist" ? "appointments.html" : "dashboard.html"}"><img class="brand-logo" src="images/medicore-logo-cropped.png" alt="MediCore Hospital"></a>
    <div class="nav-caption">Workspace</div>
    <nav class="nav flex-column">${visiblePages.map((item) => `<a class="nav-link ${page === item.key ? "active" : ""}" href="${item.href}"><i class="bi ${item.icon}"></i>${item.label}</a>`).join("")}</nav>
    <div class="sidebar-bottom"><div class="d-flex align-items-center gap-2"><i class="bi bi-shield-check text-primary fs-5"></i><div><div class="fw-semibold text-dark">MediCore Community Hospital</div><small>Demonstration environment</small></div></div></div>`;
  document.querySelectorAll("button, a, label, p, h1, h2, h3, span, small, div").forEach((element) => {
    if (element.childElementCount === 0) {
      element.textContent = element.textContent.replaceAll("Create account", "Create Account").replaceAll("Create an account", "Create Account");
    }
  });
  document.getElementById("topbar").innerHTML = `
    <div class="d-flex align-items-center gap-3"><button class="btn btn-light mobile-menu" id="menuToggle" aria-label="Toggle navigation"><i class="bi bi-list fs-5"></i></button><h2 class="topbar-title">${labels[page] || "Hospital Management"}</h2></div>
    <div class="topbar-right"><span class="d-none d-sm-inline text-secondary small">${dateLabel}</span><div class="notification-center"><button class="btn btn-light notification-button" type="button" aria-label="Notifications" aria-expanded="false" aria-controls="notificationPanel"><i class="bi bi-bell" aria-hidden="true"></i><span class="notification-count d-none" aria-live="polite"></span></button><section class="notification-panel" id="notificationPanel" aria-label="Notifications" hidden><header class="notification-panel-header"><strong>Notifications</strong><button class="notification-mark-all" type="button">Mark all read</button></header><div class="notification-items" aria-live="polite"><p class="notification-empty">Loading notifications…</p></div></section></div><span class="small text-secondary">${escapeHtml(currentUser.displayName)} · ${escapeHtml(currentUser.role)}</span><div class="avatar">${escapeHtml(currentUser.displayName.split(/\\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase())}</div><a class="btn btn-outline-secondary btn-sm" href="change-password.html">Change password</a><button class="btn btn-outline-secondary btn-sm" id="logoutButton">Sign out</button></div>`;

  if (window.initNotifications) window.initNotifications();
  document.getElementById("menuToggle").addEventListener("click", () => document.getElementById("sidebar").classList.toggle("open"));
  document.getElementById("logoutButton").addEventListener("click", async () => {
    try { await HospitalApi.post("/auth/logout", {}); }
    catch (error) { showToast(`Could not sign out: ${error.message}`, true); return; }
    HospitalApi.clearToken();
    window.location.replace("login.html");
  });

  window.showToast = function (message, isError) {
    const toast = document.createElement("div");
    toast.className = `toast align-items-center text-bg-${isError ? "danger" : "success"} border-0`;
    toast.setAttribute("role", "status");
    toast.innerHTML = `<div class="d-flex"><div class="toast-body">${escapeHtml(message)}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button></div>`;
    document.getElementById("toastContainer").appendChild(toast);
    const instance = new bootstrap.Toast(toast, { delay: 3500 });
    toast.addEventListener("hidden.bs.toast", () => toast.remove());
    instance.show();
  };

  window.escapeHtml = function (value) {
    return escapeHtml(value);
  };
  return true;
})();
