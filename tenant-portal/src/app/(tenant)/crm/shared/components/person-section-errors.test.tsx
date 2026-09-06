// @vitest-environment jsdom
//
// Both create modals key the person's own fields FLAT (`firstName`) while
// `CrmContactLine` keys its messages by path (`person.firstName`), so each
// section re-points the few it shows. That mapping is a hand-written table:
// when the name stopped being one box and became two, the old
// `"person.fullName"` row went on compiling and silently swallowed the
// required-name error — the modal refused the submit with the person tab
// reading clean. These pin the mapping to the paths the line actually reads.

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/I18nContext";
import { en } from "@/i18n/dictionaries/en";
import { emptyCreateLeadForm } from "../../leads/lead-create-contract";
import { LeadPersonSection } from "../../leads/components/create-lead/LeadPersonSection";
import { emptyCreateCustomerProfileForm } from "../../customer-profiles/customer-profile-create-contract";
import { CustomerPersonSection } from "../../customer-profiles/components/create-customer/CustomerPersonSection";

afterEach(cleanup);

vi.mock("@/i18n/I18nContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/i18n/I18nContext")>()),
  // The real English dictionary, so a missing key fails the test rather than
  // rendering as empty text.
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));

const ERRORS = { firstName: "Required.", lastName: "At most 80 characters." };

const handlers = {
  disabled: false,
  onFieldChange: vi.fn(),
  onPhoneChange: vi.fn(),
  onPhoneAdd: vi.fn(),
  onPhoneRemove: vi.fn(),
  onBlur: vi.fn(),
};

describe("the person section of the lead modal", () => {
  it("shows the errors the validator files against the two name parts", () => {
    render(
      <I18nProvider>
        <LeadPersonSection
          form={{ ...emptyCreateLeadForm("contact-1"), leadProfileType: "INDIVIDUAL" }}
          errors={ERRORS}
          {...handlers}
        />
      </I18nProvider>,
    );
    expect(screen.getByText("Required.")).toBeTruthy();
    expect(screen.getByText("At most 80 characters.")).toBeTruthy();
  });
});

describe("the person section of the customer modal", () => {
  it("shows the errors the validator files against the two name parts", () => {
    render(
      <I18nProvider>
        <CustomerPersonSection
          form={{ ...emptyCreateCustomerProfileForm("contact-1"), profileType: "INDIVIDUAL" }}
          errors={ERRORS}
          {...handlers}
        />
      </I18nProvider>,
    );
    expect(screen.getByText("Required.")).toBeTruthy();
    expect(screen.getByText("At most 80 characters.")).toBeTruthy();
  });
});
