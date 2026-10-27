// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/I18nContext";
import { en } from "@/i18n/dictionaries/en";
import { emptyCreateLeadForm } from "../../lead-create-contract";
import { LeadAddressSection } from "./LeadAddressSection";
import { LeadQualificationSection } from "./LeadQualificationSection";

afterEach(cleanup);

vi.mock("@/i18n/I18nContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/i18n/I18nContext")>()),
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));

const handlers = {
  disabled: false,
  onChange: vi.fn(),
  onBlur: vi.fn(),
};

function createForm() {
  return emptyCreateLeadForm("contact-1");
}

describe("the optional lead sections", () => {
  it("offers Street 2 without a separate apartment input", () => {
    const form = createForm();
    form.address.street2 = "Suite 8";
    render(
      <I18nProvider>
        <LeadAddressSection address={form.address} errors={{}} {...handlers} />
      </I18nProvider>,
    );

    expect(screen.getByDisplayValue("Suite 8")).toBeVisible();
    expect(screen.queryByPlaceholderText(en.crmLeads.create.apartment)).not.toBeInTheDocument();
  });

  it("keeps Address and Qualification collapsed when the modal first opens", () => {
    const form = createForm();
    render(
      <I18nProvider>
        <LeadAddressSection
          address={form.address}
          errors={{}}
          defaultOpen={false}
          {...handlers}
        />
        <LeadQualificationSection form={form} errors={{}} {...handlers} />
      </I18nProvider>,
    );

    expect(screen.getByRole("button", { name: /^Address/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByRole("button", { name: /^Qualification/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("opens Qualification automatically when one of its fields has an error", () => {
    const form = createForm();
    render(
      <I18nProvider>
        <LeadQualificationSection
          form={form}
          errors={{ description: "Required." }}
          {...handlers}
        />
      </I18nProvider>,
    );

    expect(screen.getByRole("button", { name: /^Qualification/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByText("Required.")).toBeVisible();
  });
});
