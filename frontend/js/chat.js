(async function () {
  if (!(await window.appReady)) return;
  const list = document.getElementById("chatConversationList");
  const messages = document.getElementById("staffChatMessages");
  const form = document.getElementById("staffChatForm");
  const input = document.getElementById("staffChatInput");
  const submitButton = form.querySelector('button[type="submit"]');
  const heading = document.getElementById("chatThreadHeading");
  let conversations = [];
  let selectedId = null;
  let refreshMessagesInProgress = false;

  function renderMessages(items) {
    messages.replaceChildren();
    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "text-secondary";
      empty.textContent = "No messages yet. Send a reply to start the conversation.";
      messages.appendChild(empty);
      return;
    }
    items.forEach((item) => {
      const bubble = document.createElement("article");
      bubble.className = `chat-message ${item.senderRole === "patient" ? "chat-message-incoming" : "chat-message-outgoing"}`;
      const meta = document.createElement("div");
      meta.className = "chat-message-heading";
      const sender = document.createElement("strong");
      sender.textContent = item.senderRole === "patient" ? "Patient" : `Hospital team · ${item.sender && item.sender.displayName || "Staff"}`;
      const time = document.createElement("time");
      time.dateTime = item.createdAt;
      time.textContent = new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" }).format(new Date(item.createdAt));
      const body = document.createElement("p");
      body.textContent = item.content;
      meta.append(sender, time);
      bubble.append(meta, body);
      messages.appendChild(bubble);
    });
    messages.scrollTop = messages.scrollHeight;
  }

  function renderConversations() {
    list.replaceChildren();
    if (!conversations.length) {
      const empty = document.createElement("p");
      empty.className = "text-secondary";
      empty.textContent = "There are no open patient conversations.";
      list.appendChild(empty);
      return;
    }
    conversations.forEach((conversation) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `chat-conversation ${conversation._id === selectedId ? "active" : ""}`;
      const patient = conversation.patient || {};
      const name = document.createElement("strong");
      name.textContent = patient.displayName || patient.email || "Patient";
      const preview = document.createElement("span");
      preview.textContent = conversation.lastMessage || "Conversation started";
      const time = document.createElement("small");
      time.textContent = new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" }).format(new Date(conversation.lastMessageAt));
      button.append(name, preview, time);
      button.addEventListener("click", () => selectConversation(conversation._id));
      list.appendChild(button);
    });
  }

  async function refreshConversations() {
    try {
      const result = await HospitalApi.get("/chat/conversations");
      conversations = result.data;
      if (selectedId && !conversations.some((conversation) => conversation._id === selectedId)) selectedId = null;
      renderConversations();
      if (!selectedId && conversations.length) await selectConversation(conversations[0]._id);
      else if (selectedId) refreshMessages();
    } catch (error) {
      list.textContent = `Unable to load conversations: ${error.message}`;
    }
  }

  async function refreshMessages() {
    if (!selectedId || refreshMessagesInProgress) return;
    refreshMessagesInProgress = true;
    try {
      const result = await HospitalApi.get(`/chat/conversations/${encodeURIComponent(selectedId)}/messages`);
      renderMessages(result.data);
    } catch (error) {
      messages.textContent = `Unable to load messages: ${error.message}`;
    } finally {
      refreshMessagesInProgress = false;
    }
  }

  async function selectConversation(id) {
    selectedId = id;
    const conversation = conversations.find((item) => item._id === id);
    const patient = conversation && conversation.patient || {};
    heading.querySelector("h2").textContent = patient.displayName || patient.email || "Patient conversation";
    heading.querySelector("p").textContent = patient.email || "Patient message thread";
    input.disabled = false;
    submitButton.disabled = false;
    renderConversations();
    await refreshMessages();
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const content = input.value.trim();
    if (!selectedId || !content) return;
    submitButton.disabled = true;
    try {
      await HospitalApi.post(`/chat/conversations/${encodeURIComponent(selectedId)}/messages`, { content });
      input.value = "";
      await refreshMessages();
      await refreshConversations();
    } catch (error) {
      window.showToast(`Could not send reply: ${error.message}`, true);
    } finally {
      submitButton.disabled = !selectedId;
      input.focus();
    }
  });

  await refreshConversations();
  const conversationTimer = window.setInterval(refreshConversations, 10000);
  const messageTimer = window.setInterval(refreshMessages, 5000);
  window.addEventListener("beforeunload", () => {
    window.clearInterval(conversationTimer);
    window.clearInterval(messageTimer);
  });
})();
