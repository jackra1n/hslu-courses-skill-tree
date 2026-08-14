import { auth } from "./auth";
import { handleProgressRequest } from "./progress";

const ALLOWED_ORIGINS = new Set([
  "https://hsluskilltree.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

function json(
  body: unknown,
  status: number,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

// Structured error log: never request bodies, cookies, OAuth tokens, or AppData.
function logError(scope: string, request: Request, error: unknown): void {
  console.error(
    JSON.stringify({
      event: "sync-api-error",
      scope,
      method: request.method,
      path: new URL(request.url).pathname,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message }
          : "unknown",
    }),
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/auth/")) {
      if (request.method === "GET" || request.method === "POST") {
        try {
          return await auth.handler(request);
        } catch (error) {
          logError("auth", request, error);
          return json({ error: "internal" }, 500);
        }
      }
      return json({ error: "method not allowed" }, 405, { Allow: "GET, POST" });
    }

    if (url.pathname === "/api/progress") {
      if (request.method !== "GET" && request.method !== "PUT") {
        return json({ error: "method not allowed" }, 405, {
          Allow: "GET, PUT",
        });
      }
      if (request.method === "PUT") {
        const origin = request.headers.get("Origin");
        if (!origin || !ALLOWED_ORIGINS.has(origin)) {
          return json({ error: "forbidden origin" }, 403);
        }
      }
      try {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session) return json({ error: "unauthorized" }, 401);
        return await handleProgressRequest(request, session.user.id, env.DB);
      } catch (error) {
        logError("progress", request, error);
        return json({ error: "internal" }, 500);
      }
    }

    return json({ error: "not found" }, 404);
  },
} satisfies ExportedHandler<Env>;
