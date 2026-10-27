// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { EmailSuppressionSection } from "./EmailSuppressionSection";

const state = vi.hoisted(() => ({
  user: { id: "actor", isSuperAdmin: false, permissions: [] as string[] },
  allowed: false, locale: "en",
  lookup: vi.fn(), lift: vi.fn(), confirm: vi.fn(),
}));
vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({ user: state.user, realtimeAuthGeneration: "session" }),
}));
vi.mock("../hooks/useEmailSuppression", () => ({
  useEmailSuppression: () => ({
    copy: (state.locale === "ar" ? ar : en).emailSuppression,
    address: "private@example.com", updateAddress: vi.fn(), pending: false, denied: false,
    result: { suppressed: true, reasonCode: "COMPLAINT", firstOccurredAt: "first", lastOccurredAt: "last" },
    confirming: false, setConfirming: state.confirm, error: undefined, notice: null,
    date: (value: string) => value, lookup: state.lookup, lift: state.lift,
  }),
}));
vi.mock("@/design-system", () => ({
  useCan: () => state.allowed,
  PermissionGate: ({ children }: { children: ReactNode }) => <>{children}</>,
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input aria-label="address" {...props} />,
  Field: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ConfirmActionModal: () => null,
}));
beforeEach(() => { vi.clearAllMocks(); state.allowed = false; state.user.permissions = []; state.locale = "en"; });
afterEach(cleanup);

describe("suppression section access and evidence", () => {
  it("hides commands without management permission", () => {
    render(<EmailSuppressionSection />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(state.lookup).not.toHaveBeenCalled();
  });
  
  it.each(["en", "ar"])("renders translated evidence and requests confirmation in %s", (locale) => {
    state.allowed = true;
    state.user.permissions = ["admin.settings.update", "admin.settings.critical"];
    state.locale = locale;
    const copy = (locale === "ar" ? ar : en).emailSuppression;
    render(<EmailSuppressionSection />);
    expect(screen.getByText(copy.reasons.COMPLAINT)).toBeTruthy();
    expect(screen.getByText("first")).toBeTruthy();
    expect(screen.getByText("last")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: copy.lift }));
    expect(state.confirm).toHaveBeenCalledWith(true);
    expect(state.lift).not.toHaveBeenCalled();
  });
});

