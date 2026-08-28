// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingField } from "./SettingField";

const toastError = vi.fn();
vi.mock("@/components/ui/ToastContext", () => ({
  useToast: () => ({ error: toastError }),
}));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ lang: "en" }) }));

describe("SettingField", () => {
  it("keeps a rejected edit out of the rendered input and exposes exact reload", async () => {
    const onUpdate = vi.fn().mockRejectedValue(new Error("Minimum exceeds maximum"));
    const onReload = vi.fn().mockResolvedValue(undefined);
    render(
      <SettingField
        lang="en"
        setting={{
          key: "billing.min_topup_usd",
          value: 10,
          description: "Minimum",
          descriptionI18n: { en: "Minimum", ar: "الحد الأدنى" },
          isDefault: false,
          readOnly: false,
          uiMeta: {
            key: "billing.min_topup_usd",
            titleEn: "Minimum",
            titleAr: "الحد الأدنى",
            inputType: "number",
            defaultValue: 1,
            descEn: "Minimum",
            descAr: "الحد الأدنى",
            min: 1,
            max: 1_000_000_000,
          },
        }}
        onUpdate={onUpdate}
        onReload={onReload}
        onRetryExact={vi.fn()}
      />,
    );
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "30" } });
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(input).toHaveValue(10);
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    await waitFor(() =>
      expect(onReload).toHaveBeenCalledWith("billing.min_topup_usd"),
    );
  });

  it("keeps ambiguous-write evidence visible in-body and wires retry-exact", async () => {
    const onRetryExact = vi.fn();
    render(
      <SettingField
        lang="en"
        setting={{
          key: "asterisk.websocket_url",
          value: "wss://sip.example.com",
          description: "Websocket URL",
          descriptionI18n: { en: "Websocket URL", ar: "رابط الويب سوكيت" },
          isDefault: false,
          readOnly: false,
          error: "This setting could not be saved safely. Error code: GW.UPSTREAM_TIMEOUT",
          ambiguous: true,
          idempotencyKey: "0191a6b0-aaaa-7000-8000-000000000001",
          correlationId: "corr-ambiguous-1",
          uiMeta: {
            key: "asterisk.websocket_url",
            titleEn: "Websocket URL",
            titleAr: "رابط الويب سوكيت",
            inputType: "string",
            defaultValue: "",
            descEn: "Websocket URL",
            descAr: "رابط الويب سوكيت",
          },
        }}
        onUpdate={vi.fn()}
        onReload={vi.fn()}
        onRetryExact={onRetryExact}
      />,
    );

    expect(screen.getByText("0191a6b0-aaaa-7000-8000-000000000001")).toBeInTheDocument();
    expect(screen.getByText("corr-ambiguous-1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry exact" }));
    expect(onRetryExact).toHaveBeenCalledTimes(1);
  });
});
