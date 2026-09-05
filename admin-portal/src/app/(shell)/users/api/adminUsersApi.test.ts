import { beforeEach, describe, expect, it, vi } from "vitest";

const { axiosMock } = vi.hoisted(() => ({
  axiosMock: {
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(),
  },
}));

vi.mock("@/lib/api/axiosClient", () => ({
  axiosClient: axiosMock,
  unwrapCoreData: (payload: unknown) =>
    payload && typeof payload === "object" && "data" in payload
      ? (payload as { data: unknown }).data
      : payload,
}));

import {
  activateAdminUser,
  assignUserRole,
  createUserWebphone,
  deleteAdminUser,
  inviteAdminUser,
  suspendAdminUser,
  updateAdminUser,
  updateUserWebphone,
} from "./adminUsersApi";

const KEY = "019f0000-0000-7000-8000-000000000001";
const WRITE_CONFIG = {
  headers: { "x-idempotency-key": KEY },
  skipAutoIdempotency: true,
  replayAfterRefresh: true,
  cache: "no-store",
};

// The WebPhone writes parse their response, so the shared mock returns a valid
// extension — the other writes only read `data`, which this satisfies too.
const EXTENSION = {
  id: "019f0000-0000-7000-8000-000000000003",
  ownerId: "019f0000-0000-7000-8000-000000000004",
  extension: "1001",
  sipUsername: "user1001",
  passwordConfigured: false,
  displayName: null,
  outboundCallerId: null,
  transport: "wss",
  enabled: false,
};

describe("adminUsersApi write contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    axiosMock.post.mockResolvedValue({ data: { data: EXTENSION } });
    axiosMock.patch.mockResolvedValue({ data: { data: EXTENSION } });
    axiosMock.delete.mockResolvedValue({ status: 204 });
  });

  it("requires an explicit UUIDv7 and disables auto idempotency for every keyed write", async () => {
    const dto = {
      email: "admin@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      roleId: "019f0000-0000-7000-8000-000000000002",
    };
    await inviteAdminUser(dto, KEY);
    await updateAdminUser("user", { firstName: "Grace" }, KEY);
    await assignUserRole("user", { roleId: dto.roleId }, KEY);
    await suspendAdminUser("user", KEY);
    await activateAdminUser("user", KEY);
    await deleteAdminUser("user", KEY);
    await createUserWebphone(
      { ownerId: "user", extension: "1001", sipUsername: "user1001" },
      KEY,
    );
    await updateUserWebphone("extension", { enabled: false }, KEY);

    for (const call of [
      ...axiosMock.post.mock.calls,
      ...axiosMock.patch.mock.calls,
      ...axiosMock.delete.mock.calls,
    ]) {
      expect(call.at(-1)).toEqual(WRITE_CONFIG);
    }
  });

  // A user's WebPhone identity is an extension owned by the WebPhone module.
  // Addressing it under /users/:id is what the Gateway rejects as an unknown
  // route, so the namespace is asserted rather than left to review.
  it("addresses WebPhone identities under the WebPhone module, never under /users", async () => {
    await createUserWebphone(
      { ownerId: "user", extension: "1001", sipUsername: "user1001" },
      KEY,
    );
    await updateUserWebphone("extension", { enabled: false }, KEY);

    expect([
      ...axiosMock.post.mock.calls,
      ...axiosMock.patch.mock.calls,
    ].map((call) => call[0])).toEqual([
      "/api/admin/webphone/v1/extensions",
      "/api/admin/webphone/v1/extensions/extension",
    ]);
  });

  it("rejects a non-UUIDv7 before dispatch", async () => {
    await expect(suspendAdminUser("user", "not-a-key")).rejects.toThrow(
      "INVALID_IDEMPOTENCY_KEY",
    );
    expect(axiosMock.post).not.toHaveBeenCalled();
  });
});
