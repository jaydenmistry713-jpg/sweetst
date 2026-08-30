import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

// Public endpoint the contact form calls (in addition to Netlify Forms email)
// so every enquiry is saved to the Bookings store for the admin panel.
// Both the site contact form and the shareable /book page post here; they are
// told apart by `source` (see SOURCES below), which the admin panel displays.

// Only these may be set by a public caller. Anything else (including
// "manual", which means the owner typed it in) falls back to "website".
const SOURCES = ["website", "link"];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let data: Record<string, any>;
  try {
    data = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  // Honeypot: quietly accept (don't store) if the bot field was filled.
  if (data["bot-field"]) return json({ ok: true });

  const name = String(data.name || "").trim();
  if (!name) return json({ error: "Name is required." }, 400);

  const services = Array.isArray(data.services)
    ? data.services
    : Array.isArray(data["items[]"])
      ? data["items[]"]
      : [];

  const source = String(data.source || "").trim();

  const id =
    "bk_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);

  const now = new Date().toISOString();

  const record = {
    id,
    name,
    email: String(data.email || "").trim(),
    phone: String(data.phone || "").trim(),
    guests: String(data.guests ?? "").trim(),
    date: String(data.date || "").trim(),
    time: String(data.time || "").trim(),
    location: String(data.location || "").trim(),
    services: services.map((s: any) => String(s)),
    message: String(data.message || "").trim(),
    notes: "", // internal notes, added in the admin panel
    total: "", // agreed price, set when the booking is confirmed
    deposit: "",
    depositPaidAt: "",
    confirmedAt: "",
    status: "new", // new | quoted | confirmed | done | cancelled
    quoteSlug: "",
    source: SOURCES.indexOf(source) === -1 ? "website" : source,
    createdAt: now,
    updatedAt: now,
  };

  const store = getStore({ name: "bookings", consistency: "strong" });
  await store.setJSON(id, record);

  return json({ ok: true, id }, 201);
};

export const config: Config = {
  path: "/api/bookings",
};
