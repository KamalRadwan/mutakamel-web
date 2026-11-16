// @vitest-environment jsdom

import { cleanup, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import type { RemoteOptions } from "../../hooks/useCoreOptions";
import type { OrganizationCascadeResult } from "../../hooks/useOrganizationCascade";
import { useOrganizationForm } from "../hooks/useOrganizationForm";
import { ORG_LEVEL_CONFIG } from "../level-config";
import { EMPTY_ORG_NODE_FORM } from "../organization-payloads";
import { OrganizationNodeForm } from "./OrganizationNodeForm";
import { OrganizationNodeFormModal } from "./OrganizationNodeFormModal";

const locale = vi.hoisted(() => ({ lang: "en" as "ar" | "en" }));

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: { ar, en }[locale.lang], lang: locale.lang }),
}));

vi.mock("@/i18n/useLanguage", () => ({
  useLanguage: () => locale.lang,
  useDictionary: () => ({ ar, en }[locale.lang]),
  useDirection: () => (locale.lang === "ar" ? "rtl" : "ltr"),
}));

const companyId = "01900100-0000-7000-8000-000000000010";

function makeRemoteOptions(overrides: Partial<RemoteOptions> = {}): RemoteOptions {
  return {
    options: [],
    isLoading: false,
    search: vi.fn(),
    labelFor: () => undefined,
    error: null,
    isReady: true,
    total: 0,
    hasNext: false,
    isUnsearchedReady: true,
    ...overrides,
  };
}

function makeCascade(overrides: Partial<OrganizationCascadeResult> = {}): OrganizationCascadeResult {
  return {
    companies: makeRemoteOptions(),
    branches: makeRemoteOptions({ isReady: false, isUnsearchedReady: false }),
    departments: makeRemoteOptions({ isReady: false, isUnsearchedReady: false }),
    teams: makeRemoteOptions({ isReady: false, isUnsearchedReady: false }),
    selectCompany: vi.fn(),
    selectBranch: vi.fn(),
    selectDepartment: vi.fn(),
    selectTeam: vi.fn(),
    ...overrides,
  };
}

afterEach(cleanup);

