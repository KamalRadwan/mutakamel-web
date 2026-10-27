// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement, type ButtonHTMLAttributes, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShareDrawer } from "./ShareDrawer";

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({
    t: {
      crmDashboards: {
        shareTitle: "Share dashboard", shareDescription: "Share it", shareSubmit: "Share",
        shareTarget: "Target", shareTargetPlaceholder: "Choose target", shareTargetSearch: "Search",
        shareTargetEmpty: "No targets", shareAccessLevel: "Access", shareAccessLevels: { VIEW: "View", EDIT: "Edit" },
        shareExpiry: "Expires", shareExpiryHint: "Optional", shareExpiryPlaceholder: "No expiry",
        clearExpiry: "Clear expiry", currentShares: "Current shares", noShares: "No shares",
        revokeShare: "Revoke", subjectTypes: { USER: "User", TEAM: "Team" },
        errors: {}, actionFailed: "Action failed", shareLoadFailed: "Shares failed",
        shareTargetSearchFailed: "Search failed",
      },
      common: { cancel: "Cancel", discardTitle: "Discard", discardDescription: "Discard?", discardConfirm: "Discard", retry: "Retry" },
    },
  }),
}));

vi.mock("@/design-system", () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => createElement("button", props, children),
  Combobox: ({ value, onValueChange, options }: { value?: string; onValueChange: (value: string) => void; options: { value: string; label: string }[] }) => (
    <select aria-label="Target" value={value ?? ""} onChange={(event) => onValueChange(event.target.value)}>
      <option value="">Choose target</option>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  ),
  DatePicker: ({ value, onValueChange }: { value?: Date; onValueChange: (value: Date | undefined) => void }) => (
    <input
      aria-label="Expires"
      type="date"
      value={value?.toISOString().slice(0, 10) ?? ""}
      onChange={(event) => onValueChange(event.target.value ? new Date(`${event.target.value}T00:00:00Z`) : undefined)}
    />
  ),
  DateTime: () => null,
  ErrorState: ({ title, onRetry, retryLabel }: { title: string; onRetry?: () => void; retryLabel?: string }) => (
    <div role="alert"><p>{title}</p>{onRetry ? createElement("button", { onClick: onRetry }, retryLabel) : null}</div>
  ),
  Field: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  FormDrawer: ({ children, onSubmit }: { children: ReactNode; onSubmit: () => void }) => (
    <div>{children}{createElement("button", { onClick: onSubmit }, "Submit form")}</div>
  ),
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectValue: () => <span>View</span>,
}));

afterEach(() => vi.clearAllMocks());

const target = { id: "01900300-0000-7000-8000-000000000001", type: "USER" as const, name: "Sales Rep", email: null, code: null };

function renderDrawer(onShare: (input: { subjectType: "USER" | "TEAM"; subjectId: string; accessLevel: "VIEW" | "EDIT"; expiresAt: string }) => Promise<boolean>) {
  return render(
    <ShareDrawer
      open onOpenChange={vi.fn()} shares={[]} targets={[target]} isLoading={false} isSubmitting={false}
      onSearchTargets={vi.fn()} onRetryShares={vi.fn()} onRetryTargetSearch={vi.fn()} onShare={onShare} onRevoke={vi.fn()}
    />,
  );
}

describe("ShareDrawer submission", () => {
  it("keeps the recipient and expiry after a rejected share request", async () => {
    const onShare = vi.fn().mockResolvedValue(false);
    renderDrawer(onShare);
    fireEvent.change(screen.getByLabelText("Target"), { target: { value: target.id } });
    fireEvent.change(screen.getByLabelText("Expires"), { target: { value: "2027-01-10" } });
    fireEvent.click(screen.getByText("Submit form"));

    await waitFor(() => expect(onShare).toHaveBeenCalledWith(expect.objectContaining({
      subjectId: target.id,
      expiresAt: "2027-01-10T00:00:00.000Z",
    })));
    expect(screen.getByLabelText("Target")).toHaveValue(target.id);
    expect(screen.getByLabelText("Expires")).toHaveValue("2027-01-10");
  });

  it("clears the draft only after a successful share", async () => {
    const onShare = vi.fn().mockResolvedValue(true);
    renderDrawer(onShare);
    fireEvent.change(screen.getByLabelText("Target"), { target: { value: target.id } });
    fireEvent.change(screen.getByLabelText("Expires"), { target: { value: "2027-01-10" } });
    fireEvent.click(screen.getByText("Submit form"));

    await waitFor(() => expect(screen.getByLabelText("Target")).toHaveValue(""));
    expect(screen.getByLabelText("Expires")).toHaveValue("");
  });
});
