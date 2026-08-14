import { beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { handleProgressRequest } from "../progress";
import { applyMigrations, resetTestData, seedUser } from "./apply-migrations";

const SNAPSHOT = {
  version: 1,
  currentTemplateId: "bsc-informatik",
  start: { season: "HS", year: 2026 },
  studyPlans: {},
  slotStatus: {},
  preferences: {
    showShortNamesOnly: false,
    showCourseTypeBadges: false,
    theme: "light",
  },
};

function request(
  method: string,
  body?: unknown,
  url = "https://hsluskilltree.com/api/progress",
): Request {
  const init: RequestInit = { method };
  if (body !== undefined) init.body = JSON.stringify(body);
  return new Request(url, init);
}

async function put(
  userId: string,
  data: unknown,
  expectedRevision: number | null,
) {
  await seedUser(userId);
  return handleProgressRequest(
    request("PUT", { data, expectedRevision }),
    userId,
    env.DB,
  );
}

beforeEach(async () => {
  await applyMigrations();
  await resetTestData();
});

describe("handleProgressRequest", () => {
  it("returns 404 with data null when no row exists", async () => {
    const res = await handleProgressRequest(request("GET"), "user-1", env.DB);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ data: null });
  });

  it("creates revision 1 on first PUT with null revision and GET returns the snapshot", async () => {
    const putRes = await put("user-1", SNAPSHOT, null);
    expect(putRes.status).toBe(200);
    const putBody = (await putRes.json()) as {
      revision: number;
      updatedAt: number;
    };
    expect(putBody).toMatchObject({ data: SNAPSHOT, revision: 1 });
    expect(typeof putBody.updatedAt).toBe("number");

    const getRes = await handleProgressRequest(
      request("GET"),
      "user-1",
      env.DB,
    );
    expect(getRes.status).toBe(200);
    expect(await getRes.json()).toEqual({
      data: SNAPSHOT,
      revision: 1,
      updatedAt: putBody.updatedAt,
    });
  });
  it("increments revision on matching update", async () => {
    await put("user-1", SNAPSHOT, null);
    const next = { ...SNAPSHOT, slotStatus: { "slot-1": "completed" } };
    const res = await put("user-1", next, 1);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ data: next, revision: 2 });

    const getRes = await handleProgressRequest(
      request("GET"),
      "user-1",
      env.DB,
    );
    const getBody = (await getRes.json()) as { revision: number };
    expect(getBody.revision).toBe(2);
  });

  it("returns 409 with current data for stale and concurrent revisions", async () => {
    await put("user-1", SNAPSHOT, null);
    await put("user-1", { ...SNAPSHOT, slotStatus: { a: "completed" } }, 1);

    // stale: writer still believes revision 1
    const stale = await put(
      "user-1",
      { ...SNAPSHOT, slotStatus: { b: "attended" } },
      1,
    );
    expect(stale.status).toBe(409);
    const staleBody = await stale.json();
    expect(staleBody).toMatchObject({
      revision: 2,
      data: { slotStatus: { a: "completed" } },
    });

    // concurrent: two writers at the same revision, second one loses
    await put("user-2", SNAPSHOT, null);
    const concurrent = await put(
      "user-2",
      { ...SNAPSHOT, slotStatus: { c: "attended" } },
      1,
    );
    expect(concurrent.status).toBe(200);
    const loser = await put(
      "user-2",
      { ...SNAPSHOT, slotStatus: { d: "attended" } },
      1,
    );
    expect(loser.status).toBe(409);
    const loserBody = (await loser.json()) as {
      data: { slotStatus: Record<string, string> };
    };
    expect(loserBody.data.slotStatus).toEqual({ c: "attended" });
  });

  it("never reads or updates another users row", async () => {
    await put("user-1", SNAPSHOT, null);
    await put("user-1", { ...SNAPSHOT, slotStatus: { x: "completed" } }, 1);

    const otherGet = await handleProgressRequest(
      request("GET"),
      "user-2",
      env.DB,
    );
    expect(otherGet.status).toBe(404);

    const otherPut = await put(
      "user-2",
      { ...SNAPSHOT, slotStatus: { y: "attended" } },
      null,
    );
    expect(otherPut.status).toBe(200);

    const first = await handleProgressRequest(request("GET"), "user-1", env.DB);
    const firstBody = (await first.json()) as {
      data: { slotStatus: Record<string, string> };
    };
    expect(firstBody.data.slotStatus).toEqual({ x: "completed" });
  });

  it("rejects malformed and version-mismatched payloads with 400", async () => {
    const cases = [
      "not json",
      JSON.stringify({ data: SNAPSHOT }), // missing expectedRevision
      JSON.stringify({ data: SNAPSHOT, expectedRevision: null, extra: 1 }),
      JSON.stringify({ data: "not-an-object", expectedRevision: null }),
      JSON.stringify({ data: null, expectedRevision: null }),
      JSON.stringify({ data: [SNAPSHOT], expectedRevision: null }),
      JSON.stringify({
        data: { ...SNAPSHOT, version: 2 },
        expectedRevision: null,
      }),
      JSON.stringify({ data: SNAPSHOT, expectedRevision: 0 }),
      JSON.stringify({ data: SNAPSHOT, expectedRevision: -3 }),
      JSON.stringify({ data: SNAPSHOT, expectedRevision: 1.5 }),
      JSON.stringify({ data: SNAPSHOT, expectedRevision: "1" }),
    ];
    for (const body of cases) {
      const res = await handleProgressRequest(
        request("PUT", body),
        "user-1",
        env.DB,
      );
      expect(res.status).toBe(400);
    }
  });

  it("rejects oversized payloads with 413 before parsing", async () => {
    const big = new Request("https://hsluskilltree.com/api/progress", {
      method: "PUT",
      body: "x".repeat(600_000),
    });
    const res = await handleProgressRequest(big, "user-1", env.DB);
    expect(res.status).toBe(413);
  });

  it("accepts payloads just under the size limit", async () => {
    await seedUser("user-1");
    const body = JSON.stringify({
      data: {
        ...SNAPSHOT,
        slotStatus: { ["slot-" + "p".repeat(500_000)]: "attended" },
      },
      expectedRevision: null,
    });
    expect(body.length).toBeLessThanOrEqual(524_288);
    const res = await handleProgressRequest(
      new Request("https://hsluskilltree.com/api/progress", {
        method: "PUT",
        body,
      }),
      "user-1",
      env.DB,
    );
    expect(res.status).toBe(200);
  });

  it("keeps SQL-like strings as inert bound data", async () => {
    const malicious = {
      ...SNAPSHOT,
      slotStatus: {
        "'; DROP TABLE user_data; --": "attended",
        'a" OR 1=1 --': "completed",
      },
    };
    const res = await put("user-1", malicious, null);
    expect(res.status).toBe(200);

    const getRes = await handleProgressRequest(
      request("GET"),
      "user-1",
      env.DB,
    );
    const stored = (await getRes.json()) as { data: unknown };
    expect(stored.data).toEqual(malicious);

    // SQL-like user id is a bound parameter, never a statement fragment
    const evilId = await handleProgressRequest(
      request("GET"),
      "'; DROP TABLE user_data; --",
      env.DB,
    );
    expect(evilId.status).toBe(404);
    const row = await env.DB.prepare(
      "SELECT revision FROM user_data WHERE user_id = ?",
    )
      .bind("user-1")
      .first();
    expect(row?.revision).toBe(1);
  });

  it("returns 405 for unsupported methods", async () => {
    const res = await handleProgressRequest(
      request("POST", SNAPSHOT),
      "user-1",
      env.DB,
    );
    expect(res.status).toBe(405);
  });

  it("sets Cache-Control no-store on every response", async () => {
    for (const res of [
      await handleProgressRequest(request("GET"), "user-1", env.DB),
      await put("user-1", SNAPSHOT, null),
      await handleProgressRequest(request("PUT", "garbage"), "user-1", env.DB),
    ]) {
      expect(res.headers.get("Cache-Control")).toBe("no-store");
    }
  });
});
