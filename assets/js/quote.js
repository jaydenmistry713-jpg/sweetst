/* Client-facing quote viewer.
   URL shape: /quote/<slug>  (rewritten to /quote.html by netlify.toml)
   Fetches the saved quote from the get-quote function and renders it. */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const loading = $("loadingState");
  const errorState = $("errorState");
  const doc = $("quoteDoc");

  const showError = () => {
    loading.classList.add("hidden");
    doc.classList.add("hidden");
    errorState.classList.remove("hidden");
  };

  // Derive the slug from the pretty path, falling back to ?slug= or ?ref=.
  function getSlug() {
    const parts = window.location.pathname.split("/").filter(Boolean);
    // e.g. ["quote", "sarah-wedding"]  or  ["quote.html"]
    if (parts.length >= 2 && parts[0] === "quote") return decodeURIComponent(parts[1]);
    const params = new URLSearchParams(window.location.search);
    return params.get("slug") || params.get("ref") || "";
  }

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str == null ? "" : String(str);
    return d.innerHTML;
  }

  function formatDate(value) {
    if (!value) return "";
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  }

  function formatPrice(value) {
    const raw = String(value).trim();
    // If it's purely a number, prefix with £. Otherwise show exactly as entered.
    if (/^\d+(\.\d{1,2})?$/.test(raw)) {
      return "£" + Number(raw).toLocaleString("en-GB");
    }
    return raw;
  }

  const slug = getSlug();
  if (!slug || slug === "quote.html") {
    showError();
    return;
  }

  fetch("/api/quotes/" + encodeURIComponent(slug), { headers: { accept: "application/json" } })
    .then((res) => {
      if (!res.ok) throw new Error("not found");
      return res.json();
    })
    .then((q) => {
      $("qClientName").textContent = q.clientName || "Your quote";
      $("qRef").textContent = slug;

      if (q.eventType) {
        $("qEventType").textContent = q.eventType;
        $("qEventTypeWrap").classList.remove("hidden");
      }
      if (q.eventDate) {
        $("qEventDate").textContent = formatDate(q.eventDate);
        $("qEventDateWrap").classList.remove("hidden");
      }
      if (q.guests) {
        $("qGuests").textContent = q.guests;
        $("qGuestsWrap").classList.remove("hidden");
      }

      const services = Array.isArray(q.services) ? q.services.filter(Boolean) : [];
      if (services.length) {
        $("qServices").innerHTML = services.map((s) => "<span>" + escapeHtml(s) + "</span>").join("");
      } else {
        $("qServicesBlock").classList.add("hidden");
      }

      if (q.message) {
        $("qMessage").textContent = q.message;
        $("qMessageBlock").classList.remove("hidden");
      }

      $("qPrice").textContent = formatPrice(q.price);

      if (q.validUntil) {
        $("qValid").textContent = formatDate(q.validUntil);
        $("qValidWrap").classList.remove("hidden");
      }

      // Accept button pre-fills an email to confirm the booking.
      const subject = encodeURIComponent(
        "Accepting my Sweet St. quote (" + (q.clientName || slug) + ")"
      );
      const body = encodeURIComponent(
        "Hi Sweet St.,\n\nI'd like to accept the quote you sent me (ref: " +
          slug +
          ").\n\nPlease let me know the next steps to confirm my booking.\n\nThank you!"
      );
      $("qAccept").setAttribute(
        "href",
        "mailto:sweetstuk@outlook.com?subject=" + subject + "&body=" + body
      );

      document.title = (q.clientName ? q.clientName + " — " : "") + "Your Quote | Sweet St.";

      loading.classList.add("hidden");
      doc.classList.remove("hidden");
    })
    .catch(showError);
})();
