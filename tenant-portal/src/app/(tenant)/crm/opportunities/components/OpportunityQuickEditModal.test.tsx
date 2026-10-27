// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { axiosClient, type AxiosResponse } from "@/lib/api/axiosClient";
import { runIdempotentWrite } from "@/lib/api/idempotent-write";
import { opportunityPath, opportunityStageHistoryPath, parseOpportunityDetailResponse } from "../opportunity-contract";
import { OpportunityPhoneActions, OpportunityQuickEditModal, type OpportunityQuickEditModalProps } from "./OpportunityQuickEditModal";

const auth = vi.hoisted(() => ({ permissions: [] as string[], canMutate: true }));
vi.mock("@/hooks/useAccessMode", () => ({ useAccessMode: () => ({ canMutate: auth.canMutate }) }));
vi.mock("@/hooks/useOrganizationScope", () => ({ useOrganizationScopeHeaders: () => ownerScope }));
const ownerScope = { ready: true, headers: {} };
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: auth }) }));
vi.mock("@/design-system", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/design-system")>(),
  useToast: () => ({ success: vi.fn() }),
}));
vi.mock("@/lib/api/idempotent-write", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/api/idempotent-write")>(),
  createWriteAttempt: vi.fn(() => ({})),
  runIdempotentWrite: vi.fn(),
}));
vi.mock("../../shared/hooks/useCrmRecordCapabilities", () => ({
  useCrmRecordCapabilities: () => ({ capabilities: {} }),
}));
vi.mock("../hooks/useOpportunityDocumentCounts", () => ({
  useOpportunityDocumentCounts: () => ({ countsByParty: new Map() }),
}));
vi.mock("@/components/activities/RecordActivitiesPanel", () => ({ RecordActivitiesPanel: () => null }));
vi.mock("@/components/audit/EntityHistoryCard", () => ({ EntityHistoryCard: () => null }));
vi.mock("@/components/audit/RecordHistoryTab", () => ({ RecordHistoryTab: () => null }));
vi.mock("@/components/audit/hooks/useAuditAccess", () => ({ useAuditAccess: () => true }));
vi.mock("../../shared/components/CustomFieldsCard", () => ({ CustomFieldsCard: () => null }));
vi.mock("../../shared/components/RecordNotesSection", () => ({ RecordNotesSection: () => null }));
vi.mock("../../shared/components/RecordAttachmentsSection", () => ({ RecordAttachmentsSection: () => null }));
vi.mock("../../leads/components/create-lead/CreateTagModal", () => ({ CreateTagModal: () => null }));
vi.mock("../hooks/usePipelineWorkspace", () => ({
  readAssignableOpportunityOwners: async () => [{
    id: "01900100-0000-7000-8000-000000000070", firstName: "Sara", lastName: "Sales",
  }],
}));

const detail = parseOpportunityDetailResponse({
  id: "01900100-0000-7000-8000-000000000001",
  branchId: "01900100-0000-7000-8000-000000000099",
  customerProfileId: "01900100-0000-7000-8000-000000000040",
  customerPartyId: null, contactPartyId: null, leadId: null,
  pipelineId: "01900100-0000-7000-8000-000000000050",
  stageId: "01900100-0000-7000-8000-000000000051",
  stageFlag: "QUALIFICATION", status: "IN_PROGRESS", title: "ERP rollout",
  importance: 0, cardColor: null, amount: null, currencyCode: null,
  description: "Preserve this server description", expectedCloseDate: null,
  probabilityPercent: null, ownerUserId: null, wonAt: null, lostAt: null, lostReason: null,
  createdAt: "2026-10-01T12:00:00.000Z", updatedAt: "2026-10-01T12:00:00.000Z",
});
// Card/Table rows omit description, unlike the complete detail response.
const row = { ...detail, description: undefined };
const props: OpportunityQuickEditModalProps = {
  item: row, stages: [], branchId: detail.branchId,
  canUpdate: () => true, canDelete: () => false,
  onClose: vi.fn(), onOpenActivities: vi.fn(), onCardChange: vi.fn(async () => true),
  onMoveStage: vi.fn(), onDelete: vi.fn(),
};
const response = (data: unknown): AxiosResponse<unknown> => ({
  data, status: 200, statusText: "OK", headers: new Headers(),
});

