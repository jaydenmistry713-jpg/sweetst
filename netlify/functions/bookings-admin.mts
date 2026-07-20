import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

// Owner-only endpoint for the admin Bookings tab. Password is validated against
// the ADMIN_PASSWORD environment variable (same as the quote builder).
// Actions: list | update | delete.

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

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

    case "update": {
      const id = String(body.id || "");
      if (!id) return json({ error: "Missing booking id." }, 400);
      const rec: any = await store.get(id, { type: "json" });
      if (!rec) return json({ error: "Booking not found." }, 404);
      if (typeof body.status === "string") rec.status = body.status;
      if (typeof body.quoteSlug === "string") rec.quoteSlug = body.quoteSlug;
      await store.setJSON(id, rec);
      return json({ ok: true });
    }

    case "delete": {
      const id = String(body.id || "");
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
