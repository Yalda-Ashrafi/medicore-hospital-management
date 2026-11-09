(async function () {
  const byId = (id) => document.getElementById(id);
  const bookingModal = new bootstrap.Modal(byId("bookingModal"));
  const form = byId("bookingForm");
  const submitButton = form.querySelector('button[type="submit"]');
  const errorBox = byId("bookingError");
  const doctorSelect = byId("bookingDoctor");
  const bookingConcern = byId("bookingConcern");
  const bookingDoctorHelp = byId("bookingDoctorHelp");
  const noMatchingDoctorHelp = byId("noMatchingDoctorHelp");
  const receptionAssignmentOption = byId("receptionAssignmentOption");
  const requestReceptionAssignment = byId("requestReceptionAssignment");
  const doctorDirectory = byId("doctorDirectory");
  const searchInput = byId("doctorSearch");
  let doctors = [];
  let profileId = null;
  let profileComplete = false;

  const concernSpecialties = [
    { terms: ["heart", "chest", "cardio", "palpitation"], specialties: ["cardiology", "cardiologist"] },
    { terms: ["skin", "rash", "acne", "itch"], specialties: ["dermatology", "dermatologist", "skin"] },
    { terms: ["eye", "vision", "sight"], specialties: ["ophthalmology", "ophthalmologist", "optometry", "eye"] },
    { terms: ["bone", "joint", "back", "knee", "fracture", "muscle"], specialties: ["orthopedic", "orthopaedic", "orthopedics", "orthopaedics"] },
    { terms: ["child", "baby", "infant", "paediatric", "pediatric"], specialties: ["pediatrics", "paediatrics", "pediatrician", "paediatrician"] },
    { terms: ["headache", "migraine", "nerve", "brain", "seizure"], specialties: ["neurology", "neurologist"] },
    { terms: ["pregnancy", "women", "woman", "period", "reproductive"], specialties: ["gynecology", "gynaecology", "obstetric", "obgyn"] },
    { terms: ["ear", "earache", "ear pain", "ear problem", "ear issue", "ear infection", "nose", "throat", "sinus", "hearing"], specialties: ["ent", "otolaryngology", "ear", "nose", "throat"] },
    { terms: ["tooth", "teeth", "dental", "gum"], specialties: ["dentist", "dental"] },
    { terms: ["stress", "anxiety", "mood", "mental", "sleep"], specialties: ["psychiatry", "psychiatrist", "psychology", "psychologist"] },
    { terms: ["diabetes", "thyroid", "hormone"], specialties: ["endocrinology", "endocrinologist"] },
    { terms: ["stomach", "digestive", "gut", "liver"], specialties: ["gastroenterology", "gastroenterologist"] },
    { terms: ["urine", "kidney", "bladder"], specialties: ["urology", "urologist", "nephrology", "nephrologist"] },
    { terms: ["cough", "breathing", "lung", "asthma"], specialties: ["pulmonology", "pulmonologist", "respiratory"] },
    { terms: ["xray", "x-ray", "radiology", "imaging", "scan"], specialties: ["radiology", "radiologist", "imaging"] },
    { terms: ["general", "checkup", "check-up", "fever", "cold", "flu"], specialties: ["general", "family", "primary", "internal medicine"] }
  ];
  const specialtyDescriptions = {
    cardiology: "focuses on the heart and blood circulation",
    dermatology: "focuses on skin, hair, and nail concerns",
    dentistry: "focuses on teeth and gums",
    dental: "focuses on teeth and gums",
    dentist: "focuses on teeth and gums",
    dentistry: "focuses on teeth and gums",
    ent: "focuses on ear, nose, and throat concerns",
    gastroenterology: "focuses on the stomach and digestive system",
    nephrology: "focuses on kidney health",
    neurology: "focuses on the brain, nerves, and nervous system",
    ophthalmology: "focuses on eye health and vision",
    optometry: "focuses on vision and eye testing",
    orthopedics: "focuses on bones, joints, and muscles",
    orthopaedics: "focuses on bones, joints, and muscles",
    pulmonology: "focuses on lungs and breathing",
    radiology: "uses medical images such as X-rays to help clinicians examine the body; imaging is usually arranged by a clinician",
    urology: "focuses on the urinary system"
  };
  let chatConversationId = null;
  let chatRefreshTimer = null;
  let chatMode = false;

  function showMessage(container, message, icon = "bi-info-circle") {
    const empty = document.createElement("div");
    empty.className = "doctor-directory-empty";
    const symbol = document.createElement("i");
    symbol.className = `bi ${icon}`;
    const text = document.createElement("span");
    text.textContent = message;
    empty.append(symbol, text);
    container.replaceChildren(empty);
  }

  function getMalaysiaDate() {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  function matchesDoctor(doctor, rawQuery) {
    const query = rawQuery.trim().toLowerCase();
    if (!query) return true;
    const specialization = String(doctor.specialization || "").toLowerCase();
    const healthConcerns = Array.isArray(doctor.healthConcerns) ? doctor.healthConcerns.join(" ") : "";
    const directMatch = `${doctor.fullName || ""} ${specialization} ${healthConcerns} ${doctor.availability || ""}`.toLowerCase().includes(query);
    if (directMatch) return true;
    const mappedSpecialties = mappedSpecialtiesFor(query);
    return mappedSpecialties.some((term) => specialization.includes(term));
  }

  function mappedSpecialtiesFor(rawQuery) {
    const query = rawQuery.trim().toLowerCase();
    return concernSpecialties
      .filter(({ terms }) => terms.some((term) => query.includes(term)))
      .flatMap(({ specialties }) => specialties);
  }

  function appendCareChatBubble(content, kind = "bot", doctorMatches = [], actions = []) {
    const container = byId("careChatMessages");
    const bubble = document.createElement("article");
    bubble.className = `care-chat-bubble care-chat-${kind}`;
    const text = document.createElement("p");
    text.textContent = content;
    bubble.appendChild(text);
    doctorMatches.forEach((doctor) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "care-chat-doctor";
      button.textContent = `${doctor.fullName} · ${doctor.specialization}`;
      button.addEventListener("click", () => openBooking(String(doctor._id)));
      bubble.appendChild(button);
    });
    actions.forEach(({ label, onClick }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "care-chat-doctor";
      button.textContent = label;
      button.addEventListener("click", onClick);
      bubble.appendChild(button);
    });
    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
  }

  function renderLiveChatMessages(messages) {
    const container = byId("careChatMessages");
    container.replaceChildren();
    if (!messages.length) {
      appendCareChatBubble("You’re connected to the hospital team. Send a message and reception will reply here.", "bot");
      return;
    }
    messages.forEach((message) => {
      appendCareChatBubble(message.content, message.senderRole === "patient" ? "user" : "bot");
    });
  }

  async function refreshPatientChat() {
    if (!chatConversationId || !chatMode) return;
    try {
      const result = await HospitalApi.get(`/chat/conversations/${encodeURIComponent(chatConversationId)}/messages`);
      renderLiveChatMessages(result.data);
    } catch (error) {
      appendCareChatBubble(`Unable to load reception messages: ${error.message}`, "bot");
    }
  }

  async function startPatientChat() {
    const button = byId("startStaffChatButton");
    if (chatMode) {
      chatMode = false;
      button.innerHTML = '<i class="bi bi-person-lines-fill me-1"></i>Chat with reception';
      byId("careChatModeLabel").textContent = "Ask about specialties, or connect with reception.";
      byId("specialtyGuideInput").placeholder = "Ask about a health concern or specialty…";
      appendCareChatBubble("You’re back with MediCore Assistant. Your reception chat is saved; tap “Chat with reception” whenever you want to continue it.", "bot");
      byId("specialtyGuideInput").focus();
      return;
    }
    button.disabled = true;
    try {
      if (!chatConversationId) {
        const result = await HospitalApi.post("/chat/conversations", {});
        chatConversationId = result.data._id;
      }
      chatMode = true;
      byId("specialtyGuideInput").placeholder = "Write a message to reception…";
      byId("careChatModeLabel").textContent = "Connected with reception and administrators.";
      button.innerHTML = '<i class="bi bi-arrow-left me-1"></i>Ask MediCore Assistant';
      appendCareChatBubble("You’re now connected to reception. Describe how we can help.", "bot");
      await refreshPatientChat();
      if (!chatRefreshTimer) chatRefreshTimer = window.setInterval(refreshPatientChat, 5000);
      byId("specialtyGuideInput").focus();
    } catch (error) {
      appendCareChatBubble(`Could not open a chat with reception: ${error.message}`, "bot");
    } finally {
      button.disabled = false;
    }
  }

  function renderSpecialtyGuide(concern) {
    const matches = doctors.filter((doctor) => matchesDoctor(doctor, concern));
    const specialtyNames = [...new Set(matches.map((doctor) => doctor.specialization).filter(Boolean))];
    if (!matches.length) {
      const describedSpecialties = [...new Set(mappedSpecialtiesFor(concern))]
        .map((name) => {
          const description = specialtyDescriptions[name];
          return description ? `${name}, which ${description}` : null;
        })
        .filter(Boolean);
      const explanation = describedSpecialties.length
        ? ` It may be associated with ${describedSpecialties.join("; ")}.`
        : "";
      appendCareChatBubble(`I couldn't find a listed doctor matching “${concern}”.${explanation} I can’t diagnose or choose treatment. Tap “Chat with reception” and the team can help you find the right care area.`);
      return;
    }
    const explanations = specialtyNames.map((name) => {
      const description = specialtyDescriptions[String(name).toLowerCase()];
      const plainName = String(name).toLowerCase() === "ent" ? "ENT (ear, nose, and throat)" : name;
      return description ? `${plainName} ${description}` : `${plainName} is the listed care area`;
    });
    appendCareChatBubble(`For “${concern}”, the directory lists ${explanations.join("; ")}. This is general information, not a diagnosis. Select a doctor below to see booking options, or ask reception if you’re unsure.`, "bot", matches);
  }

  function handleCareGuideMessage(message) {
    const normalized = message.toLowerCase().trim().replace(/[.,!?]+$/g, "").replace(/\s+/g, " ");
    const words = normalized.split(" ");
    if (/^(hi|hello|hey|hiya)\b/.test(normalized) ||
        /^(good morning|good afternoon|good evening)( there)?$/.test(normalized)) {
      appendCareChatBubble("Hi! I’m MediCore’s care guide. Welcome! I can help you find a doctor, request an appointment, locate the hospital, explain how to contact us, or tell you how to get help at reception. What can I help you with?");
      return;
    }
    if (/^(thanks|thank you|thankyou|thx|many thanks)\b/.test(normalized)) {
      appendCareChatBubble("You’re welcome! I’m here if you need anything else.");
      return;
    }
    if (normalized.includes("medicore meaning") || normalized.includes("meaning of medicore") ||
        normalized.includes("what does medicore mean") || normalized.includes("what is medicore")) {
      appendCareChatBubble("MediCore means “Essential Medical Care” or “At the Heart of Medicine.” The name reflects the hospital’s focus on putting care and patients at the center.");
      return;
    }
    if (words.some((word) => ["location", "address", "directions", "map", "where"].includes(word)) ||
        normalized.includes("where is the hospital") || normalized.includes("find the hospital")) {
      appendCareChatBubble("MediCore Community Hospital is in Kuala Lumpur City Centre (KLCC), Kuala Lumpur. Use the map link for directions.", "bot", [], [
        { label: "View hospital location", onClick: () => byId("location").scrollIntoView({ behavior: "smooth", block: "center" }) },
        { label: "Open map", onClick: () => window.open("https://www.google.com/maps/search/?api=1&query=Kuala+Lumpur+City+Centre%2C+Kuala+Lumpur", "_blank", "noopener,noreferrer") }
      ]);
      return;
    }
    if (words.some((word) => ["contact", "email", "phone", "reach"].includes(word)) ||
        normalized.includes("get in touch") || normalized.includes("contact the hospital")) {
      appendCareChatBubble("You can use the Contact page to send a message to the hospital team. For help choosing care or making an appointment, you can also chat with reception here.", "bot", [], [
        { label: "Open Contact page", onClick: () => { window.location.href = "contact.html"; } },
        { label: "Chat with reception", onClick: startPatientChat }
      ]);
      return;
    }
    if (words.some((word) => ["appointment", "appointments", "book", "booking", "schedule", "request"].includes(word))) {
      appendCareChatBubble("To request an appointment, choose a doctor from Find a doctor or tap below to open the booking form. If you’re unsure which doctor to choose, chat with reception and the team can help.", "bot", [], [
        { label: "Request an appointment", onClick: () => openBooking() },
        { label: "Chat with reception", onClick: startPatientChat }
      ]);
      return;
    }
    if (words.some((word) => ["payment", "payments", "pay", "bill", "billing", "cash"].includes(word))) {
      appendCareChatBubble("If you visit the hospital in person, go to reception/front desk. Reception can help register your visit and record your payment. Please ask the staff about accepted payment methods and any charges.");
      return;
    }
    if (words.some((word) => ["reception", "receptionist", "frontdesk", "front-desk", "walk-in", "walkin"].includes(word))) {
      appendCareChatBubble("At the hospital, go to the reception/front desk for help with check-in, finding an appropriate doctor, walk-in visits, and payment. You can also message reception using the button below.", "bot", [], [
        { label: "Chat with reception", onClick: startPatientChat }
      ]);
      return;
    }
    if (normalized.includes("what can you do") || normalized.includes("how can you help") || normalized === "help") {
      appendCareChatBubble("I can explain doctor specialties, show doctors listed for a concern, help you start an appointment request, share the hospital location and Contact page, and explain how reception can help with walk-ins and payments. I can’t diagnose or recommend treatment.");
      return;
    }
    if (doctors.some((doctor) => matchesDoctor(doctor, message)) || mappedSpecialtiesFor(message).length) {
      renderSpecialtyGuide(message);
      return;
    }
    appendCareChatBubble("I can help with the MediCore website: find a doctor, request an appointment, get the hospital location, open the Contact page, or learn about reception help for walk-ins and payments. What would you like to do?", "bot", [], [
      { label: "Find a doctor", onClick: () => document.getElementById("doctors").scrollIntoView({ behavior: "smooth", block: "start" }) },
      { label: "Request an appointment", onClick: () => openBooking() },
      { label: "Hospital location", onClick: () => document.getElementById("location").scrollIntoView({ behavior: "smooth", block: "center" }) },
      { label: "Contact page", onClick: () => { window.location.href = "contact.html"; } },
      { label: "Chat with reception", onClick: startPatientChat }
    ]);
  }

  function populateBookingDoctors() {
    const query = bookingConcern.value.trim();
    const selectedDoctorId = doctorSelect.value;
    const suggested = query ? doctors.filter((doctor) => matchesDoctor(doctor, query)) : [];
    const suggestedIds = new Set(suggested.map((doctor) => String(doctor._id)));
    const remaining = query ? doctors.filter((doctor) => !suggestedIds.has(String(doctor._id))) : doctors;
    const addDoctors = (group, doctorList, isSuggested) => {
      doctorList.forEach((doctor) => {
        const label = `${doctor.fullName} · ${doctor.specialization || "General practice"}`;
        group.appendChild(new Option(isSuggested ? `Suggested · ${label}` : label, doctor._id));
      });
    };

    doctorSelect.replaceChildren(new Option("Choose a doctor", ""));
    if (suggested.length) {
      const suggestedGroup = document.createElement("optgroup");
      suggestedGroup.label = "Suggested matches";
      addDoctors(suggestedGroup, suggested, true);
      doctorSelect.appendChild(suggestedGroup);
      if (remaining.length) {
        const remainingGroup = document.createElement("optgroup");
        remainingGroup.label = "Other available doctors";
        addDoctors(remainingGroup, remaining, false);
        doctorSelect.appendChild(remainingGroup);
      }
      bookingDoctorHelp.textContent = "Suggestions are matched to doctors’ listed specialties and care areas. You can still choose any doctor.";
    } else {
      if (!query) {
        const allDoctorsGroup = document.createElement("optgroup");
        allDoctorsGroup.label = "Available doctors";
        addDoctors(allDoctorsGroup, doctors, false);
        doctorSelect.appendChild(allDoctorsGroup);
      }
      bookingDoctorHelp.textContent = query
        ? "No matching doctor is listed. Please visit the hospital reception for help."
        : "Describe a concern above to see matching doctors first.";
    }

    const needsReceptionHelp = Boolean(query && suggested.length === 0);
    noMatchingDoctorHelp.classList.toggle("d-none", !needsReceptionHelp);
    receptionAssignmentOption.classList.toggle("d-none", !needsReceptionHelp);
    if (!needsReceptionHelp) requestReceptionAssignment.checked = false;
    doctorSelect.disabled = needsReceptionHelp;
    submitButton.disabled = needsReceptionHelp && !requestReceptionAssignment.checked;
    if (selectedDoctorId && doctors.some((doctor) => String(doctor._id) === selectedDoctorId)) {
      doctorSelect.value = selectedDoctorId;
    }
  }

  function openBooking(doctorId) {
    if (!profileComplete) {
      const notice = byId("profileCompletionNotice");
      notice.scrollIntoView({ behavior: "smooth", block: "center" });
      byId("googleProfileLink").focus();
      return;
    }
    errorBox.classList.add("d-none");
    errorBox.textContent = "";
    form.reset();
    byId("bookingDate").min = getMalaysiaDate();
    populateBookingDoctors();
    if (doctorId) doctorSelect.value = doctorId;
    bookingModal.show();
  }

  function renderDoctors() {
    const visible = doctors.filter((doctor) => matchesDoctor(doctor, searchInput.value));
    if (!visible.length) {
      showMessage(doctorDirectory, doctors.length
        ? "No doctors match that search. Try a doctor name, specialty, or another concern."
        : "There are no doctors listed yet. Please contact the hospital to find out when appointments will be available.",
      doctors.length ? "bi-search" : "bi-person-heart");
      return;
    }

    doctorDirectory.replaceChildren();
    visible.forEach((doctor) => {
      const column = document.createElement("div");
      column.className = "col-sm-6 col-xl-4";
      const card = document.createElement("article");
      card.className = "doctor-card";
      const top = document.createElement("div");
      top.className = "doctor-card-top";
      const avatar = document.createElement("div");
      avatar.className = "doctor-card-avatar";
      avatar.textContent = String(doctor.fullName || "Doctor").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
      const title = document.createElement("div");
      title.className = "overflow-hidden";
      const name = document.createElement("div");
      name.className = "doctor-card-name";
      name.textContent = doctor.fullName || "Doctor";
      const specialty = document.createElement("div");
      specialty.className = "doctor-card-specialty";
      specialty.textContent = doctor.specialization || "General practice";
      title.append(name, specialty);
      if (doctor.reviewStatus === "pending") {
        const reviewStatus = document.createElement("span");
        reviewStatus.className = "badge text-bg-warning mt-1";
        reviewStatus.textContent = "Pending review";
        title.appendChild(reviewStatus);
      }
      const room = document.createElement("div");
      room.className = "small text-secondary";
      room.textContent = doctor.roomNumber && doctor.roomNumber !== "Unassigned" ? `Room ${doctor.roomNumber}` : "Room number not assigned";
      top.append(avatar, title);

      const concerns = Array.isArray(doctor.healthConcerns) ? doctor.healthConcerns.filter(Boolean) : [];
      const concernList = concerns.length ? document.createElement("p") : null;
      if (concernList) {
        concernList.className = "small text-secondary mb-0";
        concernList.textContent = `Treats: ${concerns.join(", ")}`;
      }

      const availability = document.createElement("div");
      availability.className = "doctor-card-availability";
      const calendarIcon = document.createElement("i");
      calendarIcon.className = "bi bi-clock";
      const availabilityText = document.createElement("span");
      availabilityText.textContent = doctor.availability || "Contact the hospital for availability.";
      availability.append(calendarIcon, availabilityText);

      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn btn-outline-primary";
      button.innerHTML = '<i class="bi bi-calendar-plus me-2" aria-hidden="true"></i>Book with this doctor';
      button.addEventListener("click", () => openBooking(String(doctor._id)));
      card.append(top, room);
      if (concernList) card.appendChild(concernList);
      card.append(availability, button);
      column.appendChild(card);
      doctorDirectory.appendChild(column);
    });
  }

  async function loadProfile() {
    const profile = byId("profileDetails");
    try {
      const result = await HospitalApi.get("/patients");
      const patient = result.data[0];
      if (!patient) {
        profileComplete = false;
        byId("profileCompletionNotice").classList.remove("d-none");
        profile.textContent = "Your patient profile is not complete yet. Add your details to request an appointment.";
        return;
      }
      profileId = patient._id;
      profileComplete = true;
      byId("profileCompletionNotice").classList.add("d-none");
      profile.replaceChildren();
      [
        ["Patient ID", patient.patientId],
        ["Email", window.currentPatient.email],
        ["Age", patient.age],
        ["Gender", patient.gender],
        ["Phone", patient.phone],
        ["Address", patient.address],
        ["Condition", patient.disease],
        ["Admission date", patient.admissionDate ? new Intl.DateTimeFormat(undefined, { timeZone: "Asia/Kuala_Lumpur", dateStyle: "medium" }).format(new Date(patient.admissionDate)) : "—"]
      ].forEach(([label, value]) => addDetail(profile, label, value));
    } catch (error) {
      profile.textContent = `Unable to load your profile: ${error.message}`;
    }
  }

  function addDetail(container, label, value) {
    const row = document.createElement("div");
    row.className = "d-flex justify-content-between gap-3 border-bottom py-2 patient-profile-detail";
    const name = document.createElement("span");
    name.className = "text-secondary";
    name.textContent = label;
    const detail = document.createElement("strong");
    detail.className = "text-end";
    detail.textContent = value == null || value === "" ? "—" : value;
    row.append(name, detail);
    container.appendChild(row);
  }

  async function loadAppointments() {
    const list = byId("appointmentsList");
    try {
      const result = await HospitalApi.get("/appointments");
      list.replaceChildren();
      if (!result.data.length) {
        const empty = document.createElement("div");
        empty.className = "patient-empty";
        const icon = document.createElement("i");
        icon.className = "bi bi-calendar2-plus";
        const text = document.createElement("span");
        text.textContent = "No appointments yet. Find a doctor below to request your first visit.";
        empty.append(icon, text);
        list.appendChild(empty);
        return;
      }
      result.data.forEach((appointment) => {
        const row = document.createElement("div");
        row.className = "patient-appointment";
        const date = new Intl.DateTimeFormat(undefined, {
          timeZone: "Asia/Kuala_Lumpur", dateStyle: "medium"
        }).format(new Date(appointment.appointmentDate));
        const detail = document.createElement("div");
        const dateText = document.createElement("div");
        dateText.className = "patient-appointment-date";
        dateText.textContent = `${date} · ${appointment.appointmentTime}`;
        const meta = document.createElement("div");
        meta.className = "patient-appointment-meta";
        meta.textContent = appointment.doctor && appointment.doctor.fullName ||
          (appointment.needsDoctorAssignment ? "Reception will assign a doctor" : "Doctor to be assigned");
        const room = document.createElement("div");
        room.className = "patient-appointment-meta";
        const roomNumber = appointment.doctor && appointment.doctor.roomNumber;
        room.textContent = appointment.doctor && roomNumber && roomNumber !== "Unassigned" ? `Room ${roomNumber}` : "";
        detail.append(dateText, meta, room);
        const status = document.createElement("span");
        status.className = `status status-${String(appointment.status).toLowerCase()}`;
        status.textContent = appointment.status;
        row.append(detail, status);
        list.appendChild(row);
      });
    } catch (error) {
      list.textContent = `Unable to load your appointments: ${error.message}`;
    }
  }

  async function loadDoctors() {
    try {
      const result = await HospitalApi.get("/doctors");
      doctors = result.data;
      populateBookingDoctors();
      renderDoctors();
    } catch (error) {
      doctorSelect.replaceChildren(new Option("Doctor list unavailable", ""));
      bookingDoctorHelp.textContent = "Unable to load doctors. Refresh the page to try again.";
      showMessage(doctorDirectory, `Unable to load doctors: ${error.message}. You can retry by refreshing this page.`, "bi-exclamation-circle");
    }
  }

  let user;
  try {
    const session = await HospitalApi.get("/auth/me");
    user = session.data.user;
  } catch (error) {
    byId("profileDetails").textContent = `Unable to verify your sign-in: ${error.message}`;
    byId("appointmentsList").textContent = "Please refresh the page after your sign-in has been verified.";
    showMessage(doctorDirectory, "Sign in again to view the doctor directory and request an appointment.", "bi-person-lock");
    return;
  }

  if (user.role !== "patient") {
    window.location.replace("dashboard.html");
    return;
  }
  window.currentPatient = user;
  profileComplete = Boolean(user.profileId);
  if (!profileComplete) byId("profileCompletionNotice").classList.remove("d-none");
  if (window.initNotifications) window.initNotifications();
  byId("welcomeHeading").textContent = `Welcome, ${user.displayName}`;
  byId("patientIdentity").textContent = `${user.displayName} · Patient`;
  byId("patientAvatar").textContent = user.displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  byId("malaysiaDate").textContent = new Intl.DateTimeFormat(undefined, {
    timeZone: "Asia/Kuala_Lumpur", weekday: "short", month: "short", day: "numeric"
  }).format(new Date());

  const pageLinks = [...document.querySelectorAll(".patient-page-nav a")];
  const setActivePageLink = (id) => {
    pageLinks.forEach((link) => {
      const active = link.hash === `#${id}`;
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  };
  pageLinks.forEach((link) => link.addEventListener("click", () => setActivePageLink(link.hash.slice(1))));
  if ("IntersectionObserver" in window) {
    const pageObserver = new IntersectionObserver((entries) => {
      const visibleSection = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visibleSection) setActivePageLink(visibleSection.target.id);
    }, { rootMargin: "-92px 0px -65% 0px", threshold: [0, 0.25, 0.5, 0.75] });
    pageLinks.forEach((link) => {
      const section = byId(link.hash.slice(1));
      if (section) pageObserver.observe(section);
    });
  }

  searchInput.addEventListener("input", renderDoctors);
  bookingConcern.addEventListener("input", populateBookingDoctors);
  requestReceptionAssignment.addEventListener("change", populateBookingDoctors);
  const careChatPanel = byId("careChatPanel");
  const careChatLauncher = byId("careChatLauncher");
  const openCareChat = async () => {
    careChatPanel.hidden = false;
    careChatLauncher.setAttribute("aria-expanded", "true");
    byId("specialtyGuideInput").focus();
    if (chatMode) {
      await refreshPatientChat();
      if (!chatRefreshTimer) chatRefreshTimer = window.setInterval(refreshPatientChat, 5000);
    }
  };
  const closeCareChat = () => {
    careChatPanel.hidden = true;
    careChatLauncher.setAttribute("aria-expanded", "false");
    if (chatRefreshTimer) {
      window.clearInterval(chatRefreshTimer);
      chatRefreshTimer = null;
    }
  };
  careChatLauncher.addEventListener("click", () => {
    if (careChatPanel.hidden) openCareChat();
    else closeCareChat();
  });
  byId("careChatClose").addEventListener("click", closeCareChat);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !careChatPanel.hidden) closeCareChat();
  });
  byId("careGuideNavLink").addEventListener("click", (event) => {
    event.preventDefault();
    openCareChat();
  });
  byId("specialtyGuideForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const input = byId("specialtyGuideInput");
    const content = input.value.trim();
    if (!content) return;
    if (chatMode) {
      const sendLiveMessage = async () => {
        const button = event.currentTarget.querySelector('button[type="submit"]');
        button.disabled = true;
        try {
          await HospitalApi.post(`/chat/conversations/${encodeURIComponent(chatConversationId)}/messages`, { content });
          input.value = "";
          await refreshPatientChat();
        } catch (error) {
          appendCareChatBubble(`Could not send your message: ${error.message}`, "bot");
        } finally {
          button.disabled = false;
          input.focus();
        }
      };
      sendLiveMessage();
      return;
    }
    appendCareChatBubble(content, "user");
    input.value = "";
    handleCareGuideMessage(content);
  });
  byId("startStaffChatButton").addEventListener("click", startPatientChat);
  window.addEventListener("beforeunload", () => {
    if (chatRefreshTimer) window.clearInterval(chatRefreshTimer);
  });
  byId("bookButton").addEventListener("click", () => openBooking());
  byId("logoutButton").addEventListener("click", async () => {
    try {
      await HospitalApi.post("/auth/logout", {});
      HospitalApi.clearToken();
      window.location.replace("login.html");
    } catch (error) {
      window.alert(`Could not sign out: ${error.message}`);
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorBox.classList.add("d-none");
    errorBox.textContent = "";
    if (!profileId) {
      errorBox.textContent = "Complete your patient profile before requesting an appointment.";
      errorBox.classList.remove("d-none");
      return;
    }
    if (requestReceptionAssignment.checked && !bookingConcern.value.trim()) {
      errorBox.textContent = "Enter your health issue or condition so reception can help find the right doctor.";
      errorBox.classList.remove("d-none");
      return;
    }
    const date = byId("bookingDate").value;
    if (date < getMalaysiaDate()) {
      errorBox.textContent = "Choose today or a future date in Malaysia time.";
      errorBox.classList.remove("d-none");
      return;
    }
    submitButton.disabled = true;
    try {
      const result = await HospitalApi.post("/appointments", {
        doctor: requestReceptionAssignment.checked ? "" : doctorSelect.value,
        needsDoctorAssignment: requestReceptionAssignment.checked,
        healthConcern: bookingConcern.value.trim(),
        appointmentDate: byId("bookingDate").value,
        appointmentTime: byId("bookingTime").value
      });
      if (result.notificationWarning) {
        byId("notificationWarning").textContent = result.notificationWarning;
        byId("notificationWarning").classList.remove("d-none");
      }
      bookingModal.hide();
      form.reset();
      populateBookingDoctors();
      await loadAppointments();
    } catch (error) {
      errorBox.textContent = `Could not request the appointment: ${error.message}`;
      errorBox.classList.remove("d-none");
    } finally {
      submitButton.disabled = Boolean(bookingConcern.value.trim() &&
        !doctors.some((doctor) => matchesDoctor(doctor, bookingConcern.value)) &&
        !requestReceptionAssignment.checked);
    }
  });

  const loadExistingChat = async () => {
    try {
      const result = await HospitalApi.get("/chat/conversations");
      const conversation = result.data.find((item) => item.status === "open");
      if (conversation) {
        chatConversationId = conversation._id;
        byId("careChatModeLabel").textContent = "You have an open reception chat. Click to continue it.";
        byId("startStaffChatButton").textContent = "Continue chat with reception";
      }
    } catch (error) {
      console.error("Could not check for an existing patient chat:", error);
    }
  };
  await Promise.all([loadProfile(), loadAppointments(), loadDoctors(), loadExistingChat()]);
})();
