// @vitest-environment jsdom

/**
 * The transfer key, asserted on the wire.
 *
 * `./api` is deliberately NOT mocked here: the whole question is which
 * `x-idempotency-key` header actually accompanies which POST body, and a test
 * that stops at the service boundary cannot see either. Only the transport is
 * replaced.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
  uuid: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { isSuperAdmin: true, permissions: [] },
    isLoading: false,
  }),
}));
vi.mock("@/lib/auth/rbac", () => ({ adminCanAll: () => true }));
vi.mock("@/lib/utils/uuid", () => ({ generateUUIDv7: mocks.uuid }));
vi.mock("@/lib/api/axiosClient", () => ({
  axiosClient: {
    get: mocks.get,
    post: mocks.post,
    patch: mocks.patch,
    delete: mocks.del,
  },
}));

import { useTenantAccess } from "./use-tenant-access";
import {
  TENANT_ID,
  branchFixture,
  departmentFixture,
  envelope,
  pageEnvelope,
  roleFixture,
  summaryFixture,
  teamFixture,
  userFixture,
  userPayload,
} from "./__tests__/fixtures";

const OWNER_ID = "019ff251-1000-7000-8000-000000000002";
const HEIR_B = "019ff251-1000-7000-8000-0000000000b1";
const HEIR_C = "019ff251-1000-7000-8000-0000000000c1";

const ambiguous = {
  response: {
    status: 503,
    data: {
      success: false,
      statusCode: 503,
      errorCode: "TENANT_DATABASE_NOT_READY",
      errorCategory: "SERVER_ERROR",
      message: "Tenant database is not ready yet.",
    },
  },
};

type TransferCall = [
  url: string,
  body: { newOwnerUserId: string },
  config: { headers: Record<string, string> },
];

function transferCalls(): TransferCall[] {
  return mocks.post.mock.calls.filter((call) =>
    String(call[0]).endsWith("/transfer-ownership"),
  ) as TransferCall[];
}

function keyOf(call: TransferCall): string | undefined {
  return call[2].headers["x-idempotency-key"];
}

describe("tenant ownership transfer command identity", () => {
  beforeEach(() => {
    let issued = 0;
    mocks.uuid.mockReset().mockImplementation(() => {
      issued += 1;
      return `019ff251-4000-7000-8000-${String(issued).padStart(12, "0")}`;
    });
    mocks.get.mockReset().mockImplementation((url: string) => {
      if (url.includes("/users/summary")) {
        return Promise.resolve(envelope(summaryFixture));
      }
      if (url.includes("/access/roles")) {
        return Promise.resolve(pageEnvelope([roleFixture]));
      }
      if (url.includes("/access/branches")) {
        return Promise.resolve(pageEnvelope([branchFixture]));
      }
      if (url.includes("/access/departments")) {
        return Promise.resolve(pageEnvelope([departmentFixture]));
      }
      if (url.includes("/access/teams")) {
        return Promise.resolve(pageEnvelope([teamFixture]));
      }
      if (url.endsWith("/users") || url.includes("/users?")) {
        return Promise.resolve(pageEnvelope([userPayload()]));
      }
      return Promise.resolve(envelope(userPayload()));
    });
    mocks.post.mockReset();
    mocks.patch.mockReset();
    mocks.del.mockReset();
  });

  async function readyHook() {
    const rendered = renderHook(() =>
      useTenantAccess({ tenantId: TENANT_ID, tenantStatus: "ACTIVE" }),
    );
    await waitFor(() =>
      expect(rendered.result.current.directory.status).toBe("ready"),
    );
    return rendered;
  }

  it("sends a fresh key once the operator picks a different new owner", async () => {
    const owner = userFixture({ id: OWNER_ID, isTenantOwner: true });
    mocks.post
      .mockRejectedValueOnce(ambiguous)
      .mockResolvedValueOnce(
        envelope(userPayload({ id: HEIR_C, isTenantOwner: true })),
      );

    const { result } = await readyHook();

    // A→B leaves the outcome unknown, so its key is deliberately retained.
    await act(async () => {
      await expect(
        result.current.transferOwnership(owner, HEIR_B),
      ).rejects.toMatchObject({ httpStatus: 503 });
    });
    // The operator changes their mind and sends the seat to C instead.
    await act(async () => {
      await result.current.transferOwnership(owner, HEIR_C);
    });

    const calls = transferCalls();
    expect(calls).toHaveLength(2);
    expect(calls[0]![1]).toEqual({ newOwnerUserId: HEIR_B });
    expect(calls[1]![1]).toEqual({ newOwnerUserId: HEIR_C });

    // Two different bodies must never travel under one key: the Gateway
    // fingerprints the body and answers the second with GW.IDEM.MISMATCH,
    // which no retry can clear.
    expect(keyOf(calls[1]!)).not.toBe(keyOf(calls[0]!));
  });

  it("keeps the same key when the same new owner is retried", async () => {
    const owner = userFixture({ id: OWNER_ID, isTenantOwner: true });
    mocks.post
      .mockRejectedValueOnce(ambiguous)
      .mockResolvedValueOnce(
        envelope(userPayload({ id: HEIR_B, isTenantOwner: true })),
      );

    const { result } = await readyHook();

    await act(async () => {
      await expect(
        result.current.transferOwnership(owner, HEIR_B),
      ).rejects.toMatchObject({ httpStatus: 503 });
    });
    await act(async () => {
      await result.current.transferOwnership(owner, HEIR_B);
    });

    const calls = transferCalls();
    expect(calls).toHaveLength(2);
    expect(calls[0]![1]).toEqual({ newOwnerUserId: HEIR_B });
    expect(calls[1]![1]).toEqual({ newOwnerUserId: HEIR_B });
    expect(keyOf(calls[1]!)).toBe(keyOf(calls[0]!));
  });
});
