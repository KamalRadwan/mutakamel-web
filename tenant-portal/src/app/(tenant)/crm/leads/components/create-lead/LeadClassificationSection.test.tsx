// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/I18nContext";
import { en } from "@/i18n/dictionaries/en";
import {
  LeadClassificationSection,
  type LeadClassificationSectionProps,
} from "./LeadClassificationSection";

afterEach(cleanup);

vi.mock("@/i18n/I18nContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/i18n/I18nContext")>()),
  // The real English dictionary, so a missing key fails the test rather than
  // rendering as empty text.
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));

const COMPANY_A = "01900100-0000-7000-8000-0000000000a1";
const COMPANY_B = "01900100-0000-7000-8000-0000000000a2";
const BRANCH_A = "01900100-0000-7000-8000-0000000000b1";
const BRANCH_B = "01900100-0000-7000-8000-0000000000b2";

function renderSection(overrides: Partial<LeadClassificationSectionProps> = {}) {
  render(
    <I18nProvider>
      <LeadClassificationSection
        companyIds={[COMPANY_A]}
        companyId={COMPANY_A}
        branchIds={[BRANCH_A]}
        branchId={BRANCH_A}
        leadProfileType="INDIVIDUAL"
        stageId=""
        acquisitionSourceId=""
        stages={[]}
        sources={[]}
        errors={{}}
        disabled={false}
        onCompanyChange={vi.fn()}
        onBranchChange={vi.fn()}
        onProfileTypeChange={vi.fn()}
        onStageChange={vi.fn()}
        onSourceChange={vi.fn()}
        {...overrides}
      />
    </I18nProvider>,
  );
}

describe("the company and branch pickers", () => {
  it("renders neither when the account has one of each", () => {
    renderSection();
    // One option is not a choice. Nothing is rendered rather than a disabled
    // control, because there is no second state for it to unlock.
    expect(screen.queryByText(en.organization.parentCompany)).toBeNull();
    expect(screen.queryByText(en.common.branch)).toBeNull();
  });

  it("renders the branch alone when one company owns both branches", () => {
    renderSection({ branchIds: [BRANCH_A, BRANCH_B] });
    expect(screen.queryByText(en.organization.parentCompany)).toBeNull();
    expect(screen.getByText(en.common.branch)).toBeTruthy();
  });

  it("renders both when the account reaches two companies", () => {
    renderSection({
      companyIds: [COMPANY_A, COMPANY_B],
      branchIds: [BRANCH_A, BRANCH_B],
    });
    expect(screen.getByText(en.organization.parentCompany)).toBeTruthy();
    expect(screen.getByText(en.common.branch)).toBeTruthy();
  });

  it("shows the branch id, because /auth/me carries no branch names", () => {
    renderSection({ branchIds: [BRANCH_A, BRANCH_B] });
    expect(screen.getByText(BRANCH_A)).toBeTruthy();
  });
});

describe("the acquisition source", () => {
  it("shows the required error the form raises for a missing source", () => {
    // Client-side only: `CreateLeadDto` marks the key `@IsOptional()`.
    renderSection({ errors: { acquisitionSourceId: en.crmLeads.create.errors.required } });
    expect(screen.getByText(en.crmLeads.create.errors.required)).toBeTruthy();
  });

  it("offers no way back to the empty value once one is picked", () => {
    renderSection();
    // The "no source" sentinel is gone from the picker, so its label cannot
    // appear anywhere in the section — trigger placeholder included.
    expect(screen.queryByText(en.crmLeadDetail.noSource)).toBeNull();
  });
});
