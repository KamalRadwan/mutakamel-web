// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";

const { put, remove, toast } = vi.hoisted(() => ({
  put: vi.fn(), remove: vi.fn(),
  toast: { success: vi.fn(), errorFromApi: vi.fn(), outcomeFromApi: vi.fn(() => false) },
}));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: { id: "caller", firstName: "A", lastName: "B" } }) }));
vi.mock("@/design-system", () => ({ useToast: () => toast }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en }) }));
vi.mock("@/lib/api/axiosClient", async (original) => ({
  ...await original<typeof import("@/lib/api/axiosClient")>(),
  axiosClient: { put, delete: remove },
}));
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { useProfileAvatar } from "./useProfileAvatar";

const picture = () => new File(["image"], "avatar.png", { type: "image/png" });
const eventFor = (file: File) => ({ target: { files: [file], value: "avatar.png" } });

beforeEach(() => {
  vi.clearAllMocks();
  put.mockResolvedValue({ status: 204 });
  remove.mockResolvedValue({ status: 204 });
});
afterEach(cleanup);

describe("profile avatar writes", () => {
  it("uploads multipart once, refreshes the image, and removes it after confirmed success", async () => {
    const { result } = renderHook(() => useProfileAvatar());
    const original = result.current.src;
    const event = eventFor(picture());
    act(() => result.current.chooseFile(event as never));
    await waitFor(() => expect(result.current.pending).toBeNull());
    expect(event.target.value).toBe("");
    expect(put).toHaveBeenCalledWith("/api/tenant/core/v1/profile/avatar", expect.any(FormData), {
      nonReplayable: true, skipAutoIdempotency: true,
    });
    expect((put.mock.calls[0][1] as FormData).get("file")).toBeInstanceOf(File);
    expect(result.current.src).not.toBe(original);
    act(() => result.current.imageStatusChanged("loaded"));
    expect(result.current.hasImage).toBe(true);
    act(() => result.current.remove());
    await waitFor(() => expect(result.current.src).toBeUndefined());
    expect(remove).toHaveBeenCalledWith("/api/tenant/core/v1/profile/avatar", {
      nonReplayable: true, skipAutoIdempotency: true,
    });
  });

  it("rejects oversized and unsupported files before sending them", () => {
    const { result } = renderHook(() => useProfileAvatar());
    act(() => result.current.chooseFile(eventFor(new File([new Uint8Array(2 * 1024 * 1024 + 1)], "big.png", { type: "image/png" })) as never));
    expect(result.current.error).toBe(en.coreIdentity.profile.avatarTooLarge);
    act(() => result.current.chooseFile(eventFor(new File(["svg"], "bad.svg", { type: "image/svg+xml" })) as never));
    expect(result.current.error).toBe(en.coreIdentity.profile.avatarInvalid);
    expect(put).not.toHaveBeenCalled();
  });

  it("keeps the current image after a rejected write and exposes server denials", async () => {
    const { result } = renderHook(() => useProfileAvatar());
    const original = result.current.src;
    put.mockRejectedValueOnce(new TenantApiClientError("Invalid image", {
      status: 415, statusText: "Unsupported Media Type", headers: new Headers(), data: {},
    }));
    act(() => result.current.chooseFile(eventFor(picture()) as never));
    await waitFor(() => expect(result.current.error).toBe(en.coreIdentity.profile.avatarInvalid));
    expect(result.current.src).toBe(original);
    expect(toast.success).not.toHaveBeenCalled();
    put.mockRejectedValueOnce(new TenantApiClientError("Forbidden", {
      status: 403, statusText: "Forbidden", headers: new Headers(), data: {},
    }));
    act(() => result.current.chooseFile(eventFor(picture()) as never));
    await waitFor(() => expect(result.current.denied).toBe(true));
  });

  it("prevents overlapping writes and never treats an unexpected response as success", async () => {
    let complete!: (value: { status: number }) => void;
    put.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    const { result } = renderHook(() => useProfileAvatar());
    const original = result.current.src;
    act(() => {
      result.current.chooseFile(eventFor(picture()) as never);
      result.current.chooseFile(eventFor(picture()) as never);
      result.current.remove();
    });
    expect(put).toHaveBeenCalledTimes(1);
    expect(remove).not.toHaveBeenCalled();
    await act(async () => complete({ status: 200 }));
    expect(result.current.src).toBe(original);
    expect(result.current.error).toBe(en.coreIdentity.profile.avatarFailed);
    expect(toast.success).not.toHaveBeenCalled();
  });
});
