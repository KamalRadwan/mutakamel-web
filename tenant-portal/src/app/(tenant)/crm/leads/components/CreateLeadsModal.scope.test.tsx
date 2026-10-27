// @vitest-environment jsdom

import { createElement, type ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import type { CrmActionCapability } from "../../shared/crm-capabilities";
import { emptyCreateLeadForm } from "../lead-create-contract";
import { CreateLeadsModal } from "./CreateLeadsModal";

const BRANCH = "01900100-0000-7000-8000-000000000002";
const OTHER_BRANCH = "01900100-0000-7000-8000-000000000003";
const DENIED_BRANCH = "01900100-0000-7000-8000-000000000004";
const ACTOR = "01900100-0000-7000-8000-000000000005";
const OTHER_OWNER = "01900100-0000-7000-8000-000000000006";
const COMPANY = "01900100-0000-7000-8000-000000000007";
const organizationAccess = {
  companies: [COMPANY],
  branchCompanies: [BRANCH, OTHER_BRANCH, DENIED_BRANCH].map((branchId) => ({ branchId, companyId: COMPANY })),
};
const capability = { scope: "own", ownerUserIds: [ACTOR] } satisfies CrmActionCapability;
const access = {
  capabilities: new Map<string, CrmActionCapability>(), branchIds: [] as string[], isLoading: false, degraded: false,
};
const { readOwners } = vi.hoisted(() => ({ readOwners: vi.fn() }));

vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: {
  id: ACTOR, accessibleBranches: [BRANCH, OTHER_BRANCH, DENIED_BRANCH], accessibleCompanies: organizationAccess.companies,
  accessibleBranchCompanies: organizationAccess.branchCompanies,
  teamMemberships: [],
} }) }));
vi.mock("@/hooks/useTenantBranchSelection", () => ({ useTenantBranchSelection: () => ({
  branchId: BRANCH, branchIds: [BRANCH, OTHER_BRANCH, DENIED_BRANCH],
}) }));
vi.mock("../hooks/useLeadCapabilities", () => ({ useLeadCreateCapabilities: () => access }));
vi.mock("../[id]/hooks/readLeadOwnerOptions", () => ({ readAssignableLeadOwners: readOwners }));
vi.mock("../../shared/hooks/useCrmFieldMessages", () => ({ useCrmFieldMessages: () => ({}) }));
vi.mock("../../shared/hooks/useCrmAcquisitionSources", () => ({ useCrmAcquisitionSources: () => ({ items: [] }) }));
vi.mock("../../shared/hooks/useCrmCreateCustomFields", () => ({ useCrmCreateCustomFields: () => ({ requiredFieldKeys: [], definitions: [] }) }));
vi.mock("../hooks/useCreateLeadTags", () => ({ useCreateLeadTags: () => ({ items: [] }) }));
vi.mock("../hooks/useLeadDuplicateCheck", () => ({ useLeadDuplicateCheck: () => [] }));
vi.mock("../hooks/useLeadCompanyOptions", () => ({ useLeadCompanyOptions: () => ({ companies: [], contacts: [], reset: vi.fn() }) }));
vi.mock("../hooks/useCreateLeadForm", async () => {
  const { useState } = await import("react");
  return { useCreateLeadForm: () => {
    const [form, setForm] = useState(() => emptyCreateLeadForm("contact"));
    return {
      form, errors: {}, allErrors: {}, isDirty: false,
      setField: (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value })),
      selectCompany: vi.fn(), revealAll: vi.fn(), reset: vi.fn(),
      clearServerErrors: vi.fn(), reportServerError: vi.fn(),
    };
  } };
});
vi.mock("@/design-system", () => ({
  FormModal: ({ titleBadge, headerAside, children, footerLeading, submitDisabled, onSubmit }: {
    titleBadge: ReactNode; headerAside?: ReactNode; children: ReactNode; footerLeading: ReactNode; submitDisabled: boolean; onSubmit: () => void;
  }) => <div>{titleBadge}{headerAside}{children}{footerLeading}{createElement("button", { disabled: submitDisabled, onClick: onSubmit }, "Save lead")}</div>,
  Button: ({ children, disabled, onClick }: { children: ReactNode; disabled: boolean; onClick: () => void }) =>
    createElement("button", { disabled, onClick }, children),
  Select: ({ children, value, disabled, onValueChange }: {
    children: ReactNode; value: string; disabled: boolean; onValueChange: (value: string) => void;
  }) => <select aria-label="Owner" value={value} disabled={disabled} onChange={(event) => onValueChange(event.target.value)}>{children}</select>,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectTrigger: () => null, SelectValue: () => null,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => <option value={value}>{children}</option>,
  DegradedBanner: ({ message }: { message: string }) => <p>{message}</p>,
  IdentifierText: ({ children }: { children: ReactNode }) => <bdi>{children}</bdi>,
  TagChip: () => null, WorkspaceLink: () => null, cn: () => "", proseMeasure: "",
}));
vi.mock("./create-lead/LeadClassificationSection", () => ({ LeadClassificationSection: ({ branchIds, branchId, onBranchChange }: {
  branchIds: string[]; branchId: string; onBranchChange: (id: string) => void;
}) => <select aria-label="Branch" value={branchId} onChange={(event) => onBranchChange(event.target.value)}>
  {branchIds.map((id) => <option key={id} value={id}>{id}</option>)}
</select> }));
vi.mock("./create-lead/CreateTagModal", () => ({ CreateTagModal: () => null }));
vi.mock("./create-lead/LeadAddressSection", () => ({ LeadAddressSection: () => null }));
vi.mock("./create-lead/LeadCompanySection", () => ({ LeadCompanySection: () => null }));
vi.mock("./create-lead/LeadContactsSection", () => ({ LeadContactsSection: () => null }));
vi.mock("./create-lead/LeadFieldGuide", () => ({ LeadFieldGuide: () => null }));
vi.mock("./create-lead/LeadPersonSection", () => ({ LeadPersonSection: () => null }));
vi.mock("./create-lead/LeadQualificationSection", () => ({ LeadQualificationSection: () => null }));

