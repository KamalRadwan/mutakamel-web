// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { notifyProfileAvatarChanged, useProfileAvatarImage } from "./useProfileAvatarImage";

afterEach(cleanup);

describe("profile avatar refresh", () => {
  it("refreshes the header and preview together after upload and clears both after removal", () => {
    const { result } = renderHook(() => ({
      header: useProfileAvatarImage("caller", true), preview: useProfileAvatarImage("caller", true),
    }));
    const original = result.current.header;
    act(() => notifyProfileAvatarChanged("caller", false));
    expect(result.current.header).not.toBe(original);
    expect(result.current.header).toBe(result.current.preview);
    expect(result.current.header).toMatch(/^\/api\/tenant\/core\/v1\/profile\/avatar\?v=/u);
    act(() => notifyProfileAvatarChanged("caller", true));
    expect(result.current).toEqual({ header: undefined, preview: undefined });
  });

  it("does not request an avatar Core reports absent until an upload announces one", () => {
    const { result } = renderHook(() => useProfileAvatarImage("caller", false));
    expect(result.current).toBeUndefined();
    act(() => notifyProfileAvatarChanged("caller", false));
    expect(result.current).toMatch(/^\/api\/tenant\/core\/v1\/profile\/avatar\?v=/u);
  });

  it("ignores another user's update and does not show an avatar without a signed-in user", () => {
    const { result, rerender } = renderHook(({ userId }: { userId: string | undefined }) => useProfileAvatarImage(userId, true), {
      initialProps: { userId: "caller" as string | undefined },
    });
    const original = result.current;
    act(() => notifyProfileAvatarChanged("someone-else", true));
    expect(result.current).toBe(original);
    rerender({ userId: undefined });
    expect(result.current).toBeUndefined();
  });
});
