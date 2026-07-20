import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

// Public endpoint the client-facing quote page calls to render a saved quote.
// No password: the slug itself is the access token for that quote.

export default async (_req: Request, context: Context) => {
  const slug = context.params?.slug;
  if (!slug) {
    return new Response(JSON.stringify({ error: "Missing quote reference." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const store = getStore({ name: "quotes", consistency: "strong" });
  const record = await store.get(slug, { type: "json" });

  if (!record) {
    return new Response(JSON.stringify({ error: "Quote not found." }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(JSON.stringify(record), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
};

export const config: Config = {
  path: "/api/quotes/:slug",
};
