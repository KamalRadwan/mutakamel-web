import { beforeEach, describe, expect, it, vi } from "vitest";

const { axiosMock } = vi.hoisted(() => ({
  axiosMock: {
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(),
  },
}));

vi.mock("@/lib/api/axiosClient", () => ({ axiosClient: axiosMock }));

import {
  activateAdminUser,
  assignUserRole,
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

describe("adminUsersApi write contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    axiosMock.post.mockResolvedValue({ data: { data: { id: "user" } } });
    axiosMock.patch.mockResolvedValue({ data: { data: { id: "user" } } });
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
    await updateUserWebphone("user", { enabled: false }, KEY);

    for (const call of [
      ...axiosMock.post.mock.calls,
      ...axiosMock.patch.mock.calls,
      ...axiosMock.delete.mock.calls,
    ]) {
      expect(call.at(-1)).toEqual(WRITE_CONFIG);
    }
  });

  it("rejects a non-UUIDv7 before dispatch", async () => {
    await expect(suspendAdminUser("user", "not-a-key")).rejects.toThrow(
      "INVALID_IDEMPOTENCY_KEY",
    );
    expect(axiosMock.post).not.toHaveBeenCalled();
  });
});
