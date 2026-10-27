// @vitest-environment jsdom

import { createElement, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import type { OpportunityActionCapability, OpportunityPipeline } from "../hooks/pipeline-types";
import { CreateOpportunityModal, type CreateOpportunityModalProps } from "./CreateOpportunityModal";
import { OpportunityExecutiveBoardView } from "./OpportunityExecutiveBoardView";

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({ user: { id: "self", firstName: "My", lastName: "Name", email: "me@example.com" } }),
}));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("../../leads/[id]/hooks/readLeadOwnerOptions", () => ({
  readOwnerOptions: async () => [
    { id: "self", firstName: "My", lastName: "Name" },
    { id: "team", firstName: "Team", lastName: "Mate" },
    { id: "other", firstName: "Other", lastName: "Person" },
  ],
}));
vi.mock("../../leads/hooks/useCreateLeadTags", () => ({
  useCreateLeadTags: () => ({ items: [{ id: "tag-id", name: "Priority", backgroundColor: "#eee", textColor: "#111" }], canManage: false }),
}));
vi.mock("../../leads/components/create-lead/CreateTagModal", () => ({ CreateTagModal: () => null }));
vi.mock("../../shared/hooks/useCrmErrorText", () => ({ useCrmErrorText: () => () => null }));
vi.mock("../hooks/useCreateOpportunity", () => ({ useOpportunityCurrencyOptions: () => [] }));
vi.mock("../hooks/useCustomerProfileOptions", () => ({
  useCustomerProfileOptions: () => ({
    items: [
      { id: "mine", displayName: "My customer", ownerUserId: "self" },
      { id: "teammate", displayName: "Team customer", ownerUserId: "team" },
      { id: "outside", displayName: "Other customer", ownerUserId: "other" },
      { id: "unowned", displayName: "Unowned customer", ownerUserId: null },
    ], isLoading: false, search: vi.fn(),
  }),
}));
vi.mock("@/design-system", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/design-system")>();
  const Children = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return {
    ...actual,
    FormModal: ({ headerAside, children, footerLeading, submitDisabled, isSubmitting, onSubmit, labels }: {
      headerAside: ReactNode; children: ReactNode; footerLeading: ReactNode;
      submitDisabled: boolean; isSubmitting: boolean; onSubmit: () => void; labels: { submit: string };
    }) => <>{headerAside}{children}{footerLeading}
      {createElement("button", { disabled: submitDisabled || isSubmitting, onClick: onSubmit }, labels.submit)}
    </>,
    Field: Children, Select: Children, SelectContent: Children,
    SelectItem: ({ children, value }: { children: ReactNode; value: string }) => <span data-owner={value}>{children}</span>,
    SelectTrigger: () => null, SelectValue: () => null,
    Combobox: ({ options, onValueChange }: {
      options: { value: string; label: string }[];
      onValueChange: (value: string) => void;
    }) => <select aria-label="Customer choices" onChange={(event) => onValueChange(event.target.value)}>
      <option value="">Choose</option>
      {options.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
    </select>,
    Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) =>
      createElement("button", props, children),
    Input: () => null, Textarea: () => null, DatePicker: () => null,
    AmbiguousOutcomePanel: ({ onRetry, onDismiss, retrying }: {
      onRetry: () => void; onDismiss: () => void; retrying: boolean;
    }) => <>{createElement("button", { disabled: retrying, onClick: onRetry }, "Retry original create")}
      {createElement("button", { disabled: retrying, onClick: onDismiss }, "Hide uncertainty")}</>,
    DegradedBanner: () => null,
    Money: () => null, TagChip: ({ label }: { label: string }) => <span>{label}</span>, Badge: () => null,
    DateTime: () => null, StatusBadge: () => null, useToast: () => ({ success: vi.fn() }),
    cn: (...values: unknown[]) => values.filter(Boolean).join(" "),
  };
});

const branchId = "01923e24-c600-7000-8000-000000000001";
const pipeline: OpportunityPipeline = {
  id: "pipeline", code: "SALES", nameEn: "Sales", nameAr: "Sales", isActive: true, isDefault: true,
  stages: [{ id: "stage", pipelineId: "pipeline", opportunityStageId: "catalogue",
    nameEn: "New", nameAr: "New", flag: "NEW", category: "IN_PROGRESS",
    rank: 1, isActive: true, isSystem: true }],
};
const create = {
  open: true, isSubmitting: false, isDirty: false, errors: {}, selectableStages: pipeline.stages,
  form: { customerProfileId: "", pipelineId: "pipeline", stageId: "stage", title: "", amount: "",
    currencyCode: "", probabilityPercent: "", expectedCloseDate: "", importance: "0",
    ownerUserId: "", tagIds: [], description: "", customFields: {} },
  sectionErrorCount: () => 0, selectCustomer: vi.fn(), touch: vi.fn(),
} as unknown as CreateOpportunityModalProps["create"];
const customFields = { definitions: [], degraded: false } as unknown as CreateOpportunityModalProps["customFields"];

const scopes: { name: string; capability: OpportunityActionCapability | null; customers: string[]; owners: string[] }[] = [
  { name: "own", capability: { scope: "own", ownerUserIds: ["self"] }, customers: ["My customer"], owners: ["My Name"] },
  { name: "team", capability: { scope: "team", ownerUserIds: ["self", "team"] }, customers: ["My customer", "Team customer"], owners: ["My Name", "Team Mate"] },
  { name: "all", capability: { scope: "all", ownerUserIds: null }, customers: ["My customer", "Team customer", "Other customer", "Unowned customer"], owners: ["My Name", "Team Mate", "Other Person"] },
  { name: "unavailable", capability: null, customers: [], owners: [] },
];
afterEach(cleanup);

