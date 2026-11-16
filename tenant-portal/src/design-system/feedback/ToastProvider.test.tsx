// @vitest-environment jsdom

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { ToastProvider } from "./ToastProvider";
import { en } from "@/i18n/dictionaries/en";
import { fireEvent, screen } from "@testing-library/react";

vi.mock("sonner", () => ({
  Toaster: () => null,
  toast: { custom: vi.fn(), dismiss: vi.fn() },
}));
vi.mock("@/i18n/useLanguage", () => ({ useDirection: () => "ltr" }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en }) }));

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

it("renders a notification toast with its details, 30-second lifetime and an accessible dismiss button", () => {
  render(<ToastProvider>Workspace</ToastProvider>);
  act(() => { window.dispatchEvent(new CustomEvent("global-toast", { detail: {
    type: "info", title: "Call the customer", message: "Tomorrow at 10:00", duration: 30_000, dedupeKey: "notification:test",
  } })); });
  expect(toast.custom).toHaveBeenLastCalledWith(expect.any(Function), { id: "notification:test", duration: 30_000 });
  const create = vi.mocked(toast.custom).mock.calls[0][0];
  render(<>{create("notification:test")}</>);
  expect(screen.getByRole("status")).toHaveTextContent("Call the customer");
  expect(screen.getByText("Tomorrow at 10:00")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: en.common.dismiss }));
  expect(toast.dismiss).toHaveBeenCalledWith("notification:test");
});
