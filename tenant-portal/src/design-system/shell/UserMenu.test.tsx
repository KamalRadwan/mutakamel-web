// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ar, type Dictionary } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import type { UseToastResult } from "../feedback/useToast";
import { useUserMenuLogout } from "./hooks/useUserMenuLogout";
import { UserMenu } from "./UserMenu";

const { logout, warning } = vi.hoisted(() => ({
  logout: vi.fn<() => Promise<void>>(),
  warning: vi.fn<UseToastResult["warning"]>(),
}));
let dictionary: Dictionary = en;

vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: dictionary }) }));
vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({
    user: { id: "user-a", firstName: "Amina", lastName: "Ali", email: "amina@example.test" },
    logout,
  }),
}));
vi.mock("@/hooks/useProfileAvatarImage", () => ({ useProfileAvatarImage: () => null }));
vi.mock("../feedback/useToast", () => ({ useToast: () => ({ warning }) }));
vi.mock("../theme/DensityProvider", () => ({
  DENSITY_OPTIONS: ["standard"],
  useDensity: () => ({ density: "standard", setDensity: vi.fn() }),
}));

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

beforeEach(() => {
  dictionary = en;
  logout.mockReset().mockResolvedValue(undefined);
  warning.mockClear();
});
afterEach(cleanup);

function selectSignOut() {
  fireEvent.keyDown(screen.getByRole("button", { name: dictionary.common.profile }), { key: "Enter" });
  fireEvent.click(screen.getByRole("menuitem", { name: dictionary.common.signOut }));
}

describe("UserMenu logout", () => {
  it("shows pending feedback and disables repeated selection until logout settles", async () => {
    let resolve!: () => void;
    logout.mockReturnValue(new Promise<void>((done) => { resolve = done; }));
    render(<UserMenu />);
    selectSignOut();

    const pendingItem = screen.getByRole("menuitem", { name: en.common.signingOut });
    expect(pendingItem).toHaveAttribute("data-disabled");
    expect(pendingItem).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: en.common.profile })).toHaveAttribute("aria-busy", "true");
    fireEvent.click(pendingItem);
    expect(logout).toHaveBeenCalledTimes(1);

    await act(async () => { resolve(); });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(warning).not.toHaveBeenCalled();
  });

  it.each([
    ["network error", new TypeError("Failed to fetch")],
    ["timeout", { statusCode: 503, errorCode: "AUTH_SESSION_COORDINATION_UNAVAILABLE" }],
    ["503", { statusCode: 503, message: "Service unavailable" }],
  ])("handles %s with session-retained feedback and a working retry", async (_name, error) => {
    logout.mockRejectedValueOnce(error);
    render(<UserMenu />);
    selectSignOut();

    await waitFor(() => expect(warning).toHaveBeenCalledWith(
      en.common.signOutFailed,
      en.common.signOutFailedDescription,
      0,
      { label: en.common.retrySignOut, onClick: expect.any(Function) },
    ));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: en.common.profile })).toHaveAttribute("aria-busy", "false");

    const retry = warning.mock.calls[0][3];
    expect(retry).toBeDefined();
    await act(async () => { retry!.onClick(); });
    expect(logout).toHaveBeenCalledTimes(2);
    expect(warning).toHaveBeenCalledTimes(1);
  });

  it("uses Arabic pending and failure copy", async () => {
    dictionary = ar;
    let reject!: (error: unknown) => void;
    logout.mockReturnValue(new Promise<void>((_resolve, fail) => { reject = fail; }));
    render(<UserMenu />);
    selectSignOut();
    expect(screen.getByRole("menuitem", { name: ar.common.signingOut })).toHaveAttribute("data-disabled");

    await act(async () => { reject(new TypeError("Failed to fetch")); });
    expect(warning).toHaveBeenCalledWith(
      ar.common.signOutFailed,
      ar.common.signOutFailedDescription,
      0,
      { label: ar.common.retrySignOut, onClick: expect.any(Function) },
    );
  });

  it("fences synchronous duplicates before the pending state renders and consumes rejection", async () => {
    let reject!: (error: unknown) => void;
    logout.mockReturnValue(new Promise<void>((_resolve, fail) => { reject = fail; }));
    const { result } = renderHook(() => useUserMenuLogout(logout));
    let request!: Promise<void>;

    act(() => {
      request = result.current.handleLogout();
      void result.current.handleLogout();
    });
    expect(logout).toHaveBeenCalledTimes(1);

    await act(async () => {
      reject(new TypeError("Failed to fetch"));
      await expect(request).resolves.toBeUndefined();
    });
    expect(result.current.isLoggingOut).toBe(false);
    expect(warning).toHaveBeenCalledTimes(1);
  });
});
