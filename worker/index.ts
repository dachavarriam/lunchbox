/** Cloudflare Worker entry point for Lonchera Solo México. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

const jsonHeaders = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
};

function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, {
    ...init,
    headers: { ...jsonHeaders, ...init?.headers },
  });
}

async function handlePublicApi(request: Request, env: Env, url: URL): Promise<Response | null> {
  if (request.method !== "GET") return null;

  if (url.pathname === "/api/health") {
    await env.DB.prepare("SELECT 1").first();
    return json({ ok: true, service: "lonchera", environment: "cloudflare" });
  }

  if (url.pathname === "/api/public/config") {
    const [school, windows] = await Promise.all([
      env.DB.prepare(
        "SELECT slug, name, short_name, timezone, locale, currency FROM schools WHERE slug = ? AND is_active = 1 LIMIT 1",
      ).bind(env.DEFAULT_SCHOOL_SLUG).first(),
      env.DB.prepare(
        "SELECT service_type, label_es, label_en, delivery_time, cutoff_time FROM service_windows WHERE school_id = (SELECT id FROM schools WHERE slug = ?) AND is_active = 1 ORDER BY delivery_time",
      ).bind(env.DEFAULT_SCHOOL_SLUG).all(),
    ]);

    if (!school) return json({ error: "School configuration not found" }, { status: 404 });
    return json({ school, serviceWindows: windows.results });
  }

  if (url.pathname === "/api/public/dishes") {
    const dishes = await env.DB.prepare(
      `SELECT d.id, d.slug, d.name_es, d.name_en, d.description_es, d.description_en,
              d.price_cents, d.image_key, d.emoji, d.badge_es, d.badge_en,
              c.slug AS category_slug, c.name_es AS category_es, c.name_en AS category_en
       FROM dishes d
       JOIN categories c ON c.id = d.category_id
       WHERE d.is_active = 1 AND c.is_active = 1
       ORDER BY c.sort_order, d.name_es`,
    ).all();
    return json({ dishes: dishes.results, mediaBaseUrl: env.PUBLIC_MEDIA_BASE_URL });
  }

  return null;
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    try {
      const apiResponse = await handlePublicApi(request, env, url);
      if (apiResponse) return apiResponse;
    } catch (error) {
      console.error(JSON.stringify({
        message: "public_api_failed",
        path: url.pathname,
        error: error instanceof Error ? error.message : "unknown_error",
      }));
      return json({ error: "Internal server error" }, { status: 500 });
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const outputFormat = format === "image/png" || format === "image/jpeg" || format === "image/avif"
            ? format
            : "image/webp";
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format: outputFormat, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker satisfies ExportedHandler<Env>;
