import { beforeEach, describe, expect, it, vi } from "vitest";

const { postMock } = vi.hoisted(() => ({ postMock: vi.fn() }));
vi.mock("@/lib/api/axiosClient", () => ({
  axiosClient: { post: postMock },
}));
vi.mock("@mutakamel/webphone", () => ({
  asteriskSettingsFromSystemSettings: vi.fn(),
}));
vi.mock("@mutakamel/webphone", () => ({
  asteriskSettingsFromSystemSettings: vi.fn(),
}));

import { createMyWebphoneCallLog } from "./api";

describe("webphone call-log transport", () => {
  beforeEach(() => {
    postMock.mockReset().mockResolvedValue({ data: { data: { id: "log" } } });
  });

  it("opts the non-idempotent route out of keys and refresh replay", async () => {
    const payload = { type: "OUT" as const, phoneNumber: "+201000000000" };
    await createMyWebphoneCallLog(payload);
    expect(postMock).toHaveBeenCalledWith(
      "/api/admin/core/v1/users/me/webphone/call-logs",
      payload,
      {
        skipAutoIdempotency: true,
        nonReplayable: true,
        cache: "no-store",
      },
    );
  });
});
