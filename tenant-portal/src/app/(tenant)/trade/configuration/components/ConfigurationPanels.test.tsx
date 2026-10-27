// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { VersionsPanel } from "./ConfigurationPanels";

const locale = vi.hoisted(() => ({ lang: "en" as "en" | "ar" }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: locale.lang, t: { en, ar }[locale.lang] }),
}));
afterEach(cleanup);

describe("Configuration replacement control", () => {
  it.each(["en", "ar"] as const)("labels the publisher's field in %s and hides it without publish access", (lang) => {
    locale.lang = lang;
    const t = { en, ar }[lang];
    const onChange = vi.fn();
    const props = {
      definition: { id: "definition", key: "trade.example", version: 1,
        valueSchema: {}, allowedScopes: ["COMPANY"], mergeStrategy: "OVERRIDE",
        riskClass: "LOW", versions: [] },
      canManage: true, canPublish: true, isSubmitting: false, report: null,
      onCreate: vi.fn(), onAction: vi.fn(), supersedesVersionId: "",
      onSupersedesVersionIdChange: onChange,
    };
    const { rerender } = render(<VersionsPanel {...props} />);
    const input = screen.getByRole("textbox", { name: t.tradeCommon.supersedesVersionId });
    expect(input).toHaveAccessibleDescription(t.tradeCommon.supersedesVersionHint);
    fireEvent.change(input, { target: { value: "predecessor" } });
    expect(onChange).toHaveBeenCalledWith("predecessor");
    rerender(<VersionsPanel {...props} canPublish={false} />);
    expect(screen.queryByRole("textbox", { name: t.tradeCommon.supersedesVersionId })).toBeNull();
  });
});
