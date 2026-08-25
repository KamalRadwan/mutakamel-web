// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingField } from "./SettingField";

const toastError = vi.fn();
vi.mock("@/components/ui/ToastContext", () => ({
  useToast: () => ({ error: toastError }),
}));

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
});