beforeEach(() => {
  auth.permissions = [];
  auth.canMutate = true;
  vi.spyOn(axiosClient, "get").mockImplementation(async (path) =>
    response(path === opportunityPath(detail.id) ? detail : []));
  vi.mocked(runIdempotentWrite).mockResolvedValue({ kind: "success", value: detail, replayed: false });
});

describe("Opportunity quick-edit write outcomes", () => {
  it("loads older stage changes only on request", async () => {
    const entry = {
      id: "01900100-0000-7000-8000-000000000080", changedAt: detail.createdAt,
      fromStageSnapshot: null, toStageSnapshot: null, reason: "First history page",
    };
    vi.mocked(axiosClient.get).mockImplementation(async (path) => response(
      path === opportunityPath(detail.id) ? detail
        : path === opportunityStageHistoryPath(detail.id) ? { items: [entry], nextCursor: "older_cursor" }
          : path === opportunityStageHistoryPath(detail.id, "older_cursor")
            ? { items: [{ ...entry, id: "01900100-0000-7000-8000-000000000081", reason: "Older history page" }], nextCursor: null }
            : [],
    ));
    render(<OpportunityQuickEditModal {...props} />);
    await screen.findByRole("button", { name: en.crmLeadDetail.edit });
    fireEvent.click(screen.getByRole("tab", { name: en.crmOpportunityDetail.historyTitle }));
    expect(await screen.findByText("First history page")).toBeTruthy();
    expect(screen.queryByText("Older history page")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: en.crmOpportunityDetail.historyLoadMore }));
    expect(await screen.findByText("Older history page")).toBeTruthy();
    expect(screen.queryByRole("button", { name: en.crmOpportunityDetail.historyLoadMore })).toBeNull();
  });
  const tag = {
    id: "01900100-0000-7000-8000-000000000061", name: "Renewal",
    backgroundColor: null, textColor: null,
    createdAt: "2026-10-01T12:00:00.000Z", updatedAt: "2026-10-01T12:00:00.000Z",
  };
  const refusal = { kind: "failed" as const, error: { status: 403, message: "Raw server message" } };

  it("hides tag creation without crm.tags.manage while allowing existing tags", async () => {
    const view = render(<OpportunityQuickEditModal {...props} />);
    await screen.findByRole("button", { name: en.crmLeadDetail.edit });
    expect(screen.queryByRole("button", { name: `+ ${en.crmTags.add}` })).toBeNull();
    expect(screen.getByRole("button", { name: en.crmOpportunities.selectExistingTags })).toBeTruthy();
    auth.permissions = ["crm.tags.manage"];
    view.rerender(<OpportunityQuickEditModal {...props} />);
    expect(screen.getByRole("button", { name: `+ ${en.crmTags.add}` })).toBeTruthy();
    view.rerender(<OpportunityQuickEditModal {...props} canUpdate={() => false} />);
    expect(screen.queryByRole("button", { name: `+ ${en.crmTags.add}` })).toBeNull();
  });

  it("rolls back a refused attach and shows translated feedback without reporting success", async () => {
    vi.mocked(axiosClient.get).mockImplementation(async (path) =>
      response(path === opportunityPath(detail.id) ? detail : path.endsWith("/tags") && !path.includes(detail.id) ? [tag] : []));
    vi.mocked(runIdempotentWrite).mockResolvedValue(refusal);
    const onSaved = vi.fn();
    render(<OpportunityQuickEditModal {...props} onSaved={onSaved} />);
    await screen.findByRole("button", { name: en.crmLeadDetail.edit });
    fireEvent.click(screen.getByRole("button", { name: en.crmOpportunities.selectExistingTags }));
    fireEvent.click(await screen.findByRole("button", { name: tag.name }));
    expect((await screen.findByRole("alert")).textContent).toBe(en.crmShared.errorForbidden);
    expect(screen.queryByRole("button", { name: `Remove ${tag.name}` })).toBeNull();
    expect(onSaved).not.toHaveBeenCalled();
    expect(runIdempotentWrite).toHaveBeenCalledWith(expect.objectContaining({
      method: "post", body: { tagIds: [tag.id] },
    }));
  });

  it("restores a tag after a refused detach", async () => {
    vi.mocked(axiosClient.get).mockImplementation(async (path) =>
      response(path === opportunityPath(detail.id) ? { ...detail, tags: [tag] } : path.endsWith("/tags") ? [tag] : []));
    vi.mocked(runIdempotentWrite).mockResolvedValue(refusal);
    render(<OpportunityQuickEditModal {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: `Remove ${tag.name}` }));
    expect((await screen.findByRole("alert")).textContent).toBe(en.crmShared.errorForbidden);
    expect(screen.getByRole("button", { name: `Remove ${tag.name}` })).toBeTruthy();
  });

  it("keeps an accepted attach and reports the saved change", async () => {
    vi.mocked(axiosClient.get).mockImplementation(async (path) =>
      response(path === opportunityPath(detail.id) ? detail : path.endsWith("/tags") && !path.includes(detail.id) ? [tag] : []));
    const onSaved = vi.fn();
    render(<OpportunityQuickEditModal {...props} onSaved={onSaved} />);
    await screen.findByRole("button", { name: en.crmLeadDetail.edit });
    fireEvent.click(screen.getByRole("button", { name: en.crmOpportunities.selectExistingTags }));
    fireEvent.click(await screen.findByRole("button", { name: tag.name }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(screen.getByRole("button", { name: `Remove ${tag.name}` })).toBeTruthy();
  });

  it("translates a refused deal save instead of displaying the raw server message", async () => {
    vi.mocked(runIdempotentWrite).mockResolvedValue(refusal);
    render(<OpportunityQuickEditModal {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: en.crmLeadDetail.edit }));
    fireEvent.change(screen.getByDisplayValue(detail.title), { target: { value: "New title" } });
    fireEvent.click(screen.getByRole("button", { name: en.common.save }));
    expect((await screen.findByRole("alert")).textContent).toBe(en.crmShared.errorForbidden);
    expect(screen.getByRole("button", { name: en.common.save })).toBeTruthy();
  });

  it("sends null when an existing amount is cleared", async () => {
    const pricedDetail = { ...detail, amount: "125.00", currencyCode: "KWD" };
    vi.mocked(axiosClient.get).mockImplementation(async (path) =>
      response(path === opportunityPath(detail.id) ? pricedDetail : []));
    render(<OpportunityQuickEditModal {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: en.crmLeadDetail.edit }));
    fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: en.common.save }));
    await waitFor(() => expect(runIdempotentWrite).toHaveBeenCalledWith(expect.objectContaining({
      method: "patch", body: { amount: null },
    })));
  });

  it("leaves untouched money out of a title edit even when stored currency is missing", async () => {
    vi.mocked(axiosClient.get).mockImplementation(async (path) =>
      response(path === opportunityPath(detail.id) ? { ...detail, amount: "5.00" } : []));
    render(<OpportunityQuickEditModal {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: en.crmLeadDetail.edit }));
    fireEvent.change(screen.getByDisplayValue(detail.title), { target: { value: "New title" } });
    fireEvent.click(screen.getByRole("button", { name: en.common.save }));
    await waitFor(() => expect(runIdempotentWrite).toHaveBeenCalledWith(expect.objectContaining({
      body: { title: "New title" },
    })));
  });

  it("blocks setting zero without a currency", async () => {
    render(<OpportunityQuickEditModal {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: en.crmLeadDetail.edit }));
    fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: en.common.save }));
    expect((await screen.findByRole("alert")).textContent)
      .toBe(en.crmShared.refusals.OPPORTUNITY_AMOUNT_CURRENCY_REQUIRED);
    expect(runIdempotentWrite).not.toHaveBeenCalled();
  });

  it.each(["OPPORTUNITY_AMOUNT_CURRENCY_REQUIRED", "OPPORTUNITY_AMOUNT_SCALE_INVALID"] as const)(
    "translates the API amount refusal %s", async (code) => {
      vi.mocked(runIdempotentWrite).mockResolvedValue({ kind: "failed", error: { status: 422, code } });
      render(<OpportunityQuickEditModal {...props} />);
      fireEvent.click(await screen.findByRole("button", { name: en.crmLeadDetail.edit }));
      fireEvent.change(screen.getByDisplayValue(detail.title), { target: { value: "New title" } });
      fireEvent.click(screen.getByRole("button", { name: en.common.save }));
      expect((await screen.findByRole("alert")).textContent).toBe(en.crmShared.refusals[code]);
    },
  );

  it("offers CRM owners without Core users.user.read or an Unassigned option", async () => {
    render(<OpportunityQuickEditModal {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: en.crmLeadDetail.edit }));
    expect(await screen.findByRole("option", { name: "Sara Sales" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Unassigned" })).toBeNull();
  });

  it("restores optimistic importance and colour when the workspace refuses the patch", async () => {
    const onCardChange = vi.fn(async () => false);
    const { container } = render(<OpportunityQuickEditModal {...props} onCardChange={onCardChange} />);
    await screen.findByRole("button", { name: en.crmLeadDetail.edit });
    const stars = Array.from(container.querySelectorAll("button")).filter((button) => button.querySelector("svg.lucide-star"));
    fireEvent.click(stars[0]);
    await screen.findByRole("alert");
    expect(stars[0].querySelector("svg")?.classList.contains("fill-warning")).toBe(false);
    expect(onCardChange).toHaveBeenLastCalledWith(detail.id, { importance: 1 }, expect.objectContaining({ importance: 0 }));
    const colours = Array.from(container.querySelectorAll("button")).filter((button) => button.style.backgroundColor);
    fireEvent.click(colours[0]);
    await waitFor(() => expect(onCardChange).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(colours[0].classList.contains("ring-2")).toBe(false));
    expect(screen.getByRole("alert").textContent).toBe(en.crmOpportunities.cardUpdateFailed);
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); });

describe("Opportunity quick-edit detail safety", () => {
  it("offers no edit or save while detail is pending", () => {
    vi.mocked(axiosClient.get).mockReturnValue(new Promise(() => {}));
    render(<OpportunityQuickEditModal {...props} />);
    expect(screen.getByRole("status").textContent).toBe(en.common.loading);
    expect(screen.queryByRole("button", { name: en.crmLeadDetail.edit })).toBeNull();
    expect(screen.queryByRole("button", { name: en.common.save })).toBeNull();
    expect(runIdempotentWrite).not.toHaveBeenCalled();
  });

  it("shows a failed detail read without enabling writes, then allows retry", async () => {
    vi.mocked(axiosClient.get).mockRejectedValue(new Error("Unavailable"));
    render(<OpportunityQuickEditModal {...props} />);
    expect((await screen.findByRole("alert")).textContent).toBe(en.crmOpportunities.loadFailed);
    expect(screen.queryByRole("button", { name: en.common.save })).toBeNull();
    expect(runIdempotentWrite).not.toHaveBeenCalled();
    vi.mocked(axiosClient.get).mockImplementation(async (path) =>
      response(path === opportunityPath(detail.id) ? detail : []));
    fireEvent.click(screen.getByRole("button", { name: en.common.retry }));
    await screen.findByRole("button", { name: en.crmLeadDetail.edit });
  });

  it("sends only title when description and other fields are untouched", async () => {
    render(<OpportunityQuickEditModal {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: en.crmLeadDetail.edit }));
    fireEvent.change(screen.getByDisplayValue(detail.title), { target: { value: "Updated title" } });
    fireEvent.click(screen.getByRole("button", { name: en.common.save }));
    await waitFor(() => expect(runIdempotentWrite).toHaveBeenCalledWith(expect.objectContaining({
      path: opportunityPath(detail.id), body: { title: "Updated title" },
    })));
  });

  it("loads tenant currency choices and saves an explicit selection", async () => {
    auth.permissions = ["currencies.currency.read"];
    vi.mocked(axiosClient.get).mockImplementation(async (path) => response(
      path === opportunityPath(detail.id) ? detail
        : path.startsWith("/api/tenant/core/v1/currencies")
          ? { success: true, data: [{ code: "KWD" }, { code: "JPY" }] }
          : [],
    ));
    render(<OpportunityQuickEditModal {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: en.crmLeadDetail.edit }));
    expect(await screen.findByRole("option", { name: "KWD" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "EGP" })).toBeNull();
    const currency = screen.getByRole("combobox", { name: en.crmLeadConvert.currencyCode });
    expect((currency as HTMLSelectElement).value).toBe("");
    fireEvent.change(currency, { target: { value: "KWD" } });
    fireEvent.click(screen.getByRole("button", { name: en.common.save }));
    await waitFor(() => expect(runIdempotentWrite).toHaveBeenCalledWith(expect.objectContaining({
      body: { currencyCode: "KWD" },
    })));
  });

  it("keeps a stored currency even if it is absent from the active list", async () => {
    vi.mocked(axiosClient.get).mockImplementation(async (path) =>
      response(path === opportunityPath(detail.id) ? { ...detail, currencyCode: "KWD" } : []));
    render(<OpportunityQuickEditModal {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: en.crmLeadDetail.edit }));
    expect((screen.getByRole("combobox", { name: en.crmLeadConvert.currencyCode }) as HTMLSelectElement).value).toBe("KWD");
    fireEvent.change(screen.getByDisplayValue(detail.title), { target: { value: "Updated title" } });
    fireEvent.click(screen.getByRole("button", { name: en.common.save }));
    await waitFor(() => expect(runIdempotentWrite).toHaveBeenCalledWith(expect.objectContaining({
      body: { title: "Updated title" },
    })));
  });

  it.each(["KWD", "EGP"])("validates the selected %s currency before saving three decimals", async (currencyCode) => {
    vi.mocked(axiosClient.get).mockImplementation(async (path) =>
      response(path === opportunityPath(detail.id) ? { ...detail, amount: "1.230", currencyCode } : []));
    render(<OpportunityQuickEditModal {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: en.crmLeadDetail.edit }));
    fireEvent.change(screen.getByDisplayValue("1.230"), { target: { value: "1.234" } });
    fireEvent.click(screen.getByRole("button", { name: en.common.save }));
    if (currencyCode === "KWD") {
      await waitFor(() => expect(runIdempotentWrite).toHaveBeenCalledWith(expect.objectContaining({ body: { amount: 1.234 } })));
    } else {
      expect((await screen.findByRole("alert")).textContent).toBe(en.crmShared.refusals.CRM_AMOUNT_SCALE_INVALID);
      expect(runIdempotentWrite).not.toHaveBeenCalled();
    }
  });

  it("sends an empty description only when the user explicitly clears it", async () => {
    render(<OpportunityQuickEditModal {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: en.crmLeadDetail.edit }));
    fireEvent.change(screen.getByDisplayValue("Preserve this server description"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: en.common.save }));
    await waitFor(() => expect(runIdempotentWrite).toHaveBeenCalledWith(expect.objectContaining({
      body: { description: "" },
    })));
  });

  it("does not edit the prior record while the next detail loads", async () => {
    const view = render(<OpportunityQuickEditModal {...props} />);
    await screen.findByRole("button", { name: en.crmLeadDetail.edit });
    vi.mocked(axiosClient.get).mockReturnValue(new Promise(() => {}));
    await act(async () => view.rerender(<OpportunityQuickEditModal {...props}
      item={{ ...row, id: "01900100-0000-7000-8000-000000000002" }} />));
    expect(screen.queryByRole("button", { name: en.crmLeadDetail.edit })).toBeNull();
    expect(screen.getByRole("status")).toBeTruthy();
  });
});

it("hides write actions and activity creation in read-only mode", async () => {
  auth.canMutate = false;
  auth.permissions = ["crm.tags.manage", "activities.create"];
  render(<OpportunityQuickEditModal {...props} canDelete={() => true} />);
  await screen.findAllByText(detail.title);
  expect(screen.queryByRole("button", { name: en.crmLeadDetail.edit })).toBeNull();
  expect(screen.queryByRole("button", { name: en.activities.title })).toBeNull();
  expect(screen.queryByRole("button", { name: `+ ${en.crmTags.add}` })).toBeNull();
  expect(runIdempotentWrite).not.toHaveBeenCalled();
});

it.each(["Egypt", "EG"])("uses the customer's country %s for shared WhatsApp actions", (country) => {
  const { container } = render(<OpportunityPhoneActions phone="01012345678" country={country} />);
  expect(container.querySelector('a[href="https://wa.me/201012345678"]')).toBeTruthy();
  expect(container.querySelector('a[href="https://t.me/+201012345678"]')).toBeTruthy();
});
