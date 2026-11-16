// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast as sonnerToast } from "sonner";
import { ToastProvider } from "@/design-system";
import { I18nProvider } from "@/i18n/I18nContext";
import { ToastSessionReset } from "./ToastSessionReset";

const auth = vi.hoisted(() => ({ user: { id: "actor-a" } as { id: string } | null }));

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({ user: auth.user }),
}));

beforeEach(() => {
  // Sonner observes the system theme; jsdom does not implement matchMedia.
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
});

afterEach(() => {
  act(() => { sonnerToast.dismiss(); });
  cleanup();
  vi.unstubAllGlobals();
  auth.user = { id: "actor-a" };
});

function Session() {
  return (
    <I18nProvider>
      <ToastProvider>
        <ToastSessionReset />
      </ToastProvider>
    </I18nProvider>
  );
}

function raisePersistentToast(title: string) {
  act(() => {
    window.dispatchEvent(new CustomEvent("global-toast", {
      detail: { type: "error", title, duration: 0 },
    }));
  });
}

describe("ToastSessionReset", () => {
  it("clears persistent toasts on session end and actor changes, retaining new toasts", async () => {
    const { rerender } = render(<Session />);
    raisePersistentToast("Actor A sign-out retry");
    expect(await screen.findByText("Actor A sign-out retry")).toBeVisible();

    auth.user = null;
    rerender(<Session />);
    await waitFor(() => expect(screen.queryByText("Actor A sign-out retry")).toBeNull());

    raisePersistentToast("Login feedback");
    expect(await screen.findByText("Login feedback")).toBeVisible();
    rerender(<Session />);
    expect(screen.getByText("Login feedback")).toBeVisible();

    auth.user = { id: "actor-b" };
    rerender(<Session />);
    await waitFor(() => expect(screen.queryByText("Login feedback")).toBeNull());

    raisePersistentToast("Actor B feedback");
    expect(await screen.findByText("Actor B feedback")).toBeVisible();
    auth.user = { id: "actor-b" };
    rerender(<Session />);
    expect(screen.getByText("Actor B feedback")).toBeVisible();

    auth.user = { id: "actor-c" };
    rerender(<Session />);
    await waitFor(() => expect(screen.queryByText("Actor B feedback")).toBeNull());
    raisePersistentToast("Actor C feedback");
    expect(await screen.findByText("Actor C feedback")).toBeVisible();
  });
});