beforeEach(() => {
  organizationAccess.companies = [COMPANY];
  organizationAccess.branchCompanies = [BRANCH, OTHER_BRANCH, DENIED_BRANCH].map((branchId) => ({ branchId, companyId: COMPANY }));
  access.capabilities = new Map([[BRANCH, capability], [OTHER_BRANCH, capability]]);
  access.branchIds = [BRANCH, OTHER_BRANCH]; access.isLoading = false; access.degraded = false;
  readOwners.mockResolvedValue([
    { id: ACTOR, firstName: "Actor", lastName: "" }, { id: OTHER_OWNER, firstName: "Other rep", lastName: "" },
  ]);
});
afterEach(() => { cleanup(); readOwners.mockReset(); });

function modal(onSubmit = vi.fn().mockResolvedValue(true), branchId = BRANCH) {
  return <CreateLeadsModal stages={[]} branchId={branchId} onSubmit={onSubmit} error={null} onClose={vi.fn()} />;
}

describe("full-create branch and owner admission", () => {
  it("offers only the actor for own scope and omits branches without create access", async () => {
    const save = vi.fn().mockResolvedValue(true);
    render(modal(save, DENIED_BRANCH));
    await waitFor(() => expect(screen.getByLabelText("Owner")).toBeTruthy());
    expect(within(screen.getByLabelText("Owner")).getAllByRole("option").map((item) => item.textContent)).toEqual(["Actor"]);
    expect(within(screen.getByLabelText("Branch")).queryByText(DENIED_BRANCH)).toBeNull();
    expect(readOwners).toHaveBeenCalledWith(BRANCH, "create", expect.any(AbortSignal), {
      "x-mutakamel-company-id": COMPANY, "x-mutakamel-branch-id": BRANCH,
    });
    fireEvent.click(screen.getByRole("button", { name: "Save lead" }));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ branchId: BRANCH, ownerUserId: ACTOR }), undefined, expect.any(Function));
  });

  it("clears the previous branch owner and waits for the new branch candidates", async () => {
    access.capabilities.set(BRANCH, { scope: "all", ownerUserIds: null });
    let resolveOwners: ((items: { id: string; firstName: string; lastName: string }[]) => void) | undefined;
    readOwners.mockImplementation((branchId: string) => branchId === BRANCH
      ? Promise.resolve([{ id: OTHER_OWNER, firstName: "Other rep", lastName: "" }])
      : new Promise((resolve) => { resolveOwners = resolve; }));
    const save = vi.fn().mockResolvedValue(true);
    render(modal(save));
    await waitFor(() => expect(screen.getByLabelText("Owner")).toBeTruthy());
    fireEvent.change(screen.getByLabelText("Owner"), { target: { value: OTHER_OWNER } });
    fireEvent.change(screen.getByLabelText("Branch"), { target: { value: OTHER_BRANCH } });
    expect(screen.queryByLabelText("Owner")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save lead" }));
    expect(save).not.toHaveBeenCalled();
    await act(async () => { resolveOwners?.([{ id: ACTOR, firstName: "Actor", lastName: "" }]); });
    await waitFor(() => expect(screen.getByLabelText("Owner")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Save lead" }));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ branchId: OTHER_BRANCH, ownerUserId: ACTOR }), undefined, expect.any(Function));
    expect(readOwners).toHaveBeenLastCalledWith(OTHER_BRANCH, "create", expect.any(AbortSignal), {
      "x-mutakamel-company-id": COMPANY, "x-mutakamel-branch-id": OTHER_BRANCH,
    });
  });

  it("waits for the selected branch's company before reading owners", async () => {
    organizationAccess.companies = [];
    organizationAccess.branchCompanies = [];
    const save = vi.fn();
    const { rerender } = render(modal(save));
    expect(readOwners).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save lead" }));
    expect(save).not.toHaveBeenCalled();

    organizationAccess.companies = [COMPANY];
    organizationAccess.branchCompanies = [{ branchId: BRANCH, companyId: COMPANY }];
    rerender(modal(save));
    await waitFor(() => expect(readOwners).toHaveBeenCalledWith(BRANCH, "create", expect.any(AbortSignal), {
      "x-mutakamel-company-id": COMPANY, "x-mutakamel-branch-id": BRANCH,
    }));
  });

  it("does not invent an actor option when CRM omits that user", async () => {
    readOwners.mockResolvedValue([{ id: OTHER_OWNER, firstName: "Other rep", lastName: "" }]);
    const save = vi.fn();
    render(modal(save));
    await waitFor(() => expect(readOwners).toHaveBeenCalledOnce());
    expect(screen.queryByLabelText("Owner")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save lead" }));
    expect(save).not.toHaveBeenCalled();
  });

  it("blocks both submit paths while capabilities load or no branch allows creation", () => {
    access.capabilities.clear(); access.branchIds = []; access.isLoading = true;
    const save = vi.fn();
    const { rerender } = render(modal(save));
    expect(screen.getByRole("status").textContent).toBe(en.common.loading);
    fireEvent.click(screen.getByRole("button", { name: "Save lead" }));
    fireEvent.click(screen.getByRole("button", { name: "Create & Add Another" }));
    expect(save).not.toHaveBeenCalled(); expect(readOwners).not.toHaveBeenCalled();
    access.isLoading = false;
    rerender(modal(save));
    expect(screen.getByText(en.crmShared.scopeDeniedTitle)).toBeTruthy();
    expect(within(screen.getByLabelText("Branch")).queryAllByRole("option")).toEqual([]);
  });
});
