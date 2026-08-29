import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

// Owner-only endpoint for the admin panel. Password is validated against the
// ADMIN_PASSWORD environment variable (same as the quote builder).
// Actions: list | create | update | confirm | delete.

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const str = (v: unknown) => String(v ?? "").trim();

const STATUSES = ["new", "quoted", "confirmed", "done", "cancelled"];

/* Fields the admin panel is allowed to write on an existing booking. */
const EDITABLE = [
  "name", "email", "phone", "guests", "date", "time",
  "location", "message", "notes", "total", "deposit",
];

const formatDate = (value: string) => {
  if (!value) return "";
  const d = new Date(value + "T00:00:00");
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
};

const money = (v: unknown) => {
  const s = str(v);
  if (!s) return "";
  return /^[£$]/.test(s) ? s : "£" + s;
};

const balanceOf = (rec: any) => {
  const t = parseFloat(String(rec.total).replace(/[^0-9.]/g, ""));
  if (isNaN(t)) return "";
  const d = parseFloat(String(rec.deposit).replace(/[^0-9.]/g, ""));
  return "£" + (t - (isNaN(d) ? 0 : d)).toFixed(2).replace(/\.00$/, "");
};

/* ------------------------------------------------------------------
   Notify the second owner of a newly confirmed booking.

   Netlify has no direct "send an email" API for Functions — its email
   notifications fire on a *Netlify Forms submission*. So we submit the
   hidden `booking-confirmed` form (declared in admin.html so the build
   detects it) and let the dashboard Email notification deliver it.
   ------------------------------------------------------------------ */
async function notifyConfirmed(rec: any) {
  const site = str(Netlify.env.get("URL")) || str(Netlify.env.get("DEPLOY_PRIME_URL"));
  if (!site) return { notified: false, notifyError: "Site URL unavailable." };

  const lines = [
    "Client:    " + rec.name,
    "Date:      " + (formatDate(rec.date) || "not set") + (rec.time ? " at " + rec.time : ""),
    "Location:  " + (rec.location || "not set"),
    "Guests:    " + (rec.guests || "not set"),
    "Services:  " + ((rec.services || []).join(", ") || "not set"),
    "Phone:     " + (rec.phone || "not given"),
    "Email:     " + (rec.email || "not given"),
    "Total:     " + (money(rec.total) || "not set"),
    "Deposit:   " + (money(rec.deposit) || "not set") + " (paid)",
    "Balance:   " + (balanceOf(rec) || "not set"),
  ];
  if (rec.notes) lines.push("", "Notes:", rec.notes);
  if (rec.message) lines.push("", "Original enquiry message:", rec.message);

  const body = new URLSearchParams({
    "form-name": "booking-confirmed",
    // Declared honeypot on the stub form — sending it empty is what marks the
    // submission as human, and keeps Netlify's spam filter off a Function POST
    // that has no browser referer.
    "bot-field": "",
    client: rec.name,
    event: (formatDate(rec.date) || "date TBC") + (rec.time ? " at " + rec.time : ""),
    location: rec.location || "not set",
    details: lines.join("\n"),
  });

  try {
    const res = await fetch(site.replace(/\/$/, "") + "/", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) {
      return { notified: false, notifyError: "Netlify Forms returned " + res.status + "." };
    }
    return { notified: true };
  } catch (err: any) {
    return { notified: false, notifyError: str(err?.message) || "Network error." };
  }
}

export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const adminPassword = Netlify.env.get("ADMIN_PASSWORD");
  if (!adminPassword) {
    return json(
      { error: "Server is not configured. Set the ADMIN_PASSWORD environment variable." },
      500
    );
  }

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  if (body.password !== adminPassword) {
    return json({ error: "Incorrect password." }, 401);
  }

  const store = getStore({ name: "bookings", consistency: "strong" });

  switch (body.action) {
    case "list": {
      const { blobs } = await store.list();
      const items = await Promise.all(
        blobs.map((b) => store.get(b.key, { type: "json" }))
      );
      const bookings = items
        .filter(Boolean)
        .sort((a: any, b: any) => String(b.createdAt).localeCompare(String(a.createdAt)));
      return json({ bookings });
    }

    /* Manually added booking (phone / WhatsApp / Instagram enquiry). */
    case "create": {
      const name = str(body.name);
      if (!name) return json({ error: "Name is required." }, 400);

      const now = new Date().toISOString();
      const id =
        "bk_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);

      const rec = {
        id,
        name,
        email: str(body.email),
        phone: str(body.phone),
        guests: str(body.guests),
        date: str(body.date),
        time: str(body.time),
        location: str(body.location),
        services: Array.isArray(body.services) ? body.services.map(str) : [],
        message: str(body.message),
        notes: str(body.notes),
        total: str(body.total),
        deposit: str(body.deposit),
        depositPaidAt: "",
        confirmedAt: "",
        status: STATUSES.includes(body.status) ? body.status : "new",
        quoteSlug: "",
        source: "manual",
        createdAt: now,
        updatedAt: now,
      };

      await store.setJSON(id, rec);
      return json({ ok: true, booking: rec }, 201);
    }

    case "update": {
      const id = str(body.id);
      if (!id) return json({ error: "Missing booking id." }, 400);
      const rec: any = await store.get(id, { type: "json" });
      if (!rec) return json({ error: "Booking not found." }, 404);

      for (const key of EDITABLE) {
        if (typeof body[key] === "string") rec[key] = body[key].trim();
      }
      if (Array.isArray(body.services)) rec.services = body.services.map(str);
      if (typeof body.status === "string" && STATUSES.includes(body.status)) {
        rec.status = body.status;
      }
      if (typeof body.quoteSlug === "string") rec.quoteSlug = body.quoteSlug;
      rec.updatedAt = new Date().toISOString();

      await store.setJSON(id, rec);
      return json({ ok: true, booking: rec });
    }

    /* Deposit received -> booking is confirmed -> notify the second owner. */
    case "confirm": {
      const id = str(body.id);
      if (!id) return json({ error: "Missing booking id." }, 400);
      const rec: any = await store.get(id, { type: "json" });
      if (!rec) return json({ error: "Booking not found." }, 404);

      if (typeof body.total === "string") rec.total = body.total.trim();
      if (typeof body.deposit === "string") rec.deposit = body.deposit.trim();
      if (typeof body.notes === "string") rec.notes = body.notes.trim();

      const alreadyNotified = Boolean(rec.notifiedAt);
      const now = new Date().toISOString();
      rec.status = "confirmed";
      rec.depositPaidAt = rec.depositPaidAt || now;
      rec.confirmedAt = rec.confirmedAt || now;
      rec.updatedAt = now;

      // Only email on the first confirmation, so re-confirming never re-sends.
      if (alreadyNotified) {
        await store.setJSON(id, rec);
        return json({ ok: true, booking: rec, notified: false, alreadyNotified: true });
      }

      const result = await notifyConfirmed(rec);
      if (result.notified) rec.notifiedAt = now;
      await store.setJSON(id, rec);

      return json({ ok: true, booking: rec, ...result });
    }

    case "delete": {
      const id = str(body.id);
      if (!id) return json({ error: "Missing booking id." }, 400);
      await store.delete(id);
      return json({ ok: true });
    }

    default:
      return json({ error: "Unknown action." }, 400);
  }
};

export const config: Config = {
  path: "/api/bookings-admin",
};
