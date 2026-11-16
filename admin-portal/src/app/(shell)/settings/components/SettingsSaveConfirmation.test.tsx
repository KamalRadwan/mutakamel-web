// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { useSettings } from "../hooks/useSettings";
import PlatformSettingsPage from "../platform/page";
import FatalAlertSettingsPage from "../fatal-alerts/page";
import SmtpSettingsPage from "../smtp/page";
import { SaveSettingsBanner } from "./SaveSettingsBanner";
import { SettingField } from "./SettingField";

const mocks = vi.hoisted(() => ({
  lang: "en" as "ar" | "en",
  get: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { isSuperAdmin: true, permissions: [] }, isLoading: false }),
}));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: mocks.lang, t: mocks.lang === "ar" ? ar : en }),
  useOptionalI18n: () => ({ lang: mocks.lang }),
}));
vi.mock("@/components/ui/ToastContext", () => ({ useToast: () => mocks.toast }));
vi.mock("@/lib/api/axiosClient", () => ({
  axiosClient: { get: mocks.get, put: mocks.put, patch: mocks.patch },
  getApiRequestOutcome: () => undefined,
}));
vi.mock("../smtp/components/EmailSuppressionSection", () => ({ EmailSuppressionSection: () => null }));

function envelope<T>(data: T) {
  return { data: { success: true, data, correlationId: "confirmation-test", timestamp: "2026-10-29T08:00:00.000Z" } };
}

function setting(key: string, value: boolean | number) {
  return { key, value, description: key, descriptionI18n: { en: key, ar: key }, isDefault: false, readOnly: false };
}

function BillingSettings() {
  const state = useSettings("billing.");
  return <>
    {state.settings.map((item) => <SettingField key={item.key} setting={item} lang={state.lang} onUpdate={state.updateSetting} onReload={state.reloadSetting} onRetryExact={state.saveAllSettings} />)}
    <SaveSettingsBanner hasUnsavedChanges={state.hasUnsavedChanges} isSaving={state.isSaving} onSave={state.saveAllSettings} lang={state.lang} />
  </>;
}

function copy() {
  return (mocks.lang === "ar" ? ar : en).settings;
}

async function cancelThenConfirm(saveLabel: string, impact: string, checkPending: () => void) {
  const save = screen.getByRole("button", { name: saveLabel });
  save.focus();
  fireEvent.click(save);
  const dialog = await screen.findByRole("alertdialog");
  expect(dialog).toHaveAttribute("aria-modal", "true");
  expect(within(dialog).getByText(impact)).toBeTruthy();
  expect(mocks.put).not.toHaveBeenCalled();
  expect(mocks.patch).not.toHaveBeenCalled();
  await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  fireEvent.click(within(dialog).getByRole("button", { name: copy().confirmation.cancel }));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  await waitFor(() => expect(save).toHaveFocus());
  checkPending();
  expect(mocks.put).not.toHaveBeenCalled();
  expect(mocks.patch).not.toHaveBeenCalled();
  fireEvent.click(save);
  fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: copy().confirmation.confirm }));
}

