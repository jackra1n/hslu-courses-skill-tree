// /api/progress handler: one private snapshot row per authenticated user,
// optimistic revision-based writes. Every response is no-store.

const MAX_BODY_BYTES = 524_288;
const APP_DATA_VERSION = 1;

type SnapshotRow = { data: string; revision: number; updated_at: number };

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

// Reads the request body through a bounded stream, aborting above the limit.
// Never call request.text()/request.json() on an unbounded body.
async function readBoundedBody(request: Request): Promise<string | null> {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  let out = "";
  for (const chunk of chunks)
    out += new TextDecoder().decode(chunk, { stream: true });
  out += new TextDecoder().decode();
  return out;
}

// Accepts exactly { data: unknown, expectedRevision: number | null } with a
// version-1 object snapshot and a null-or-positive-integer revision.
function parsePutBody(
  raw: string,
):
  | { ok: true; body: { data: unknown; expectedRevision: number | null } }
  | { ok: false } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
    return { ok: false };
  const keys = Object.keys(parsed);
  if (
    keys.length !== 2 ||
    !("data" in parsed) ||
    !("expectedRevision" in parsed)
  )
    return { ok: false };
  const { data, expectedRevision } = parsed as {
    data: unknown;
    expectedRevision: unknown;
  };
  if (typeof data !== "object" || data === null || Array.isArray(data))
    return { ok: false };
  if ((data as { version?: unknown }).version !== APP_DATA_VERSION)
    return { ok: false };
  if (
    expectedRevision !== null &&
    (!Number.isInteger(expectedRevision) || (expectedRevision as number) < 1)
  ) {
    return { ok: false };
  }
  return {
    ok: true,
    body: { data, expectedRevision: expectedRevision as number | null },
  };
}

async function getRow(
  db: D1Database,
  userId: string,
): Promise<SnapshotRow | null> {
  const row = await db
    .prepare(
      "SELECT data, revision, updated_at FROM user_data WHERE user_id = ?",
    )
    .bind(userId)
    .first<SnapshotRow>();
  return row ?? null;
}

export async function handleProgressRequest(
  request: Request,
  userId: string,
  db: D1Database,
): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/api/progress") {
    const row = await getRow(db, userId);
    if (!row) return json({ data: null }, 404);
    try {
      return json(
        {
          data: JSON.parse(row.data),
          revision: row.revision,
          updatedAt: row.updated_at,
        },
        200,
      );
    } catch {
      return json({ error: "internal" }, 500);
    }
  }

  if (request.method === "PUT" && url.pathname === "/api/progress") {
    const raw = await readBoundedBody(request);
    if (raw === null) return json({ error: "payload too large" }, 413);
    const parsed = parsePutBody(raw);
    if (!parsed.ok) return json({ error: "invalid body" }, 400);

    const { data, expectedRevision } = parsed.body;
    const updatedAt = Date.now();
    const dataJson = JSON.stringify(data);

    let changed = 0;
    if (expectedRevision === null) {
      const result = await db
        .prepare(
          "INSERT OR IGNORE INTO user_data (user_id, version, data, revision, updated_at) VALUES (?, ?, ?, 1, ?)",
        )
        .bind(userId, APP_DATA_VERSION, dataJson, updatedAt)
        .run();
      changed = result.meta.changes;
    } else {
      const result = await db
        .prepare(
          "UPDATE user_data SET data = ?, version = ?, revision = revision + 1, updated_at = ? WHERE user_id = ? AND revision = ?",
        )
        .bind(dataJson, APP_DATA_VERSION, updatedAt, userId, expectedRevision)
        .run();
      changed = result.meta.changes;
    }

    if (changed === 0) {
      const current = await getRow(db, userId);
      if (!current)
        return json({ data: null, revision: null, updatedAt: null }, 409);
      try {
        return json(
          {
            data: JSON.parse(current.data),
            revision: current.revision,
            updatedAt: current.updated_at,
          },
          409,
        );
      } catch {
        return json({ error: "internal" }, 500);
      }
    }

    return json(
      {
        data,
        revision: expectedRevision === null ? 1 : expectedRevision + 1,
        updatedAt,
      },
      200,
    );
  }

  return json({ error: "method not allowed" }, 405);
}
