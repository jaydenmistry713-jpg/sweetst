/* Sweet St. — owner-only admin panel.
   Bookings CRM + calendar + quote builder.
   The password is validated server-side by the Netlify functions
   (which read the ADMIN_PASSWORD environment variable). */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var gateShell = $("gateShell");
  var app = $("app");
  var gateForm = $("gateForm");
  var gateStatus = $("gateStatus");
  var quoteForm = $("quoteForm");
  var formStatus = $("formStatus");
  var resultBox = $("resultBox");
  var bookingsList = $("bookingsList");
  var prefillNote = $("prefillNote");
  var sheet = $("sheet");
  var sheetBody = $("sheetBody");
  var sheetTitle = $("sheetTitle");

  var password = "";
  var bookings = [];
  var filter = "all";
  var calCursor = new Date();
  calCursor.setDate(1);
  var selectedDay = "";

  var SERVICES = ["Mini Pancakes", "Waffle Cart", "Gol Gappe & Chaat", "Masala Chai"];

  var SOURCE_LABEL = {
    website: "Website enquiry",
    link: "Booking link",
    manual: "Added manually"
  };

  var STATUS_LABEL = {
    "new": "New",
    quoted: "Quoted",
    confirmed: "Confirmed",
    done: "Done",
    cancelled: "Cancelled"
  };

  /* ---------- Helpers ---------- */

  function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function setStatus(el, type, msg) {
    el.className = "form-status show " + type;
    el.textContent = msg;
  }

  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  function dayKey(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function parseDay(key) {
    if (!key) return null;
    var d = new Date(key + "T00:00:00");
    return isNaN(d.getTime()) ? null : d;
  }

  function formatDate(value, opts) {
    var d = parseDay(value);
    if (!d) return value || "";
    return d.toLocaleDateString("en-GB", opts || { day: "numeric", month: "short", year: "numeric" });
  }

  function formatLong(value) {
    return formatDate(value, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }

  function formatTime(value) {
    if (!value) return "";
    var m = /^(\d{1,2}):(\d{2})/.exec(value);
    if (!m) return value;
    var h = parseInt(m[1], 10);
    var suffix = h >= 12 ? "pm" : "am";
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + (m[2] === "00" ? "" : ":" + m[2]) + suffix;
  }

  function toNumber(v) {
    var n = parseFloat(String(v == null ? "" : v).replace(/[^0-9.]/g, ""));
    return isNaN(n) ? null : n;
  }

  function money(v) {
    var n = toNumber(v);
    if (n === null) return "";
    return "£" + n.toFixed(2).replace(/\.00$/, "");
  }

  function balanceOf(b) {
    var t = toNumber(b.total);
    if (t === null) return "";
    var d = toNumber(b.deposit) || 0;
    return "£" + (t - d).toFixed(2).replace(/\.00$/, "");
  }

  /* UK-friendly WhatsApp number: 07983… -> 447983… */
  function waNumber(phone) {
    var digits = String(phone || "").replace(/[^0-9]/g, "");
    if (!digits) return "";
    if (digits.indexOf("00") === 0) digits = digits.slice(2);
    if (digits.charAt(0) === "0") digits = "44" + digits.slice(1);
    return digits;
  }

  function mapsUrl(location) {
    return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(location);
  }

  function byId(id) {
    for (var i = 0; i < bookings.length; i++) {
      if (bookings[i].id === id) return bookings[i];
    }
    return null;
  }

  /* Sort key: event date, then start time; undated bookings last. */
  function eventSort(a, b) {
    if (!a.date && !b.date) return String(b.createdAt).localeCompare(String(a.createdAt));
    if (!a.date) return 1;
    if (!b.date) return -1;
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return String(a.time || "99:99").localeCompare(String(b.time || "99:99"));
  }

  /* ---------- API ---------- */

  function quotesApi(payload) {
    return fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  }

  function bookingsApi(payload) {
    var body = {};
    for (var k in payload) if (Object.prototype.hasOwnProperty.call(payload, k)) body[k] = payload[k];
    body.password = password;
    return fetch("/api/bookings-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  }

  /* ---------- Gate ---------- */

  function unlock(pw) {
    password = pw;
    try { sessionStorage.setItem("sweetst_admin", pw); } catch (e) {}
    gateShell.classList.add("hidden");
    app.classList.remove("hidden");
    loadBookings();
  }

  gateForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var pw = $("gatePassword").value;
    var btn = gateForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = "Checking…";

    quotesApi({ verify: true, password: pw })
      .then(function (res) {
        if (res.ok) {
          unlock(pw);
        } else if (res.status === 401) {
          setStatus(gateStatus, "err", "Incorrect password. Please try again.");
        } else {
          return res.json().then(function (d) {
            setStatus(gateStatus, "err", d.error || "Something went wrong. Try again.");
          });
        }
      })
      .catch(function () { setStatus(gateStatus, "err", "Network error. Please try again."); })
      .finally(function () {
        btn.disabled = false;
        btn.textContent = "Unlock";
      });
  });

  $("logoutBtn").addEventListener("click", function () {
    try { sessionStorage.removeItem("sweetst_admin"); } catch (e) {}
    location.reload();
  });

  /* Stay unlocked when the phone backgrounds the tab (cleared when it closes). */
  (function restoreSession() {
    var saved = "";
    try { saved = sessionStorage.getItem("sweetst_admin") || ""; } catch (e) {}
    if (!saved) return;
    quotesApi({ verify: true, password: saved }).then(function (res) {
      if (res.ok) unlock(saved);
      else try { sessionStorage.removeItem("sweetst_admin"); } catch (e) {}
    }).catch(function () {});
  })();

  /* ---------- Tabs ---------- */

  var tabs = document.querySelectorAll(".admin-tab");
  var TAB_TITLE = { bookings: "Bookings", calendar: "Calendar", quote: "New quote" };

  function showTab(name) {
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle("is-active", tabs[i].dataset.tab === name);
    }
    $("tab-bookings").classList.toggle("hidden", name !== "bookings");
    $("tab-calendar").classList.toggle("hidden", name !== "calendar");
    $("tab-quote").classList.toggle("hidden", name !== "quote");
    $("barTitle").textContent = TAB_TITLE[name] || "Admin";
    if (name === "calendar") renderCalendar();
    window.scrollTo(0, 0);
  }

  for (var t = 0; t < tabs.length; t++) {
    (function (tab) {
      tab.addEventListener("click", function () { showTab(tab.dataset.tab); });
    })(tabs[t]);
  }

  /* ---------- Sheet ---------- */

  function openSheet(title, html) {
    sheetTitle.textContent = title;
    sheetBody.innerHTML = html;
    sheet.classList.remove("hidden");
    document.body.classList.add("sheet-open");
    sheetBody.scrollTop = 0;
  }

  function closeSheet() {
    sheet.classList.add("hidden");
    document.body.classList.remove("sheet-open");
    sheetBody.innerHTML = "";
  }

  sheet.addEventListener("click", function (e) {
    if (e.target.closest("[data-close]")) closeSheet();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !sheet.classList.contains("hidden")) closeSheet();
  });

  /* ---------- Load ---------- */

  function loadBookings(keepSheet) {
    if (!keepSheet) bookingsList.innerHTML = '<p class="muted">Loading enquiries…</p>';
    return bookingsApi({ action: "list" })
      .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, data: d }; }); })
      .then(function (r) {
        if (!r.ok) {
          bookingsList.innerHTML = '<p class="muted">' + escapeHtml(r.data.error || "Could not load bookings.") + "</p>";
          return;
        }
        bookings = Array.isArray(r.data.bookings) ? r.data.bookings : [];
        renderBookings();
        renderCalendar();
      })
      .catch(function () {
        bookingsList.innerHTML = '<p class="muted">Network error loading bookings.</p>';
      });
  }

  $("refreshBookings").addEventListener("click", function () { loadBookings(); });

  /* ---------- Filter chips ---------- */

  $("statusFilter").addEventListener("click", function (e) {
    var chip = e.target.closest(".chip");
    if (!chip) return;
    filter = chip.dataset.filter;
    var all = this.querySelectorAll(".chip");
    for (var i = 0; i < all.length; i++) all[i].classList.toggle("is-active", all[i] === chip);
    renderBookings();
  });

  /* ---------- Booking card ---------- */

  function quickLinks(b) {
    var out = [];
    if (b.phone) {
      out.push('<a class="quick" href="tel:' + escapeHtml(b.phone.replace(/\s/g, "")) + '">Call</a>');
      var wa = waNumber(b.phone);
      if (wa) out.push('<a class="quick" href="https://wa.me/' + escapeHtml(wa) + '" target="_blank" rel="noopener">WhatsApp</a>');
    }
    if (b.email) out.push('<a class="quick" href="mailto:' + escapeHtml(b.email) + '">Email</a>');
    if (b.location) out.push('<a class="quick" href="' + escapeHtml(mapsUrl(b.location)) + '" target="_blank" rel="noopener">Map</a>');
    return out.length ? '<div class="quick-row">' + out.join("") + "</div>" : "";
  }

  function cardHtml(b) {
    var status = b.status || "new";
    var when = b.date
      ? formatDate(b.date) + (b.time ? " · " + formatTime(b.time) : "")
      : "No date set";
    var bits = [];
    if (b.guests) bits.push(escapeHtml(b.guests) + " guests");
    if ((b.services || []).length) bits.push(escapeHtml(b.services.join(", ")));

    return (
      '<article class="booking-card status-' + escapeHtml(status) + '" data-id="' + escapeHtml(b.id) + '">' +
        '<div class="booking-top">' +
          '<div class="booking-name">' + escapeHtml(b.name) + "</div>" +
          '<span class="booking-badge ' + escapeHtml(status) + '">' + escapeHtml(STATUS_LABEL[status] || status) + "</span>" +
        "</div>" +
        '<div class="booking-when">' + escapeHtml(when) + "</div>" +
        (b.location ? '<div class="booking-where">' + escapeHtml(b.location) + "</div>" : "") +
        (bits.length ? '<div class="booking-bits">' + bits.join(" · ") + "</div>" : "") +
        (status === "confirmed" && balanceOf(b)
          ? '<div class="booking-bal">Balance due <b>' + escapeHtml(balanceOf(b)) + "</b></div>"
          : "") +
        quickLinks(b) +
        '<div class="booking-actions">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-action="open" data-id="' + escapeHtml(b.id) + '">Open</button>' +
          (status === "confirmed" || status === "done"
            ? ""
            : '<button type="button" class="btn btn-primary btn-sm" data-action="confirm" data-id="' + escapeHtml(b.id) + '">Deposit paid</button>') +
        "</div>" +
      "</article>"
    );
  }

  function renderBookings() {
    var list = bookings.slice();
    if (filter !== "all") {
      list = list.filter(function (b) { return (b.status || "new") === filter; });
    }
    list.sort(eventSort);

    if (!list.length) {
      bookingsList.innerHTML =
        '<p class="muted">' +
        (filter === "all"
          ? "No bookings yet. Website enquiries land here automatically — or tap + Add for a phone or WhatsApp booking."
          : "Nothing with this status.") +
        "</p>";
      return;
    }
    bookingsList.innerHTML = list.map(cardHtml).join("");
  }

  /* ---------- Detail sheet ---------- */

  function row(label, value) {
    if (!value) return "";
    return '<div class="d-row"><span>' + escapeHtml(label) + "</span><b>" + escapeHtml(value) + "</b></div>";
  }

  function openDetail(id) {
    var b = byId(id);
    if (!b) return;
    var status = b.status || "new";

    var html =
      '<span class="booking-badge ' + escapeHtml(status) + '">' + escapeHtml(STATUS_LABEL[status] || status) + "</span>" +
      '<h2 class="sheet-name">' + escapeHtml(b.name) + "</h2>" +
      '<div class="d-list">' +
        row("Date", b.date ? formatLong(b.date) : "Not set") +
        row("Time", formatTime(b.time)) +
        row("Location", b.location) +
        row("Guests", b.guests) +
        row("Services", (b.services || []).join(", ")) +
        row("Phone", b.phone) +
        row("Email", b.email) +
        row("Total", money(b.total)) +
        row("Deposit paid", money(b.deposit)) +
        row("Balance due", status === "confirmed" || status === "done" ? balanceOf(b) : "") +
        row("Source", SOURCE_LABEL[b.source] || "Website enquiry") +
      "</div>" +
      quickLinks(b) +
      (b.message ? '<div class="d-block"><span>Their message</span><p>' + escapeHtml(b.message) + "</p></div>" : "") +
      (b.notes ? '<div class="d-block"><span>Notes</span><p>' + escapeHtml(b.notes) + "</p></div>" : "") +
      '<div class="sheet-actions">' +
        (status === "confirmed" || status === "done"
          ? '<button type="button" class="btn btn-ghost btn-sm" data-sheet="confirm" data-id="' + escapeHtml(b.id) + '">Edit amounts</button>'
          : '<button type="button" class="btn btn-primary" data-sheet="confirm" data-id="' + escapeHtml(b.id) + '">Deposit paid — confirm</button>') +
        '<button type="button" class="btn btn-ghost btn-sm" data-sheet="edit" data-id="' + escapeHtml(b.id) + '">Edit details</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-sheet="quote" data-id="' + escapeHtml(b.id) + '">Create quote</button>' +
        (b.quoteSlug
          ? '<a class="btn btn-ghost btn-sm" href="/quote/' + encodeURIComponent(b.quoteSlug) + '" target="_blank" rel="noopener">View quote</a>'
          : "") +
        (status === "done"
          ? '<button type="button" class="link-btn" data-sheet="status" data-status="confirmed" data-id="' + escapeHtml(b.id) + '">Reopen</button>'
          : '<button type="button" class="link-btn" data-sheet="status" data-status="done" data-id="' + escapeHtml(b.id) + '">Mark done</button>') +
        (status === "cancelled"
          ? '<button type="button" class="link-btn" data-sheet="status" data-status="new" data-id="' + escapeHtml(b.id) + '">Un-cancel</button>'
          : '<button type="button" class="link-btn" data-sheet="status" data-status="cancelled" data-id="' + escapeHtml(b.id) + '">Cancel booking</button>') +
        '<button type="button" class="link-btn danger" data-sheet="delete" data-id="' + escapeHtml(b.id) + '">Delete</button>' +
      "</div>" +
      '<div class="form-status" id="sheetStatus" role="status" aria-live="polite"></div>';

    openSheet("Booking", html);
  }

  /* ---------- Confirm (deposit paid) ---------- */

  function openConfirm(id) {
    var b = byId(id);
    if (!b) return;
    var already = b.status === "confirmed" || b.status === "done";

    openSheet(already ? "Amounts" : "Confirm booking",
      '<p class="sheet-lead">' +
        (already
          ? "Update the agreed total or deposit for " + escapeHtml(b.name) + "."
          : "Deposit received? Enter the amounts and confirm — this locks the date in the calendar and emails the confirmation.") +
      "</p>" +
      '<form id="confirmForm">' +
        '<div class="form-grid">' +
          '<div class="field"><label for="cTotal">Agreed total (£)</label>' +
            '<input type="text" inputmode="decimal" id="cTotal" value="' + escapeHtml(b.total || "") + '" placeholder="e.g. 450" /></div>' +
          '<div class="field"><label for="cDeposit">Deposit taken (£)</label>' +
            '<input type="text" inputmode="decimal" id="cDeposit" value="' + escapeHtml(b.deposit || "") + '" placeholder="e.g. 225" /></div>' +
          '<div class="field full"><label for="cNotes">Notes (optional)</label>' +
            '<textarea id="cNotes" placeholder="Parking, setup point, allergies, contact on the day…">' + escapeHtml(b.notes || "") + "</textarea></div>" +
        "</div>" +
        '<p class="balance-preview" id="balPreview"></p>' +
        '<button type="submit" class="btn btn-primary btn-lg" style="width:100%">' +
          (already ? "Save amounts" : "Confirm booking") +
        "</button>" +
        '<div class="form-status" id="confirmStatus" role="status" aria-live="polite"></div>' +
      "</form>"
    );

    var totalEl = $("cTotal");
    var depEl = $("cDeposit");
    var prev = $("balPreview");

    function updatePreview() {
      var t = toNumber(totalEl.value);
      if (t === null) { prev.textContent = ""; return; }
      var d = toNumber(depEl.value) || 0;
      prev.textContent = "Balance due on the day: £" + (t - d).toFixed(2).replace(/\.00$/, "");
    }
    totalEl.addEventListener("input", updatePreview);
    depEl.addEventListener("input", updatePreview);
    updatePreview();

    $("confirmForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var btn = this.querySelector('button[type="submit"]');
      var statusEl = $("confirmStatus");
      btn.disabled = true;
      btn.textContent = "Saving…";

      bookingsApi({
        action: "confirm",
        id: b.id,
        total: totalEl.value,
        deposit: depEl.value,
        notes: $("cNotes").value
      })
        .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, data: d }; }); })
        .then(function (r) {
          if (!r.ok) {
            setStatus(statusEl, "err", r.data.error || "Could not confirm the booking.");
            return;
          }
          return loadBookings(true).then(function () {
            if (r.data.notified) {
              setStatus(statusEl, "ok", "Confirmed. Notification email sent.");
            } else if (r.data.alreadyNotified) {
              setStatus(statusEl, "ok", "Saved. (Notification was already sent for this booking.)");
            } else {
              setStatus(statusEl, "ok", "Confirmed — but the notification email did not send" +
                (r.data.notifyError ? " (" + r.data.notifyError + ")" : "") + ". Let them know manually.");
            }
            setTimeout(closeSheet, 1600);
          });
        })
        .catch(function () { setStatus(statusEl, "err", "Network error. Please try again."); })
        .finally(function () {
          btn.disabled = false;
          btn.textContent = already ? "Save amounts" : "Confirm booking";
        });
    });
  }

  /* ---------- Add / edit booking ---------- */

  function openBookingForm(id) {
    var b = id ? byId(id) : null;
    var editing = Boolean(b);
    b = b || { services: [] };

    var checks = SERVICES.map(function (s) {
      var on = (b.services || []).some(function (v) {
        return String(v).toLowerCase().indexOf(s.split(" ")[0].toLowerCase()) !== -1;
      });
      return '<label class="check"><input type="checkbox" name="bservices" value="' + escapeHtml(s) + '"' +
        (on ? " checked" : "") + "> " + escapeHtml(s) + "</label>";
    }).join("");

    openSheet(editing ? "Edit booking" : "Add booking",
      '<form id="bookingForm">' +
        '<div class="form-grid">' +
          '<div class="field full"><label for="bName">Name *</label><input type="text" id="bName" required value="' + escapeHtml(b.name || "") + '" /></div>' +
          '<div class="field"><label for="bPhone">Phone</label><input type="tel" id="bPhone" value="' + escapeHtml(b.phone || "") + '" /></div>' +
          '<div class="field"><label for="bEmail">Email</label><input type="email" id="bEmail" value="' + escapeHtml(b.email || "") + '" /></div>' +
          '<div class="field"><label for="bDate">Event date</label><input type="date" id="bDate" value="' + escapeHtml(b.date || "") + '" /></div>' +
          '<div class="field"><label for="bTime">Start time</label><input type="time" id="bTime" value="' + escapeHtml(b.time || "") + '" /></div>' +
          '<div class="field full"><label for="bLocation">Venue / address</label><input type="text" id="bLocation" value="' + escapeHtml(b.location || "") + '" placeholder="Full address or venue name" /></div>' +
          '<div class="field"><label for="bGuests">Guests</label><input type="text" id="bGuests" inputmode="numeric" value="' + escapeHtml(b.guests || "") + '" /></div>' +
          '<div class="field"><label for="bTotal">Agreed total (£)</label><input type="text" id="bTotal" inputmode="decimal" value="' + escapeHtml(b.total || "") + '" /></div>' +
          '<div class="field full"><label>Services</label><div class="checks">' + checks + "</div></div>" +
          '<div class="field full"><label for="bNotes">Notes</label><textarea id="bNotes" placeholder="Parking, setup point, allergies, contact on the day…">' + escapeHtml(b.notes || "") + "</textarea></div>" +
        "</div>" +
        '<button type="submit" class="btn btn-primary btn-lg" style="width:100%">' + (editing ? "Save changes" : "Add booking") + "</button>" +
        '<div class="form-status" id="bookingFormStatus" role="status" aria-live="polite"></div>' +
      "</form>"
    );

    $("bookingForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var btn = this.querySelector('button[type="submit"]');
      var statusEl = $("bookingFormStatus");
      var services = [];
      var boxes = this.querySelectorAll('input[name="bservices"]:checked');
      for (var i = 0; i < boxes.length; i++) services.push(boxes[i].value);

      var payload = {
        action: editing ? "update" : "create",
        name: $("bName").value,
        phone: $("bPhone").value,
        email: $("bEmail").value,
        date: $("bDate").value,
        time: $("bTime").value,
        location: $("bLocation").value,
        guests: $("bGuests").value,
        total: $("bTotal").value,
        notes: $("bNotes").value,
        services: services
      };
      if (editing) payload.id = b.id;

      btn.disabled = true;
      btn.textContent = "Saving…";

      bookingsApi(payload)
        .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, data: d }; }); })
        .then(function (r) {
          if (!r.ok) {
            setStatus(statusEl, "err", r.data.error || "Could not save the booking.");
            return;
          }
          return loadBookings(true).then(closeSheet);
        })
        .catch(function () { setStatus(statusEl, "err", "Network error. Please try again."); })
        .finally(function () {
          btn.disabled = false;
          btn.textContent = editing ? "Save changes" : "Add booking";
        });
    });
  }

  $("addBookingBtn").addEventListener("click", function () { openBookingForm(null); });

  /* ---------- Send the booking link ----------
     For enquiries that arrive on WhatsApp or Instagram: instead of copying
     their details out of the chat, send them /book and let them fill it in.
     Their submission lands in this list like any website enquiry, tagged
     "Booking link". The name is optional and only pre-fills the form. */

  function copyToClipboard(input, btn, label) {
    input.select();
    var done = function () {
      btn.textContent = "Copied!";
      setTimeout(function () { btn.textContent = label; }, 1800);
    };
    if (navigator.clipboard) {
      navigator.clipboard.writeText(input.value).then(done, function () {
        document.execCommand("copy");
        done();
      });
    } else {
      document.execCommand("copy");
      done();
    }
  }

  $("shareLinkBtn").addEventListener("click", function () {
    openSheet("Send booking link",
      '<p class="sheet-lead">Send this to anyone who enquired on WhatsApp or Instagram. They fill in their own details and the booking appears here automatically.</p>' +
      '<div class="form-grid">' +
        '<div class="field full"><label for="shareName">Their name (optional)</label>' +
          '<input type="text" id="shareName" placeholder="e.g. Sarah" autocomplete="off" /></div>' +
      "</div>" +
      '<p class="form-note" style="margin-top:0">Adding a name just pre-fills it on the form — they can still change it.</p>' +
      '<div class="result-url">' +
        '<input type="text" id="shareUrl" readonly />' +
        '<button type="button" class="btn btn-primary" id="shareCopy">Copy</button>' +
      "</div>" +
      '<div class="sheet-actions">' +
        '<a class="btn btn-ghost btn-sm" id="shareWa" href="#" target="_blank" rel="noopener">Send on WhatsApp</a>' +
        '<a class="btn btn-ghost btn-sm" id="shareOpen" href="/book" target="_blank" rel="noopener">Preview the form</a>' +
      "</div>"
    );

    var nameEl = $("shareName");
    var urlEl = $("shareUrl");

    function build() {
      var name = nameEl.value.trim();
      var url = window.location.origin + "/book" +
        (name ? "?name=" + encodeURIComponent(name) : "");
      urlEl.value = url;
      $("shareOpen").href = url;
      $("shareWa").href = "https://wa.me/?text=" + encodeURIComponent(
        (name ? "Hi " + name + "! " : "Hi! ") +
        "Pop your event details in here and we'll check the date and send your quote: " + url
      );
    }

    nameEl.addEventListener("input", build);
    build();

    $("shareCopy").addEventListener("click", function () {
      copyToClipboard(urlEl, this, "Copy");
    });
  });

  /* ---------- Card + sheet actions ---------- */

  function handleAction(action, id, extra) {
    if (action === "open") {
      openDetail(id);
    } else if (action === "confirm") {
      openConfirm(id);
    } else if (action === "edit") {
      openBookingForm(id);
    } else if (action === "quote") {
      var b = byId(id);
      if (b) { closeSheet(); prefillQuote(b); }
    } else if (action === "status") {
      bookingsApi({ action: "update", id: id, status: extra })
        .then(function () { return loadBookings(true); })
        .then(function () { if (!sheet.classList.contains("hidden")) openDetail(id); })
        .catch(function () {});
    } else if (action === "delete") {
      if (confirm("Delete this booking? This cannot be undone.")) {
        bookingsApi({ action: "delete", id: id })
          .then(function () { closeSheet(); return loadBookings(true); })
          .catch(function () {});
      }
    }
  }

  bookingsList.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-action]");
    if (!btn) return;
    handleAction(btn.getAttribute("data-action"), btn.getAttribute("data-id"));
  });

  sheetBody.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-sheet]");
    if (!btn) return;
    handleAction(btn.getAttribute("data-sheet"), btn.getAttribute("data-id"), btn.getAttribute("data-status"));
  });

  /* ---------- Calendar ---------- */

  function bookingsOn(key) {
    return bookings.filter(function (b) {
      return b.date === key && b.status !== "cancelled";
    }).sort(function (a, b) { return String(a.time).localeCompare(String(b.time)); });
  }

  function renderNextUp() {
    var today = dayKey(new Date());
    var upcoming = bookings.filter(function (b) {
      return b.date && b.date >= today && b.status !== "cancelled" && b.status !== "done";
    }).sort(eventSort);

    var el = $("nextUp");
    if (!upcoming.length) {
      el.innerHTML = '<div class="next-up empty"><span class="eyebrow">Next up</span><p class="muted">Nothing in the diary yet.</p></div>';
      return;
    }
    var b = upcoming[0];
    var days = Math.round((parseDay(b.date) - parseDay(today)) / 86400000);
    var away = days === 0 ? "Today" : days === 1 ? "Tomorrow" : "In " + days + " days";

    el.innerHTML =
      '<div class="next-up ' + escapeHtml(b.status || "new") + '" data-action="open" data-id="' + escapeHtml(b.id) + '">' +
        '<span class="eyebrow">Next up · ' + escapeHtml(away) + "</span>" +
        '<strong class="next-name">' + escapeHtml(b.name) + "</strong>" +
        '<div class="next-when">' + escapeHtml(formatLong(b.date) + (b.time ? " · " + formatTime(b.time) : "")) + "</div>" +
        (b.location ? '<div class="next-where">' + escapeHtml(b.location) + "</div>" : "") +
        '<span class="booking-badge ' + escapeHtml(b.status || "new") + '">' +
          escapeHtml(STATUS_LABEL[b.status] || "New") + "</span>" +
      "</div>";
  }

  $("nextUp").addEventListener("click", function (e) {
    var card = e.target.closest("[data-action]");
    if (card) handleAction("open", card.getAttribute("data-id"));
  });

  function renderCalendar() {
    renderNextUp();

    var grid = $("calGrid");
    if (!grid) return;
    var year = calCursor.getFullYear();
    var month = calCursor.getMonth();

    $("calMonth").textContent = calCursor.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

    var first = new Date(year, month, 1);
    var offset = (first.getDay() + 6) % 7; // Monday-first
    var days = new Date(year, month + 1, 0).getDate();
    var today = dayKey(new Date());

    var cells = [];
    for (var i = 0; i < offset; i++) cells.push('<span class="cal-cell empty"></span>');

    for (var d = 1; d <= days; d++) {
      var key = year + "-" + pad(month + 1) + "-" + pad(d);
      var on = bookingsOn(key);
      var dots = on.slice(0, 3).map(function (b) {
        return '<i class="dot ' + (b.status === "confirmed" || b.status === "done" ? "confirmed" : "pending") + '"></i>';
      }).join("");

      cells.push(
        '<button type="button" class="cal-cell' +
          (key === today ? " is-today" : "") +
          (key === selectedDay ? " is-selected" : "") +
          (on.length ? " has-events" : "") +
          '" data-day="' + key + '">' +
          "<span>" + d + "</span>" +
          (dots ? '<span class="dots">' + dots + "</span>" : "") +
        "</button>"
      );
    }
    grid.innerHTML = cells.join("");
    renderDayPanel();
  }

  function renderDayPanel() {
    var el = $("dayPanel");
    if (!selectedDay) { el.innerHTML = ""; return; }
    var on = bookingsOn(selectedDay);

    el.innerHTML =
      '<div class="day-head">' +
        "<strong>" + escapeHtml(formatLong(selectedDay)) + "</strong>" +
        (on.length ? '<button type="button" class="link-btn" id="printDay">Print run sheet</button>' : "") +
      "</div>" +
      (on.length
        ? on.map(cardHtml).join("")
        : '<p class="muted">Nothing booked on this day.</p>');

    var printBtn = $("printDay");
    if (printBtn) printBtn.addEventListener("click", function () { printRunSheet(selectedDay); });
  }

  $("calGrid").addEventListener("click", function (e) {
    var cell = e.target.closest(".cal-cell[data-day]");
    if (!cell) return;
    var key = cell.getAttribute("data-day");
    selectedDay = selectedDay === key ? "" : key;
    renderCalendar();
    if (selectedDay) $("dayPanel").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  $("dayPanel").addEventListener("click", function (e) {
    var btn = e.target.closest("[data-action]");
    if (!btn) return;
    handleAction(btn.getAttribute("data-action"), btn.getAttribute("data-id"));
  });

  $("calPrev").addEventListener("click", function () {
    calCursor.setMonth(calCursor.getMonth() - 1);
    renderCalendar();
  });
  $("calNext").addEventListener("click", function () {
    calCursor.setMonth(calCursor.getMonth() + 1);
    renderCalendar();
  });

  /* ---------- Run sheet (print / save as PDF) ---------- */

  function printRunSheet(key) {
    var on = bookingsOn(key);
    if (!on.length) return;

    var jobs = on.map(function (b) {
      return (
        '<section class="rs-job">' +
          '<h2>' + escapeHtml(b.name) + "</h2>" +
          '<table><tbody>' +
            (b.time ? "<tr><th>Time</th><td>" + escapeHtml(formatTime(b.time)) + "</td></tr>" : "") +
            (b.location ? "<tr><th>Address</th><td>" + escapeHtml(b.location) + "</td></tr>" : "") +
            (b.phone ? "<tr><th>Contact</th><td>" + escapeHtml(b.name) + " — " + escapeHtml(b.phone) + "</td></tr>" : "") +
            ((b.services || []).length ? "<tr><th>Services</th><td>" + escapeHtml(b.services.join(", ")) + "</td></tr>" : "") +
            (b.guests ? "<tr><th>Guests</th><td>" + escapeHtml(b.guests) + "</td></tr>" : "") +
            (b.total ? "<tr><th>Total</th><td>" + escapeHtml(money(b.total)) + "</td></tr>" : "") +
            (b.deposit ? "<tr><th>Deposit paid</th><td>" + escapeHtml(money(b.deposit)) + "</td></tr>" : "") +
            (balanceOf(b) ? "<tr><th>Balance due</th><td><b>" + escapeHtml(balanceOf(b)) + "</b></td></tr>" : "") +
            "<tr><th>Status</th><td>" + escapeHtml(STATUS_LABEL[b.status] || "New") + "</td></tr>" +
          "</tbody></table>" +
          (b.notes ? '<div class="rs-notes"><b>Notes</b><p>' + escapeHtml(b.notes) + "</p></div>" : "") +
          (b.message ? '<div class="rs-notes"><b>From the enquiry</b><p>' + escapeHtml(b.message) + "</p></div>" : "") +
        "</section>"
      );
    }).join("");

    $("runsheet").innerHTML =
      '<header class="rs-head">' +
        "<h1>Sweet St. — run sheet</h1>" +
        "<p>" + escapeHtml(formatLong(key)) + " · " + on.length + (on.length === 1 ? " booking" : " bookings") + "</p>" +
      "</header>" + jobs;

    window.print();
  }

  /* ---------- Pre-fill the quote form from a booking ---------- */

  function prefillQuote(b) {
    $("clientName").value = b.name || "";
    $("eventDate").value = b.date || "";
    $("guests").value = b.guests || "";
    $("eventType").value = "";
    $("price").value = b.total || "";
    $("message").value = "";
    $("linkedBookingId").value = b.id || "";

    // Tick the matching service checkboxes (handles "Chai" -> "Masala Chai").
    var joined = (b.services || []).join(" ").toLowerCase();
    var keyword = {
      "Mini Pancakes": "pancake",
      "Waffle Cart": "waffle",
      "Gol Gappe & Chaat": "gappe",
      "Masala Chai": "chai"
    };
    var boxes = quoteForm.querySelectorAll('input[name="services"]');
    for (var i = 0; i < boxes.length; i++) {
      var kw = keyword[boxes[i].value];
      boxes[i].checked = kw ? joined.indexOf(kw) !== -1 : false;
    }

    prefillNote.textContent =
      "Pre-filled from " + (b.name || "this booking") + " — check the price and add a message.";
    prefillNote.classList.remove("hidden");
    resultBox.classList.remove("show");
    formStatus.className = "form-status";
    showTab("quote");
    $("price").focus();
  }

  /* ---------- Build a quote ---------- */

  quoteForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var data = new FormData(quoteForm);
    var linkedId = $("linkedBookingId").value;

    var payload = {
      password: password,
      clientName: data.get("clientName"),
      eventType: data.get("eventType"),
      eventDate: data.get("eventDate"),
      guests: data.get("guests"),
      services: data.getAll("services"),
      price: data.get("price"),
      validUntil: data.get("validUntil"),
      message: data.get("message")
    };

    var btn = quoteForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = "Generating…";
    formStatus.className = "form-status";

    quotesApi(payload)
      .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, status: res.status, data: d }; }); })
      .then(function (r) {
        if (r.ok) {
          $("resultUrl").value = r.data.url;
          $("previewLink").setAttribute("href", r.data.url);
          resultBox.classList.add("show");
          resultBox.scrollIntoView({ behavior: "smooth", block: "center" });
          // Mark the linked booking as quoted (but never downgrade a confirmed one).
          var linked = linkedId ? byId(linkedId) : null;
          if (linked) {
            var fields = { action: "update", id: linkedId, quoteSlug: r.data.slug };
            if (linked.status === "new") fields.status = "quoted";
            bookingsApi(fields).then(function () { return loadBookings(true); }).catch(function () {});
          }
        } else if (r.status === 401) {
          setStatus(formStatus, "err", "Your session expired. Please reload and re-enter the password.");
        } else {
          setStatus(formStatus, "err", r.data.error || "Could not create the quote. Please try again.");
        }
      })
      .catch(function () { setStatus(formStatus, "err", "Network error. Please try again."); })
      .finally(function () {
        btn.disabled = false;
        btn.textContent = "Generate quote link";
      });
  });

  /* ---------- Copy link ---------- */

  $("copyBtn").addEventListener("click", function () {
    copyToClipboard($("resultUrl"), this, "Copy");
  });

  /* ---------- Create another ---------- */

  $("anotherBtn").addEventListener("click", function () {
    quoteForm.reset();
    $("linkedBookingId").value = "";
    prefillNote.classList.add("hidden");
    resultBox.classList.remove("show");
    formStatus.className = "form-status";
    quoteForm.scrollIntoView({ behavior: "smooth", block: "start" });
  });
})();