describe("settings save confirmations", () => {
  beforeEach(() => {
    mocks.lang = "en";
    mocks.get.mockReset();
    mocks.put.mockReset();
    mocks.patch.mockReset();
    mocks.toast.success.mockReset();
    mocks.toast.error.mockReset();
  });
  afterEach(cleanup);

  for (const lang of ["en", "ar"] as const) {
    for (const enabled of [true, false]) {
      it(`confirms maintenance ${enabled ? "on" : "off"} in ${lang} without discarding a cancelled edit`, async () => {
        mocks.lang = lang;
        mocks.get.mockImplementation((url: string) => Promise.resolve(envelope(
          url.includes("platform.") ? [setting("platform.maintenance_mode", !enabled)] : [],
        )));
        mocks.put.mockResolvedValue(envelope(setting("platform.maintenance_mode", enabled)));
        render(<PlatformSettingsPage />);
        const toggle = await screen.findByRole("switch");
        fireEvent.click(toggle);
        expect(mocks.put).not.toHaveBeenCalled();
        await cancelThenConfirm(copy().banner.saveChanges,
          enabled ? copy().confirmation.maintenanceOn : copy().confirmation.maintenanceOff,
          () => expect(toggle).toHaveAttribute("aria-checked", String(enabled)));
        await waitFor(() => expect(mocks.put).toHaveBeenCalledTimes(1));
        expect(mocks.put.mock.calls[0].slice(0, 2)).toEqual([
          "/api/admin/core/v1/system-settings/platform.maintenance_mode", { value: enabled },
        ]);
      });
    }
  }

  for (const key of ["billing.min_topup_usd", "billing.max_topup_usd"]) {
    it(`confirms ${key} before PUT and keeps the pending amount on cancel`, async () => {
      mocks.get.mockResolvedValue(envelope([
        setting("billing.min_topup_usd", 10), setting("billing.max_topup_usd", 100),
      ]));
      const value = key.includes("min_") ? 20 : 200;
      mocks.put.mockResolvedValue(envelope(setting(key, value)));
      render(<BillingSettings />);
      const fields = await screen.findAllByRole("spinbutton");
      const input = fields[key.includes("min_") ? 0 : 1];
      fireEvent.change(input, { target: { value: String(value) } });
      await cancelThenConfirm(copy().banner.saveChanges, copy().confirmation.generic,
        () => expect(input).toHaveValue(value));
      await waitFor(() => expect(mocks.put).toHaveBeenCalledTimes(1));
      expect(mocks.put.mock.calls[0].slice(0, 2)).toEqual([
        `/api/admin/core/v1/system-settings/${key}`, { value },
      ]);
    });
  }

  it("confirms disabling fatal alerts before PATCH", async () => {
    const config = { configured: true, enabled: true, revision: 1, webhookUrl: "https://alerts.example.com/fatal", webhookTokenConfigured: true, timeoutMs: 5000, updatedAt: "2026-10-29T08:00:00.000Z" };
    mocks.get.mockResolvedValue(envelope(config));
    mocks.patch.mockResolvedValue(envelope({ ...config, enabled: false, revision: 2 }));
    render(<FatalAlertSettingsPage />);
    const toggle = await screen.findByRole("switch");
    fireEvent.click(toggle);
    await cancelThenConfirm(copy().fatalAlerts.saveButton, copy().confirmation.fatalAlertsOff,
      () => expect(toggle).toHaveAttribute("aria-checked", "false"));
    await waitFor(() => expect(mocks.patch).toHaveBeenCalledTimes(1));
    expect(mocks.patch.mock.calls[0].slice(0, 2)).toEqual([
      "/api/admin/core/v1/system-settings/fatal-alerts", { enabled: false },
    ]);
  });

  it("keeps the exact write key when an ambiguous save is confirmed again", async () => {
    mocks.get.mockResolvedValue(envelope([setting("billing.min_topup_usd", 10)]));
    mocks.put.mockRejectedValueOnce({
      isNormalized: true, httpStatus: 503, errorCode: "CORE_UNAVAILABLE",
      message: "temporary outage", correlationId: "ambiguous-confirmation",
    }).mockResolvedValueOnce(envelope(setting("billing.min_topup_usd", 20)));
    render(<BillingSettings />);
    fireEvent.change(await screen.findByRole("spinbutton"), { target: { value: "20" } });
    for (const attempt of [1, 2]) {
      fireEvent.click(screen.getByRole("button", { name: copy().banner.saveChanges }));
      fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: copy().confirmation.confirm }));
      await waitFor(() => expect(mocks.put).toHaveBeenCalledTimes(attempt));
      if (attempt === 1) {
        await waitFor(() => expect(screen.getByRole("button", { name: copy().banner.saveChanges })).toBeEnabled());
      }
    }
    expect(mocks.put.mock.calls[1][2].headers["x-idempotency-key"])
      .toBe(mocks.put.mock.calls[0][2].headers["x-idempotency-key"]);
  });

  for (const field of ["smtpHost", "smtpUsername", "smtpPassword"] as const) {
    it(`confirms SMTP ${field} changes without exposing credentials in the dialog`, async () => {
      const config = { configured: true, revision: 1, fromAddress: "mail@example.com", fromName: "Mail", senderDomain: "example.com", smtpHost: "smtp.example.com", smtpPort: 465, smtpSecure: true, smtpProtocol: "smtps", smtpUsername: "mailer", smtpPasswordConfigured: true, updatedAt: "2026-10-29T08:00:00.000Z" };
      mocks.get.mockImplementation((url: string) => Promise.resolve(envelope(url.endsWith("/audit") ? [] : config)));
      mocks.patch.mockResolvedValue(envelope({ ...config, revision: 2 }));
      render(<SmtpSettingsPage />);
      const label = field === "smtpHost" ? copy().smtp.form.smtpHost
        : field === "smtpUsername" ? copy().smtp.form.username : copy().smtp.form.passwordLabel;
      const input = await screen.findByLabelText(label);
      const value = field === "smtpHost" ? "new.example.com" : field === "smtpUsername" ? "new-mailer" : "test-password-only";
      fireEvent.change(input, { target: { value } });
      await cancelThenConfirm(copy().smtp.saveButton, copy().confirmation.smtp,
        () => expect(input).toHaveValue(value));
      await waitFor(() => expect(mocks.patch).toHaveBeenCalledTimes(1));
      expect(mocks.patch.mock.calls[0].slice(0, 2)).toEqual([
        "/api/admin/core/v1/system-settings/email", { [field]: value },
      ]);
      expect(screen.queryByText(value)).toBeNull();
    });
  }
});
