/* Owner-only quote builder + bookings.
   Password is validated server-side by the Netlify functions
   (which read the ADMIN_PASSWORD environment variable). */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const gate = $("gate");
  const builder = $("builder");
  const gateForm = $("gateForm");
  const gateStatus = $("gateStatus");
  const quoteForm = $("quoteForm");
  const formStatus = $("formStatus");
  const resultBox = $("resultBox");
  const bookingsList = $("bookingsList");
  const prefillNote = $("prefillNote");

  let password = "";
  let bookings = [];

  const setStatus = (el, type, msg) => {
    el.className = "form-status show " + type;
    el.textContent = msg;
  };

  const escapeHtml = (str) => {
    const d = document.createElement("div");
    d.textContent = str == null ? "" : String(str);
    return d.innerHTML;
  };

  const formatDate = (value) => {
    if (!value) return "";
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  };

  const quotesApi = (payload) =>
    fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

  const bookingsApi = (payload) =>
    fetch("/api/bookings-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({ password: password }, payload)),
    });

  /* ---------- Gate ---------- */
  gateForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const pw = $("gatePassword").value;
    const btn = gateForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = "Checking…";

    quotesApi({ verify: true, password: pw })
      .then((res) => {
        if (res.ok) {
          password = pw;
          gate.classList.add("hidden");
          builder.classList.remove("hidden");
          loadBookings();
        } else if (res.status === 401) {
          setStatus(gateStatus, "err", "Incorrect password. Please try again.");
        } else {
          return res.json().then((d) => {
            setStatus(gateStatus, "err", d.error || "Something went wrong. Try again.");
          });
        }
      })
      .catch(() => setStatus(gateStatus, "err", "Network error. Please try again."))
      .finally(() => {
        btn.disabled = false;
        btn.textContent = "Unlock";
      });
  });

  /* ---------- Tabs ---------- */
  const tabs = document.querySelectorAll(".admin-tab");
  const showTab = (name) => {
    tabs.forEach((t) => t.classList.toggle("is-active", t.dataset.tab === name));
    $("tab-bookings").classList.toggle("hidden", name !== "bookings");
    $("tab-quote").classList.toggle("hidden", name !== "quote");
  };
  tabs.forEach((t) => t.addEventListener("click", () => showTab(t.dataset.tab)));

  /* ---------- Bookings ---------- */
  const refreshBtn = $("refreshBookings");
  if (refreshBtn) refreshBtn.addEventListener("click", loadBookings);

  function loadBookings() {
    bookingsList.innerHTML = '<p class="muted">Loading enquiries…</p>';
    bookingsApi({ action: "list" })
      .then((res) => res.json().then((d) => ({ ok: res.ok, data: d })))
      .then(({ ok, data }) => {
        if (!ok) {
          bookingsList.innerHTML =
            '<p class="muted">' + escapeHtml(data.error || "Could not load bookings.") + "</p>";
          return;
        }
        bookings = Array.isArray(data.bookings) ? data.bookings : [];
        renderBookings();
      })
      .catch(() => {
        bookingsList.innerHTML = '<p class="muted">Network error loading bookings.</p>';
      });
  }

  function renderBookings() {
    if (!bookings.length) {
      bookingsList.innerHTML =
        '<p class="muted">No enquiries yet. New enquiries from the contact form will appear here.</p>';
      return;
    }

    bookingsList.innerHTML = bookings
      .map((b) => {
        const quoted = b.status === "quoted";
        const services = (b.services || [])
          .map((s) => "<span>" + escapeHtml(s) + "</span>")
          .join("");
        const meta = [];
        if (b.date) meta.push("<b>Date:</b> " + escapeHtml(formatDate(b.date)) + (b.time ? " · " + escapeHtml(b.time) : ""));
        if (b.guests) meta.push("<b>Guests:</b> " + escapeHtml(b.guests));
        if (b.location) meta.push("<b>Location:</b> " + escapeHtml(b.location));
        if (b.email) meta.push("<b>Email:</b> " + escapeHtml(b.email));
        if (b.phone) meta.push("<b>Phone:</b> " + escapeHtml(b.phone));

        return (
          '<article class="booking-card' + (quoted ? " is-quoted" : "") + '">' +
          '<div class="booking-top">' +
          '<div class="booking-name">' + escapeHtml(b.name) + "</div>" +
          '<span class="booking-badge ' + (quoted ? "quoted" : "new") + '">' +
          (quoted ? "Quoted" : "New") + "</span>" +
          "</div>" +
          (meta.length ? '<div class="booking-meta">' + meta.join("") + "</div>" : "") +
          (services ? '<div class="booking-services">' + services + "</div>" : "") +
          (b.message ? '<div class="booking-message">' + escapeHtml(b.message) + "</div>" : "") +
          '<div class="booking-actions">' +
          '<button type="button" class="btn btn-primary btn-arrow" data-action="quote" data-id="' + escapeHtml(b.id) + '">Create quote</button>' +
          (quoted
            ? '<button type="button" class="link-btn" data-action="reopen" data-id="' + escapeHtml(b.id) + '">Mark as new</button>'
            : '<button type="button" class="link-btn" data-action="mark-quoted" data-id="' + escapeHtml(b.id) + '">Mark quoted</button>') +
          (quoted && b.quoteSlug
            ? '<a class="link-btn" href="/quote/' + encodeURIComponent(b.quoteSlug) + '" target="_blank" rel="noopener">View quote</a>'
            : "") +
          '<button type="button" class="link-btn" data-action="delete" data-id="' + escapeHtml(b.id) + '">Delete</button>' +
          "</div>" +
          "</article>"
        );
      })
      .join("");
  }

  bookingsList.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const id = btn.getAttribute("data-id");
    const action = btn.getAttribute("data-action");
    const booking = bookings.find((b) => b.id === id);

    if (action === "quote") {
      if (booking) prefillQuote(booking);
    } else if (action === "mark-quoted") {
      updateBooking(id, { status: "quoted" });
    } else if (action === "reopen") {
      updateBooking(id, { status: "new" });
    } else if (action === "delete") {
      if (confirm("Delete this enquiry? This cannot be undone.")) {
        bookingsApi({ action: "delete", id })
          .then(() => loadBookings())
          .catch(() => {});
      }
    }
  });

  function updateBooking(id, fields) {
    bookingsApi(Object.assign({ action: "update", id }, fields))
      .then(() => loadBookings())
      .catch(() => {});
  }

  /* ---------- Pre-fill the quote form from a booking ---------- */
  function prefillQuote(b) {
    $("clientName").value = b.name || "";
    $("eventDate").value = b.date || "";
    $("guests").value = b.guests || "";
    $("eventType").value = "";
    $("price").value = "";
    $("message").value = "";
    $("linkedBookingId").value = b.id || "";

    // Tick the matching service checkboxes (handles "Chai" -> "Masala Chai").
    const joined = (b.services || []).join(" ").toLowerCase();
    const keyword = {
      "Mini Pancakes": "pancake",
      "Waffle Cart": "waffle",
      "Gol Gappe & Chaat": "gappe",
      "Masala Chai": "chai",
    };
    quoteForm.querySelectorAll('input[name="services"]').forEach((cb) => {
      const kw = keyword[cb.value];
      cb.checked = kw ? joined.indexOf(kw) !== -1 : false;
    });

    prefillNote.textContent = "Pre-filled from " + (b.name || "this enquiry") + " — just add a price and message.";
    prefillNote.classList.remove("hidden");
    resultBox.classList.remove("show");
    formStatus.className = "form-status";
    showTab("quote");
    $("price").focus();
  }

  /* ---------- Build a quote ---------- */
  quoteForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(quoteForm);
    const services = data.getAll("services");
    const linkedId = $("linkedBookingId").value;

    const payload = {
      password: password,
      clientName: data.get("clientName"),
      eventType: data.get("eventType"),
      eventDate: data.get("eventDate"),
      guests: data.get("guests"),
      services: services,
      price: data.get("price"),
      validUntil: data.get("validUntil"),
      message: data.get("message"),
    };

    const btn = quoteForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = "Generating…";
    formStatus.className = "form-status";

    quotesApi(payload)
      .then((res) => res.json().then((d) => ({ ok: res.ok, status: res.status, data: d })))
      .then(({ ok, status, data: d }) => {
        if (ok) {
          $("resultUrl").value = d.url;
          $("previewLink").setAttribute("href", d.url);
          resultBox.classList.add("show");
          resultBox.scrollIntoView({ behavior: "smooth", block: "center" });
          // Mark the linked booking as quoted.
          if (linkedId) {
            bookingsApi({ action: "update", id: linkedId, status: "quoted", quoteSlug: d.slug })
              .then(() => loadBookings())
              .catch(() => {});
          }
        } else if (status === 401) {
          setStatus(formStatus, "err", "Your session expired. Please reload and re-enter the password.");
        } else {
          setStatus(formStatus, "err", d.error || "Could not create the quote. Please try again.");
        }
      })
      .catch(() => setStatus(formStatus, "err", "Network error. Please try again."))
      .finally(() => {
        btn.disabled = false;
        btn.textContent = "Generate quote link";
      });
  });

  /* ---------- Copy link ---------- */
  $("copyBtn").addEventListener("click", () => {
    const input = $("resultUrl");
    input.select();
    const done = () => {
      $("copyBtn").textContent = "Copied!";
      setTimeout(() => ($("copyBtn").textContent = "Copy"), 1800);
    };
    if (navigator.clipboard) {
      navigator.clipboard.writeText(input.value).then(done, () => {
        document.execCommand("copy");
        done();
      });
    } else {
      document.execCommand("copy");
      done();
    }
  });

  /* ---------- Create another ---------- */
  $("anotherBtn").addEventListener("click", () => {
    quoteForm.reset();
    $("linkedBookingId").value = "";
    prefillNote.classList.add("hidden");
    resultBox.classList.remove("show");
    formStatus.className = "form-status";
    quoteForm.scrollIntoView({ behavior: "smooth", block: "start" });
  });
})();
