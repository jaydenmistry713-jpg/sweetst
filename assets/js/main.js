/* ============================================================
   Sweet St. — shared front-end behaviour
   All features are guarded so any page can include this file.
   ============================================================ */
(function () {
  "use strict";

  /* ---------- Sticky header state ---------- */
  const header = document.querySelector(".site-header");
  if (header) {
    const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---------- Mobile navigation ---------- */
  const root = document.documentElement;
  const toggle = document.querySelector(".nav-toggle");
  const backdrop = document.querySelector(".nav-backdrop");
  const closeNav = () => root.classList.remove("nav-open");
  if (toggle) {
    toggle.addEventListener("click", () => {
      root.classList.toggle("nav-open");
      const open = root.classList.contains("nav-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
  }
  if (backdrop) backdrop.addEventListener("click", closeNav);
  document.querySelectorAll(".nav-links a").forEach((a) => a.addEventListener("click", closeNav));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeNav();
  });

  /* ---------- Scroll reveal ---------- */
  const reveals = document.querySelectorAll(".reveal");
  if (reveals.length) {
    if (!("IntersectionObserver" in window)) {
      reveals.forEach((el) => el.classList.add("in"));
    } else {
      const io = new IntersectionObserver(
        (entries, obs) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("in");
              obs.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -80px 0px" }
      );
      reveals.forEach((el) => io.observe(el));
    }
  }

  /* ---------- Lazy videos: load & play only when in view ----------
     Videos use preload="none" (no download until needed). We play them when
     they scroll near the viewport and pause when they leave, so the page
     doesn't fetch or decode a dozen clips on initial load. */
  const lazyVideos = document.querySelectorAll('video[preload="none"]');
  if (lazyVideos.length) {
    const playSafe = (v) => {
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    };
    if (!("IntersectionObserver" in window)) {
      lazyVideos.forEach(playSafe);
    } else {
      const vObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) playSafe(entry.target);
            else entry.target.pause();
          });
        },
        { rootMargin: "250px 0px", threshold: 0.15 }
      );
      lazyVideos.forEach((v) => vObserver.observe(v));
    }
  }

  /* ---------- Marquee / ticker: seamless loop ----------
     The CSS animates the track to translateX(-50%). That only loops with no gap
     if the track is an EVEN number of identical copies AND one half is at least
     as wide as the container — otherwise a gap appears at the reset point on
     wide screens. So we duplicate the original set enough times to cover ~2x the
     container width, rounded up to an even number of copies. */
  const buildMarquee = (track) => {
    const container = track.parentElement;
    const original = Array.from(track.children).filter((el) => !el.hasAttribute("aria-hidden"));
    if (!original.length) return;
    // Remove any previous clones (e.g. on resize) before re-measuring.
    Array.from(track.children).forEach((el) => {
      if (el.hasAttribute("aria-hidden")) el.remove();
    });
    const setWidth = track.scrollWidth;
    const containerWidth = (container && container.clientWidth) || window.innerWidth;
    if (!setWidth) return;
    let copies = Math.max(2, Math.ceil((containerWidth * 2) / setWidth));
    if (copies % 2 !== 0) copies += 1;
    for (let c = 1; c < copies; c++) {
      original.forEach((el) => {
        const clone = el.cloneNode(true);
        clone.setAttribute("aria-hidden", "true");
        track.appendChild(clone);
      });
    }
  };

  const marqueeTracks = document.querySelectorAll(".marquee-track, .ticker-track");
  if (marqueeTracks.length) {
    marqueeTracks.forEach(buildMarquee);
    // Re-fit once webfonts have loaded (text width can change) and on resize.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => marqueeTracks.forEach(buildMarquee));
    }
    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => marqueeTracks.forEach(buildMarquee), 250);
    });
  }

  /* ---------- Gallery lightbox ---------- */
  const lightbox = document.querySelector("[data-lightbox]");
  if (lightbox) {
    const imgEl = lightbox.querySelector("img");
    const items = Array.from(document.querySelectorAll("[data-gallery] img"));
    const sources = items.map((i) => i.getAttribute("data-full") || i.src);
    let index = 0;

    const show = (i) => {
      index = (i + sources.length) % sources.length;
      imgEl.src = sources[index];
    };
    const open = (i) => {
      show(i);
      lightbox.classList.add("open");
      document.body.style.overflow = "hidden";
    };
    const close = () => {
      lightbox.classList.remove("open");
      document.body.style.overflow = "";
    };

    items.forEach((img, i) => {
      const parent = img.closest("[data-gallery]") || img;
      parent.style.cursor = "pointer";
      parent.addEventListener("click", () => open(i));
      parent.setAttribute("role", "button");
      parent.setAttribute("tabindex", "0");
      parent.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open(i);
        }
      });
    });

    lightbox.addEventListener("click", (e) => {
      if (e.target === lightbox || e.target.hasAttribute("data-lb-close")) close();
    });
    const prevBtn = lightbox.querySelector("[data-lb-prev]");
    const nextBtn = lightbox.querySelector("[data-lb-next]");
    if (prevBtn) prevBtn.addEventListener("click", () => show(index - 1));
    if (nextBtn) nextBtn.addEventListener("click", () => show(index + 1));
    document.addEventListener("keydown", (e) => {
      if (!lightbox.classList.contains("open")) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") show(index - 1);
      if (e.key === "ArrowRight") show(index + 1);
    });
  }

  /* ---------- Booking form (Netlify Forms) ---------- */
  const form = document.querySelector("form[data-booking]");
  if (form) {
    const status = form.querySelector(".form-status");
    const btn = form.querySelector('button[type="submit"]');
    const btnText = btn ? btn.textContent : "";

    const setStatus = (type, msg) => {
      if (!status) return;
      status.className = "form-status show " + type;
      status.textContent = msg;
    };

    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const checks = form.querySelectorAll('input[name="items[]"]');
      if (checks.length && !Array.from(checks).some((c) => c.checked)) {
        setStatus("err", "Please choose at least one service so we can tailor your quote.");
        return;
      }

      if (btn) {
        btn.disabled = true;
        btn.textContent = "Sending…";
      }

      // Save the enquiry to the Bookings store too (best-effort; the Netlify
      // email below is the primary path and drives the success message).
      const fd = new FormData(form);
      fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fd.get("name"),
          email: fd.get("email"),
          phone: fd.get("phone"),
          guests: fd.get("guests"),
          date: fd.get("date"),
          time: fd.get("time"),
          location: fd.get("location"),
          services: fd.getAll("items[]"),
          message: fd.get("message"),
          "bot-field": fd.get("bot-field") || "",
        }),
      }).catch(() => {});

      fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(new FormData(form)).toString(),
      })
        .then((res) => {
          if (!res.ok) throw new Error("Network response was not ok");
          form.reset();
          setStatus(
            "ok",
            "Thank you! Your enquiry is in — we’ll be in touch within 24 hours with your tailored quote."
          );
          if (status) status.scrollIntoView({ behavior: "smooth", block: "center" });
        })
        .catch(() => {
          setStatus(
            "err",
            "Something went wrong sending your enquiry. Please try again, or message us on WhatsApp."
          );
        })
        .finally(() => {
          if (btn) {
            btn.disabled = false;
            btn.textContent = btnText;
          }
        });
    });
  }

  /* ---------- Footer year ---------- */
  const yearEl = document.querySelector("[data-year]");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();