function customerLabels() {
  return screen.getAllByRole("option").map((option) => option.textContent).filter((label) => label !== "Choose");
}

describe.each(scopes)("opportunity create $name scope", ({ capability, customers, owners }) => {
  it("filters both customer and salesperson choices in the full form", async () => {
    const { container } = render(<CreateOpportunityModal create={create} pipelines={[pipeline]}
      branchId={branchId} customFields={customFields} createCapability={capability}
      updateCapability={capability} />);
    await waitFor(() => expect([...container.querySelectorAll("[data-owner]")]
      .filter((option) => ["__default_owner__", "self", "team", "other"].includes(option.getAttribute("data-owner") ?? ""))
      .map((option) => option.textContent)).toEqual(owners));
    expect(customerLabels()).toEqual(customers);
    if (customers.length) {
      fireEvent.change(screen.getByRole("combobox"), { target: { value: "mine" } });
      expect(create.selectCustomer).toHaveBeenCalledWith("mine", "My customer");
    }
  });

  it("filters the Board quick-add customer choices", () => {
    render(<OpportunityExecutiveBoardView pipeline={pipeline} board={null} branchId={branchId}
      isLoading={false} isMutating={false} loadingStageId={null}
      canCreate={Boolean(capability)} createCapability={capability}
      canUpdate={() => false} canDelete={() => false} onOpen={vi.fn()} onDelete={vi.fn()}
      onOpenActivities={vi.fn()} onCardChange={vi.fn()} onMoveCard={vi.fn()} onLoadMoreStage={vi.fn()} />);
    const quickAdd = screen.queryByRole("button", { name: `${en.crmOpportunityDetail.createAction}: New` });
    if (!capability) {
      expect(quickAdd).toBeNull();
      expect(screen.queryByRole("combobox")).toBeNull();
      return;
    }
    fireEvent.click(quickAdd!);
    expect(customerLabels()).toEqual(customers);
  });
});

describe("opportunity create tags", () => {
  it("requires scoped update access before offering tag selection", () => {
    const { rerender } = render(<CreateOpportunityModal create={create} pipelines={[pipeline]}
      branchId={branchId} customFields={customFields}
      createCapability={{ scope: "all", ownerUserIds: null }} updateCapability={null} />);
    expect(screen.queryByRole("button", { name: "Priority" })).toBeNull();
    expect(screen.getByText(en.crmOpportunityDetail.create.tagsRequireUpdate)).toBeTruthy();

    rerender(<CreateOpportunityModal create={create} pipelines={[pipeline]}
      branchId={branchId} customFields={customFields}
      createCapability={{ scope: "all", ownerUserIds: null }}
      updateCapability={{ scope: "own", ownerUserIds: ["self"] }} />);
    expect(screen.getByRole("button", { name: "Priority" })).toBeTruthy();
  });

  it("shows the existing opportunity ID and a tag-only retry for a partial create", () => {
    const opportunityId = "01923e24-c600-7000-8000-000000000099";
    const createWithRecovery = {
      ...create,
      tagRecovery: {
        opportunityId,
        tagIds: ["tag-id"],
        status: "failed",
        attempt: { idempotencyKey: "01923e24-c600-7000-8000-000000000098" },
        error: { status: 422 },
      },
      isRetryingTags: false,
      retryTagAttachment: vi.fn(),
    } as unknown as CreateOpportunityModalProps["create"];
    render(<CreateOpportunityModal create={createWithRecovery} pipelines={[pipeline]}
      branchId={branchId} customFields={customFields}
      createCapability={{ scope: "all", ownerUserIds: null }}
      updateCapability={{ scope: "all", ownerUserIds: null }} />);

    expect(screen.getByText(en.crmOpportunityDetail.create.tagsFailedTitle)).toBeTruthy();
    expect(screen.getByText((content) => content.includes(opportunityId))).toBeTruthy();
    expect(screen.getByRole("button", { name: en.crmOpportunityDetail.create.retryTags })).toBeTruthy();
  });
});

it("blocks both fresh create actions and only offers replay or hide while uncertain", async () => {
  const submit = vi.fn();
  const replay = vi.fn().mockResolvedValue(undefined);
  const closeModal = vi.fn();
  const pending = {
    ...create, submit, closeModal,
    ambiguity: { attempt: { idempotencyKey: branchId }, error: { status: 0 }, replay },
  };
  const props = {
    create: pending,
    pipelines: [pipeline],
    branchId,
    customFields,
    createCapability: scopes[2].capability,
    updateCapability: scopes[2].capability,
  };
  const { rerender } = render(<CreateOpportunityModal {...props} />);
  await waitFor(() => expect(screen.getByRole("button", { name: en.common.create })).toBeDisabled());
  const createAnother = screen.getByRole("button", { name: en.crmOpportunities.createAndAddAnother });
  expect(createAnother).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: en.common.create }));
  fireEvent.click(createAnother);
  expect(submit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Retry original create" }));
  expect(replay).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Hide uncertainty" }));
  expect(closeModal).toHaveBeenCalledOnce();
  rerender(<CreateOpportunityModal {...props} create={{ ...pending, isSubmitting: true }} />);
  expect(screen.getByRole("button", { name: "Retry original create" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Hide uncertainty" })).toBeDisabled();
});
