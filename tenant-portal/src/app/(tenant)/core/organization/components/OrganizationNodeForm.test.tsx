// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { EMPTY_ORG_NODE_FORM } from "../hooks/useOrganizationLevel";
import { ORG_LEVEL_CONFIG } from "../level-config";
import { OrganizationNodeForm } from "./OrganizationNodeForm";

const locale = vi.hoisted(() => ({ lang: "en" as "ar" | "en" }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: { ar, en }[locale.lang], lang: locale.lang }),
}));

const options = { options: [], isLoading: false, search: vi.fn(), labelFor: () => undefined };

afterEach(cleanup);

describe("company currency requirement", () => {
  it.each(["ar", "en"] as const)("explains the edit requirement in %s and marks the input required", (lang) => {
    locale.lang = lang;
    const copy = { ar, en }[lang].coreIdentity.fields;
    render(<OrganizationNodeForm config={ORG_LEVEL_CONFIG.companies}
      values={{ ...EMPTY_ORG_NODE_FORM, currencyCode: "SAR" }} onChange={vi.fn()}
      mode="edit" isSubmitting={false} parentOptions={options} leadUserOptions={options} />);
    const input = screen.getByRole("textbox", { name: copy.currencyCode }) as HTMLInputElement;
    expect(input.required).toBe(true);
    expect(screen.getByText(copy.currencyCodeRequiredHint)).toBeTruthy();
    const hint = document.getElementById(input.getAttribute("aria-describedby") ?? "");
    expect(hint?.textContent).toBe(copy.currencyCodeRequiredHint);
  });

  it("keeps company currency optional when creating", () => {
    locale.lang = "en";
    render(<OrganizationNodeForm config={ORG_LEVEL_CONFIG.companies}
      values={EMPTY_ORG_NODE_FORM} onChange={vi.fn()} mode="create" isSubmitting={false}
      parentOptions={options} leadUserOptions={options} />);
    expect((screen.getByRole("textbox", { name: en.coreIdentity.fields.currencyCode }) as HTMLInputElement).required).toBe(false);
    expect(screen.getByText(en.coreIdentity.fields.currencyCodeHint)).toBeTruthy();
  });
});
