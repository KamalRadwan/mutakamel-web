// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { useSmtpSettings } from "./hooks/useSmtpSettings";

const { smtpMock, toastMock } = vi.hoisted(() => ({
  smtpMock: {
    lang: "en" as "ar" | "en",
    snapshot: {
      data: {
        configured: true,
        revision: 1,
        fromAddress: "notifications@example.com",
        fromName: "Mutakamel",
        senderDomain: "mail.example.com",
        smtpHost: "smtp.example.com",
        smtpPort: 465,
        smtpSecure: true,
        smtpProtocol: "smtps" as const,
        smtpUsername: "mailer@example.com",
        smtpPasswordConfigured: true,
        updatedAt: "2026-08-12T08:00:00.000Z",
      },
      correlationId: "corr-smtp",
      timestamp: "2026-08-12T08:00:00.000Z",
    },
    form: {
      fromAddress: "notifications@example.com",
      fromName: "Mutakamel",
      senderDomain: "mail.example.com",
      smtpHost: "edited.example.com",
      smtpPort: "465",
      smtpSecure: true as boolean | null,
      smtpProtocol: "smtps" as "smtp" | "smtps" | null,
      smtpUsername: "mailer@example.com",
    },
    password: "",
    auditLogs: [],
    configState: "READY" as const,
    auditState: "READY" as const,
    configError: null,
    auditError: null,
    fieldErrors: {},
    mutation: {
      action: null,
      phase: "IDLE" as const,
      error: null,
      localCode: null,
      correlationId: null,
    } as ReturnType<typeof useSmtpSettings>["mutation"],
    canRead: true,
    canSaveCritical: false,
    canVerify: true,
    hasUnsavedChanges: true,
    canTestSavedConfig: false,
    handleUpdate: vi.fn(),
    setPassword: vi.fn(),
    saveConfig: vi.fn(),
    verifyConnection: vi.fn(),
    refetchConfig: vi.fn(),
    refetchAudit: vi.fn(),
  },
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("./hooks/useSmtpSettings", () => ({ useSmtpSettings: () => smtpMock }));
vi.mock("./components/EmailSuppressionSection", () => ({ EmailSuppressionSection: () => null }));
vi.mock("@/components/ui/ToastContext", () => ({ useToast: () => toastMock }));

import SmtpSettingsPage from "./page";

describe("SmtpSettingsPage", () => {
  it.each([
    ["en", "The From address domain must match the sender domain."],
    ["ar", "يجب أن يتطابق نطاق عنوان البريد المرسل مع نطاق المرسل."],
  ] as const)("shows sender-domain mismatch guidance in %s", (lang, message) => {
    const previousMutation = smtpMock.mutation;
    smtpMock.lang = lang;
    smtpMock.mutation = {
      action: "SAVE",
      phase: "FAILED",
      error: {
        isNormalized: true,
        httpStatus: 422,
        errorCode: "PLATFORM_SMTP_SENDER_DOMAIN_MISMATCH",
        message: "Backend message",
      },
      localCode: null,
      correlationId: null,
    };
    try {
      render(<SmtpSettingsPage />);
      expect(screen.getByText(message)).toBeTruthy();
    } finally {
      smtpMock.lang = "en";
      smtpMock.mutation = previousMutation;
    }
  });

  it("hides critical save controls and disables testing while the form differs from saved Core state", () => {
    render(<SmtpSettingsPage />);
    expect(screen.queryByRole("button", { name: "Save configuration" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Test saved configuration" }),
    ).toBeDisabled();
    expect(screen.getByLabelText("SMTP host")).toBeDisabled();
    expect(screen.getByText(/Unsaved changes are present/)).toBeTruthy();
    expect(screen.getByText(/requires both admin.settings.update/)).toBeTruthy();
  });
});
