// @vitest-environment jsdom

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { ToastProvider } from "./ToastProvider";

vi.mock("sonner", () => ({
  Toaster: () => null,
  toast: { custom: vi.fn(), dismiss: vi.fn() },
}));
vi.mock("@/i18n/useLanguage", () => ({ useDirection: () => "ltr" }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

function emit(dedupeKey?: string) {
  act(() => {
    window.dispatchEvent(new CustomEvent("global-toast", {
      detail: { type: "error", title: "Denied", dedupeKey },
    }));
  });
}

it("coalesces a denial code for four seconds while keeping distinct codes", () => {
  const now = vi.spyOn(Date, "now").mockReturnValue(1000);
  render(<ToastProvider>Workspace</ToastProvider>);
  emit("forbidden:TENANT_WIDE_PERMISSION_REQUIRED");
  emit("forbidden:TENANT_WIDE_PERMISSION_REQUIRED");
  expect(toast.custom).toHaveBeenCalledTimes(1);
  emit("forbidden:COMPANY_PERMISSION_DENIED");
  expect(toast.custom).toHaveBeenCalledTimes(2);
  now.mockReturnValue(5000);
  emit("forbidden:TENANT_WIDE_PERMISSION_REQUIRED");
  expect(toast.custom).toHaveBeenCalledTimes(3);
  expect(toast.custom).toHaveBeenLastCalledWith(expect.any(Function), {
    id: "forbidden:TENANT_WIDE_PERMISSION_REQUIRED", duration: 4000,
  });
});

it("preserves ordinary toasts and removes its listener on unmount", () => {
  const { unmount } = render(<ToastProvider>Workspace</ToastProvider>);
  emit();
  emit();
  expect(toast.custom).toHaveBeenCalledTimes(2);
  unmount();
  emit();
  expect(toast.custom).toHaveBeenCalledTimes(2);
});
