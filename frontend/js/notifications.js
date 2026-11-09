(function () {
  const escapeHtml = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);

  window.initNotifications = function () {
    const root = document.querySelector(".notification-center");
    const button = root?.querySelector(".notification-button");
    const panel = root?.querySelector(".notification-panel");
    const items = root?.querySelector(".notification-items");
    const count = root?.querySelector(".notification-count");
    const markAllButton = root?.querySelector(".notification-mark-all");
    if (!root || !button || !panel || !items || !count || !markAllButton) return;

    let loading = false;
    let notificationData = [];

    function render(data) {
      notificationData = data.notifications || [];
      const unreadCount = Number(data.unreadCount) || 0;
      count.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
      count.classList.toggle("d-none", unreadCount === 0);
      button.setAttribute("aria-label", unreadCount
        ? `Notifications, ${unreadCount} unread`
        : "Notifications");
      markAllButton.disabled = unreadCount === 0;
      if (!notificationData.length) {
        items.innerHTML = '<p class="notification-empty">You’re all caught up. New updates will appear here.</p>';
        return;
      }
      items.innerHTML = notificationData.map((item) => `
        <a class="notification-item ${item.readAt ? "" : "is-unread"}" href="${escapeHtml(item.href)}" data-notification-id="${escapeHtml(item._id)}">
          <span class="notification-icon"><i class="bi ${item.type === "doctor-application" ? "bi-person-badge" : item.type === "front-desk" ? "bi-person-walking" : "bi-calendar2-check"}" aria-hidden="true"></i></span>
          <span class="notification-copy"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.message)}</span><small>${escapeHtml(new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.createdAt)))}</small></span>
          ${item.readAt ? "" : '<span class="notification-unread-dot" aria-label="Unread"></span>'}
        </a>`).join("");
    }

    async function refresh() {
      if (loading || !HospitalApi.hasToken()) return;
      loading = true;
      try {
        const result = await HospitalApi.get("/notifications");
        render(result.data);
      } catch (error) {
        items.innerHTML = `<p class="notification-empty notification-load-error">${escapeHtml(error.message)}<br>Try opening notifications again.</p>`;
      } finally {
        loading = false;
      }
    }

    button.addEventListener("click", async () => {
      const open = panel.hidden;
      panel.hidden = !open;
      button.setAttribute("aria-expanded", String(open));
      if (open) await refresh();
    });

    markAllButton.addEventListener("click", async () => {
      if (markAllButton.disabled) return;
      markAllButton.disabled = true;
      try {
        await HospitalApi.patch("/notifications/read-all", { read: true });
        await refresh();
      } catch (error) {
        items.innerHTML = `<p class="notification-empty notification-load-error">${escapeHtml(error.message)}</p>`;
        markAllButton.disabled = false;
      }
    });

    items.addEventListener("click", async (event) => {
      const link = event.target.closest("[data-notification-id]");
      if (!link || !link.classList.contains("is-unread")) return;
      event.preventDefault();
      try {
        await HospitalApi.patch(`/notifications/${encodeURIComponent(link.dataset.notificationId)}/read`, { read: true });
        window.location.assign(link.href);
      } catch (error) {
        items.innerHTML = `<p class="notification-empty notification-load-error">${escapeHtml(error.message)}</p>`;
      }
    });

    document.addEventListener("click", (event) => {
      if (!root.contains(event.target) && !panel.hidden) {
        panel.hidden = true;
        button.setAttribute("aria-expanded", "false");
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !panel.hidden) {
        panel.hidden = true;
        button.setAttribute("aria-expanded", "false");
        button.focus();
      }
    });
    refresh();
    window.setInterval(() => {
      if (!document.hidden) refresh();
    }, 30000);
  };
})();
