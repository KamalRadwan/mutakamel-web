import { beforeEach, describe, expect, it, vi } from "vitest";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import {
  createCrmWriteAttempt,
  expectNoContent,
  isAmbiguousWriteFailure,
  runCrmWrite,
  IDEMPOTENCY_KEY_HEADER,
  WRITE_APPLIED_UNREADABLE,
} from "./crm-write";

const post = vi.fn();
const remove = vi.fn();

vi.mock("@/lib/api/axiosClient", async (importOriginal) => {
  // The real module is imported and only its request surface replaced, so
  // `TenantApiClientError` stays the same class the classification checks.
  const actual = await importOriginal<typeof import("@/lib/api/axiosClient")>();
  return {
    ...actual,
    axiosClient: {
      get: vi.fn(),
      post: (...args: unknown[]) => post(...args),
      put: vi.fn(),
      patch: vi.fn(),
      delete: (...args: unknown[]) => remove(...args),
    },
  };
});

function apiError(status: number, code = "SOME_CODE") {
  return new TenantApiClientError(code, {
    status,
    statusText: "",
    headers: new Headers(),
    data: { message: code, errorCode: code, correlationId: "" },
  });
}

beforeEach(() => {
  post.mockReset();
  remove.mockReset();
});

describe("CRM write attempts", () => {
  it("mints a UUIDv7 key per attempt", () => {
    const first = createCrmWriteAttempt();
    const second = createCrmWriteAttempt();
    expect(first.idempotencyKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(first.idempotencyKey).not.toBe(second.idempotencyKey);
  });

  it("sends the attempt key and suppresses the transport's own", () => {
    const attempt = createCrmWriteAttempt();
    post.mockResolvedValue({
      data: { ok: true },
      status: 201,
      statusText: "",
      headers: new Headers(),
    });

    return runCrmWrite({
      attempt,
      method: "post",
      path: "/api/tenant/crm/v1/notes",
      body: { body: "x" },
      parse: (payload) => payload,
    }).then(() => {
      const config = post.mock.calls[0][2] as Record<string, unknown>;
      const headers = config.headers as Record<string, string>;
      expect(headers[IDEMPOTENCY_KEY_HEADER]).toBe(attempt.idempotencyKey);
      // Without this the transport mints a FRESH key per request, which turns
      // every retry into a second write.
      expect(config.skipAutoIdempotency).toBe(true);
    });
  });

  it("reuses the same key across a retry of one attempt", async () => {
    const attempt = createCrmWriteAttempt();
    post
      .mockRejectedValueOnce(apiError(503))
      .mockResolvedValueOnce({
        data: { ok: true },
        status: 201,
        statusText: "",
        headers: new Headers(),
      });

    const send = () =>
      runCrmWrite({
        attempt,
        method: "post",
        path: "/api/tenant/crm/v1/leads/x/convert",
        body: {},
        parse: (payload) => payload,
      });

    expect((await send()).kind).toBe("ambiguous");
    expect((await send()).kind).toBe("success");

    const firstKey = (post.mock.calls[0][2] as { headers: Record<string, string> })
      .headers[IDEMPOTENCY_KEY_HEADER];
    const secondKey = (post.mock.calls[1][2] as { headers: Record<string, string> })
      .headers[IDEMPOTENCY_KEY_HEADER];
    expect(secondKey).toBe(firstKey);
  });

  it("reports a replayed write as success, not as a duplicate", async () => {
    post.mockResolvedValue({
      data: { ok: true },
      status: 201,
      statusText: "",
      headers: new Headers({ "idempotency-replayed": "true" }),
    });

    const outcome = await runCrmWrite({
      attempt: createCrmWriteAttempt(),
      method: "post",
      path: "/api/tenant/crm/v1/notes",
      body: {},
      parse: (payload) => payload,
    });

    expect(outcome.kind).toBe("success");
    expect(outcome.kind === "success" && outcome.replayed).toBe(true);
  });

  it("classifies a definite refusal as failed and an unknown outcome as ambiguous", () => {
    expect(isAmbiguousWriteFailure(apiError(409))).toBe(false);
    expect(isAmbiguousWriteFailure(apiError(422))).toBe(false);
    expect(isAmbiguousWriteFailure(apiError(500))).toBe(true);
    expect(isAmbiguousWriteFailure(new TypeError("network"))).toBe(true);
  });

  it("keeps the idempotency body-mismatch 422 as a definite failure", async () => {
    post.mockRejectedValue(apiError(422, "IDEMPOTENCY_BODY_MISMATCH"));
    const outcome = await runCrmWrite({
      attempt: createCrmWriteAttempt(),
      method: "post",
      path: "/api/tenant/crm/v1/notes",
      body: {},
      parse: (payload) => payload,
    });
    expect(outcome.kind).toBe("failed");
    expect(outcome.kind === "failed" && outcome.error.code).toBe(
      "IDEMPOTENCY_BODY_MISMATCH",
    );
  });

  // D2, corrected deliberately. This used to assert `failed`, which is the
  // defect: a plain failure invites the user to fill the form in again and
  // press Save, and on a non-idempotent route that fresh intent duplicates a
  // record that already exists. It is not ambiguous either — replaying the key
  // returns the same body this client already could not read.
  it("reports an unreadable 2xx body as applied, neither failed nor ambiguous", async () => {
    post.mockResolvedValue({
      data: { unexpected: true },
      status: 201,
      statusText: "",
      headers: new Headers(),
    });
    const outcome = await runCrmWrite({
      attempt: createCrmWriteAttempt(),
      method: "post",
      path: "/api/tenant/crm/v1/notes",
      body: {},
      parse: () => {
        throw new Error("Invalid CRM notes response.");
      },
    });
    expect(outcome.kind).toBe("applied_unreadable");
    expect(outcome.kind === "applied_unreadable" && outcome.error).toEqual({
      status: 201,
      code: WRITE_APPLIED_UNREADABLE,
      message: "Invalid CRM notes response.",
    });
  });

  it("keeps a pre-response failure a failure — the parser is not involved", async () => {
    post.mockRejectedValue(apiError(422));
    const outcome = await runCrmWrite({
      attempt: createCrmWriteAttempt(),
      method: "post",
      path: "/api/tenant/crm/v1/notes",
      body: {},
      parse: () => {
        throw new Error("never reached");
      },
    });
    expect(outcome.kind).toBe("failed");
  });

  it("reads a 204 delete without a body", async () => {
    remove.mockResolvedValue({
      data: undefined,
      status: 204,
      statusText: "",
      headers: new Headers(),
    });
    const outcome = await runCrmWrite({
      attempt: createCrmWriteAttempt(),
      method: "delete",
      path: "/api/tenant/crm/v1/notes/x",
      parse: expectNoContent,
    });
    expect(outcome).toEqual({ kind: "success", value: null, replayed: false });
  });
});