describe("OrganizationNodeForm and OrganizationNodeFormModal", () => {
  it.each(["ar", "en"] as const)(
    "explains the company currency edit requirement in %s and marks the input required",
    (lang) => {
      locale.lang = lang;
      const copy = { ar, en }[lang].coreIdentity.fields;
      render(
        <OrganizationNodeForm
          config={ORG_LEVEL_CONFIG.companies}
          values={{ ...EMPTY_ORG_NODE_FORM, currencyCode: "SAR" }}
          onChange={vi.fn()}
          mode="edit"
          isSubmitting={false}
          parentOptions={makeRemoteOptions()}
          leadUserOptions={makeRemoteOptions()}
        />,
      );
      const input = screen.getByRole("textbox", { name: copy.currencyCode }) as HTMLInputElement;
      expect(input.required).toBe(true);
      expect(screen.getByText(copy.currencyCodeRequiredHint)).toBeTruthy();
      const hint = document.getElementById(input.getAttribute("aria-describedby") ?? "");
      expect(hint?.textContent).toBe(copy.currencyCodeRequiredHint);
    },
  );

  it("keeps company currency optional on create and on unset-currency company edit, while keeping saved currency required when cleared", () => {
    locale.lang = "en";
    const { rerender } = render(
      <OrganizationNodeForm
        config={ORG_LEVEL_CONFIG.companies}
        values={EMPTY_ORG_NODE_FORM}
        onChange={vi.fn()}
        mode="create"
        isSubmitting={false}
        parentOptions={makeRemoteOptions()}
        leadUserOptions={makeRemoteOptions()}
      />,
    );
    const createInput = screen.getByRole("textbox", {
      name: en.coreIdentity.fields.currencyCode,
    }) as HTMLInputElement;
    expect(createInput.required).toBe(false);
    expect(screen.getByText(en.coreIdentity.fields.currencyCodeHint)).toBeTruthy();

    rerender(
      <OrganizationNodeForm
        config={ORG_LEVEL_CONFIG.companies}
        values={EMPTY_ORG_NODE_FORM}
        onChange={vi.fn()}
        mode="edit"
        hasSavedCurrency={false}
        isSubmitting={false}
        parentOptions={makeRemoteOptions()}
        leadUserOptions={makeRemoteOptions()}
      />,
    );
    const unsetEditInput = screen.getByRole("textbox", {
      name: en.coreIdentity.fields.currencyCode,
    }) as HTMLInputElement;
    expect(unsetEditInput.required).toBe(false);
    expect(screen.getByText(en.coreIdentity.fields.currencyCodeHint)).toBeTruthy();

    rerender(
      <OrganizationNodeForm
        config={ORG_LEVEL_CONFIG.companies}
        values={EMPTY_ORG_NODE_FORM}
        onChange={vi.fn()}
        mode="edit"
        hasSavedCurrency
        isSubmitting={false}
        parentOptions={makeRemoteOptions()}
        leadUserOptions={makeRemoteOptions()}
      />,
    );
    const clearedSavedInput = screen.getByRole("textbox", {
      name: en.coreIdentity.fields.currencyCode,
    }) as HTMLInputElement;
    expect(clearedSavedInput.required).toBe(true);
    expect(screen.getByText(en.coreIdentity.fields.currencyCodeRequiredHint)).toBeTruthy();
  });

  it("renders a centered FormModal without any side section-index rail and gates upstream permission", () => {
    locale.lang = "en";
    const { result } = renderHook(() => useOrganizationForm("departments", "create"));

    render(
      <OrganizationNodeFormModal
        open
        mode="create"
        config={ORG_LEVEL_CONFIG.departments}
        values={result.current.form}
        onChange={result.current.patch}
        isDirty={false}
        isSubmitting={false}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        cascade={makeCascade()}
        leadUserOptions={makeRemoteOptions()}
        canReadUsers
        missingUpstreamPermission
        validations={result.current.validations}
      />,
    );

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: en.crmShared.formSectionsNav })).toBeNull();
    expect(screen.getByRole("alert").textContent).toBe(
      en.coreIdentity.errors.MISSING_REQUIRED_PERMISSIONS,
    );
    const submitButton = screen.getByRole("button", { name: en.coreIdentity.levels.departments.add }) as HTMLButtonElement;
    expect(submitButton.disabled).toBe(true);
  });

  it("shows sole-option and waiting cascade hints on team create and disables lead picker without users.user.read", () => {
    locale.lang = "en";
    const cascade = makeCascade({
      companies: makeRemoteOptions({
        options: [{ value: companyId, label: "Acme Holding (ACME)" }],
        total: 1,
        hasNext: false,
        isUnsearchedReady: true,
        labelFor: (id) => (id === companyId ? "Acme Holding (ACME)" : undefined),
      }),
    });

    render(
      <OrganizationNodeForm
        config={ORG_LEVEL_CONFIG.teams}
        values={EMPTY_ORG_NODE_FORM}
        onChange={vi.fn()}
        mode="create"
        isSubmitting={false}
        cascade={cascade}
        leadUserOptions={makeRemoteOptions()}
        canReadUsers={false}
      />,
    );

    expect(screen.getByText(en.coreIdentity.cascade.singleOption)).toBeTruthy();
    expect(screen.getAllByText(en.coreIdentity.cascade.chooseCompanyFirst).length).toBeGreaterThan(0);
    expect(screen.getAllByText(en.coreIdentity.cascade.chooseBranchFirst).length).toBeGreaterThan(0);
    expect(screen.getByText(en.crmLeadDetail.usersPermissionRequired)).toBeTruthy();
  });

  it("keeps code and ancestor hierarchy read-only on team edit, falling back to unavailable when unresolved", () => {
    locale.lang = "en";
    render(
      <OrganizationNodeForm
        config={ORG_LEVEL_CONFIG.teams}
        values={{
          ...EMPTY_ORG_NODE_FORM,
          code: "SALES",
          name: "Enterprise Sales",
          status: "ACTIVE",
        }}
        onChange={vi.fn()}
        mode="edit"
        isSubmitting={false}
        leadUserOptions={makeRemoteOptions()}
        editReadOnlyParents={{
          companyLabel: "Acme Holding",
          branchLabel: undefined,
          departmentLabel: "Operations",
        }}
      />,
    );

    const codeInput = screen.getByRole("textbox", {
      name: en.coreIdentity.fields.code,
    }) as HTMLInputElement;
    const companyInput = screen.getByRole("textbox", {
      name: en.coreIdentity.levels.companies.parentLabel,
    }) as HTMLInputElement;
    const branchInput = screen.getByRole("textbox", {
      name: en.coreIdentity.levels.branches.parentLabel,
    }) as HTMLInputElement;
    const deptInput = screen.getByRole("textbox", {
      name: en.coreIdentity.levels.departments.parentLabel,
    }) as HTMLInputElement;

    expect(codeInput.readOnly).toBe(true);
    expect(companyInput.readOnly).toBe(true);
    expect(companyInput.value).toBe("Acme Holding");
    expect(branchInput.readOnly).toBe(true);
    expect(branchInput.value).toBe(en.coreIdentity.grants.nameUnavailable);
    expect(deptInput.readOnly).toBe(true);
    expect(deptInput.value).toBe("Operations");
  });
});
