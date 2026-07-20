import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

// Owner-only endpoint. Validates the admin password (stored as a Netlify
// environment variable) then persists the quote to Netlify Blobs under a
// human-friendly slug and returns the shareable URL.

interface QuotePayload {
  password?: string;
  verify?: boolean;
  clientName?: string;
  eventType?: string;
  eventDate?: string;
  guests?: string;
  services?: string[];
  price?: string;
  message?: string;
  validUntil?: string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const adminPassword = Netlify.env.get("ADMIN_PASSWORD");
  if (!adminPassword) {
    return json(
      { error: "Server is not configured. Set the ADMIN_PASSWORD environment variable." },
      500
    );
  }

  let payload: QuotePayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  if (payload.password !== adminPassword) {
    return json({ error: "Incorrect password." }, 401);
  }

  // Password-only check used by the admin page to unlock the builder UI.
  if (payload.verify) {
    return json({ ok: true }, 200);
  }

  const clientName = (payload.clientName || "").trim();
  if (!clientName) {
    return json({ error: "Client name is required." }, 400);
  }
  if (!payload.price || !String(payload.price).trim()) {
    return json({ error: "A quote price is required." }, 400);
  }

  const store = getStore({ name: "quotes", consistency: "strong" });

  // Build a readable, unique slug: client name (+ event type), then a numeric
  // suffix only if that slug is already taken.
  const base =
    slugify([clientName, payload.eventType].filter(Boolean).join(" ")) || "quote";
  let slug = base;
  let n = 2;
  while (await store.get(slug)) {
    slug = `${base}-${n++}`;
    if (n > 50) {
      slug = `${base}-${Date.now().toString(36)}`;
      break;
    }
  }

  const record = {
    clientName,
    eventType: (payload.eventType || "").trim(),
    eventDate: (payload.eventDate || "").trim(),
    guests: (payload.guests || "").trim(),
    services: Array.isArray(payload.services) ? payload.services : [],
    price: String(payload.price).trim(),
    message: (payload.message || "").trim(),
    validUntil: (payload.validUntil || "").trim(),
    createdAt: new Date().toISOString(),
  };

  await store.setJSON(slug, record);

  const origin = new URL(req.url).origin;
  return json({ slug, url: `${origin}/quote/${slug}` }, 201);
};

export const config: Config = {
  path: "/api/quotes",
};
