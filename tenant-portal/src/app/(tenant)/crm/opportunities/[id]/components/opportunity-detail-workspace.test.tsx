// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import type { OpportunityDetail } from "../../opportunity-contract";
import { useOpportunityDetail } from "../hooks/useOpportunityDetail";
import { OpportunityDetailWorkspace } from "./opportunity-detail-workspace";

const mocks = vi.hoisted(() => ({
  patch: vi.fn(), post: vi.fn(), delete: vi.fn(), reload: vi.fn(), setItem: vi.fn(),
  key: vi.fn(() => "01900100-0000-7000-8000-000000000099"),
  describeError: vi.fn(() => "Localized write error"),
}));
vi.mock("@/lib/api/axiosClient", async (original) => ({
  ...(await original<typeof import("@/lib/api/axiosClient")>()),
  axiosClient: { patch: mocks.patch, post: mocks.post, delete: mocks.delete },
}));
vi.mock("@/lib/uuid", async (original) => ({
  ...(await original<typeof import("@/lib/uuid")>()), generateUUIDv7: mocks.key,
}));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: { permissions: [] } }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("@/hooks/useAccessMode", () => ({ useAccessMode: () => ({ canMutate: true }) }));
vi.mock("@/hooks/useUserProfiles", () => ({ useUserProfiles: () => ({ profiles: new Map() }) }));
vi.mock("../../hooks/useCreateOpportunity", () => ({ useOpportunityCurrencyOptions: () => ["KWD", "JPY"] }));
vi.mock("../hooks/useOpportunityDetail", () => ({ useOpportunityDetail: vi.fn() }));
vi.mock("../hooks/useOpportunityEdit", () => ({ useOpportunityEdit: () => ({}) }));
vi.mock("../hooks/usePipelineTransfer", () => ({ usePipelineTransfer: () => ({}) }));
vi.mock("../hooks/useOpportunityStageMove", () => ({ useOpportunityStageMove: () => ({}) }));
vi.mock("../../hooks/useOpportunityCapabilities", () => ({
  useOpportunityCapabilities: () => ({ capabilities: { update: { scope: "all", ownerUserIds: null }, delete: { scope: "all", ownerUserIds: null } } }),
}));
vi.mock("../../hooks/usePipelineWorkspace", () => ({
  opportunityCapabilityAllowsOwner: (capability: unknown) => capability !== null,
}));
vi.mock("../../../shared/hooks/useCrmRecordCapabilities", () => ({
  useCrmRecordCapabilities: () => ({ capabilities: {} }),
}));
vi.mock("../../../shared/hooks/useCrmErrorText", () => ({ useCrmErrorText: () => mocks.describeError }));
vi.mock("../../../leads/hooks/useCreateLeadTags", () => ({
  useCreateLeadTags: () => ({ items: [{ id: "01900100-0000-7000-8000-000000000007", name: "Renewal" }], canManage: false }),
}));
vi.mock("@/design-system", async () => ({
  ...(await import("@/design-system/primitives/Button")),
  ...(await import("@/design-system/primitives/Input")),
  ...(await import("@/design-system/primitives/Textarea")),
  ...(await import("@/design-system/patterns/ambiguous-outcome/AmbiguousOutcomePanel")),
  ...(await import("@/design-system/patterns/dossier-modal/dossier-modal-tokens")),
  ...(await import("@/design-system/views/card-color")),
  ...(await import("@/design-system/lib/cn")),
  toTagColor: () => null,
  ...(await import("@/design-system/patterns/confirm-action/ConfirmActionModal")),
  CopyButton: () => null, DateTime: () => null,
  DegradedBanner: () => null, DetailHeader: () => null, ErrorState: () => null,
  Money: () => null, NotFoundState: () => null, PageActions: () => null,
  RatingStars: () => null, Skeleton: () => null, StageBar: () => null, StatusBadge: () => null,
}));
vi.mock("../../../shared/components/CrmScopeGate", () => ({ CrmScopeGate: () => null }));
vi.mock("../../../shared/components/CustomFieldsCard", () => ({ CustomFieldsCard: () => null }));
vi.mock("../../../shared/components/RecordAttachmentsSection", () => ({ RecordAttachmentsSection: () => null }));
vi.mock("../../../shared/components/RecordNotesSection", () => ({ RecordNotesSection: () => null }));
vi.mock("@/components/activities/RecordActivitiesPanel", () => ({ RecordActivitiesPanel: () => null }));
vi.mock("@/components/audit/EntityHistoryCard", () => ({ EntityHistoryCard: () => null }));
vi.mock("@/components/people/UserProfileLink", () => ({ UserProfileLink: () => null }));
vi.mock("../../../leads/components/create-lead/CreateTagModal", () => ({ CreateTagModal: () => null }));
vi.mock("../../components/TerminalMoveDialog", () => ({ TerminalMoveDialog: () => null }));
vi.mock("./OpportunityEditDrawer", () => ({ OpportunityEditDrawer: () => null }));
vi.mock("./OpportunityRelatedNav", () => ({ OpportunityRelatedNav: () => null }));
vi.mock("./PipelineTransferDialog", () => ({ PipelineTransferDialog: () => null }));

const item: OpportunityDetail = {
  id: "01900100-0000-7000-8000-000000000001",
  branchId: "01900100-0000-7000-8000-000000000002",
  customerProfileId: "01900100-0000-7000-8000-000000000003",
  pipelineId: "01900100-0000-7000-8000-000000000004",
  stageId: "01900100-0000-7000-8000-000000000005",
  customerPartyId: null, contactPartyId: null, leadId: null,
  stageFlag: "NEW", status: "IN_PROGRESS", title: "Renew contract", importance: 0,
  amount: null, currencyCode: null, description: null,
  expectedCloseDate: null, probabilityPercent: null, ownerUserId: null,
  wonAt: null, lostAt: null, lostReason: null,
  createdAt: "2026-10-17T00:00:00.000Z", updatedAt: "2026-10-17T00:00:00.000Z",
  cardColor: null, customerProfileType: null, customerDisplayName: null,
  customerCompanyName: null, customerPhone: null, customerEmail: null,
  customerCountry: null, customerCity: null, primaryContact: null,
  leadSourceName: null, leadSourceIconUrl: null, ownerDisplayName: null,
  ownerAvatarUrl: null, openActivityCount: 0, nextOpenActivityAt: null,
  activityState: "NO_OPEN", tags: [],
};
const path = `/api/tenant/crm/v1/opportunities/${item.id}`;
const tag = { id: "01900100-0000-7000-8000-000000000007", name: "Renewal", backgroundColor: null, textColor: null };
const response = (data: unknown, status = 200) => ({ data, status, statusText: "OK", headers: new Headers() });

function setDetail(value = item) {
  vi.mocked(useOpportunityDetail).mockReturnValue({
    item: value, pipelines: [], degraded: { pipelines: false }, isLoading: false,
    error: null, isNotFound: false, isForbidden: false,
    reload: mocks.reload, setItem: mocks.setItem,
  });
}
function openCommercials() {
  const card = screen.getByText(en.crmOpportunityDetail.factsTitle).closest(".dossier-card") as HTMLElement;
  fireEvent.click(within(card).getByRole("button", { name: en.crmLeadDetail.edit }));
  return within(card);
}
function editTitle() {
  const card = openCommercials();
  fireEvent.change(screen.getByDisplayValue(item.title), { target: { value: "Updated title" } });
  fireEvent.click(card.getByRole("button", { name: en.common.save }));
  return card;
}
function refuse(status: number) {
  return new TenantApiClientError("Refused", { status, statusText: "Refused", headers: new Headers(), data: {} });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.patch.mockReset().mockResolvedValue(response(item));
  mocks.post.mockReset().mockResolvedValue(response([tag], 201));
  mocks.delete.mockReset().mockResolvedValue(response(undefined, 204));
  setDetail();
});
afterEach(cleanup);

describe("Opportunity detail writes", () => {
  it("clears the selected importance star to zero and reconciles the detail", async () => {
    setDetail({ ...item, importance: 2 });
    render(<OpportunityDetailWorkspace opportunityId={item.id} />);
    const stars = within(screen.getByRole("group", { name: en.crmOpportunities.importance }));
    fireEvent.click(stars.getByRole("button", { pressed: true }));
    await waitFor(() => expect(mocks.reload).toHaveBeenCalledOnce());
    expect(mocks.patch).toHaveBeenCalledWith(path, { importance: 0 }, expect.anything());
    expect(mocks.setItem).not.toHaveBeenCalled();
  });

  it("reports a refused importance change and leaves the recorded stars intact", async () => {
    setDetail({ ...item, importance: 2 });
    mocks.patch.mockRejectedValueOnce(refuse(403));
    render(<OpportunityDetailWorkspace opportunityId={item.id} />);
    const stars = within(screen.getByRole("group", { name: en.crmOpportunities.importance }));
    fireEvent.click(stars.getByRole("button", { pressed: true }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Localized write error");
    expect(stars.getByRole("button", { pressed: true })).toBeEnabled();
    expect(stars.getByText("2/3")).toBeInTheDocument();
    expect(mocks.reload).not.toHaveBeenCalled();
  });

  it.each([403, 409])("exposes a localized delete refusal (%s) outside the closed confirmation", async (status) => {
    mocks.delete.mockRejectedValueOnce(refuse(status));
    render(<OpportunityDetailWorkspace opportunityId={item.id} />);
    fireEvent.click(screen.getByRole("button", { name: en.common.delete }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: en.common.delete }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Localized write error");
    expect(mocks.describeError).toHaveBeenCalledWith(expect.objectContaining({ status }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(mocks.reload).not.toHaveBeenCalled();
  });

  it("shows an uncertain delete outcome with its original idempotency key", async () => {
    mocks.delete.mockRejectedValueOnce(refuse(503));
    render(<OpportunityDetailWorkspace opportunityId={item.id} />);
    fireEvent.click(screen.getByRole("button", { name: en.common.delete }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: en.common.delete }));
    await screen.findByText(en.crmShared.ambiguousTitle);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(mocks.key).toHaveBeenCalledOnce();
    expect(mocks.delete).toHaveBeenCalledWith(path, expect.objectContaining({
      headers: { "x-idempotency-key": "01900100-0000-7000-8000-000000000099" },
    }));
    expect(mocks.reload).not.toHaveBeenCalled();
  });

  it.each([null, "EGP"])("sends only title with an absent amount and currency %s", async (currencyCode) => {
    setDetail({ ...item, currencyCode });
    render(<OpportunityDetailWorkspace opportunityId={item.id} />);
    editTitle();
    await waitFor(() => expect(mocks.reload).toHaveBeenCalledOnce());
    expect(mocks.patch).toHaveBeenCalledWith(path, { title: "Updated title" }, expect.anything());
    expect(mocks.setItem).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: en.common.save })).not.toBeInTheDocument();
  });

  it("keeps a captured baseline when detail refreshes during an edit", async () => {
    const view = render(<OpportunityDetailWorkspace opportunityId={item.id} />);
    const card = openCommercials();
    setDetail({ ...item, amount: "999.00", currencyCode: "SAR", description: "Concurrent edit" });
    view.rerender(<OpportunityDetailWorkspace opportunityId={item.id} />);
    fireEvent.change(screen.getByDisplayValue(item.title), { target: { value: "Updated title" } });
    fireEvent.click(card.getByRole("button", { name: en.common.save }));
    await waitFor(() => expect(mocks.reload).toHaveBeenCalledOnce());
    expect(mocks.patch).toHaveBeenCalledWith(path, { title: "Updated title" }, expect.anything());
  });

  it("does not write an untouched form", () => {
    render(<OpportunityDetailWorkspace opportunityId={item.id} />);
    fireEvent.click(openCommercials().getByRole("button", { name: en.common.save }));
    expect(mocks.patch).not.toHaveBeenCalled();
  });

  it("clears the amount while preserving the currency", async () => {
    setDetail({ ...item, amount: "125.00", currencyCode: "KWD" });
    render(<OpportunityDetailWorkspace opportunityId={item.id} />);
    const card = openCommercials();
    fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "" } });
    fireEvent.click(card.getByRole("button", { name: en.common.save }));
    await waitFor(() => expect(mocks.reload).toHaveBeenCalledOnce());
    expect(mocks.patch).toHaveBeenCalledWith(path, { amount: null }, expect.anything());
  });

  it.each(["125.00", "0.00"])("blocks currency clearing while amount %s remains", async (amount) => {
    setDetail({ ...item, amount, currencyCode: "KWD" });
    render(<OpportunityDetailWorkspace opportunityId={item.id} />);
    const card = openCommercials();
    fireEvent.change(screen.getByRole("textbox", { name: en.crmLeadConvert.currencyCode }), { target: { value: "" } });
    fireEvent.click(card.getByRole("button", { name: en.common.save }));
    await card.findByRole("alert");
    expect(mocks.describeError).toHaveBeenCalledWith(expect.objectContaining({
      code: "OPPORTUNITY_AMOUNT_CURRENCY_REQUIRED",
    }));
    expect(mocks.patch).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText("0.00")).toHaveValue(amount);
  });

  it("clears amount and currency in the same request", async () => {
    setDetail({ ...item, amount: "125.00", currencyCode: "KWD" });
    render(<OpportunityDetailWorkspace opportunityId={item.id} />);
    const card = openCommercials();
    fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "" } });
    fireEvent.change(screen.getByRole("textbox", { name: en.crmLeadConvert.currencyCode }), { target: { value: "" } });
    fireEvent.click(card.getByRole("button", { name: en.common.save }));
    await waitFor(() => expect(mocks.reload).toHaveBeenCalledOnce());
    expect(mocks.patch).toHaveBeenCalledWith(path, { amount: null, currencyCode: null }, expect.anything());
  });

  it("rejects an invalid amount locally and preserves the draft", async () => {
    render(<OpportunityDetailWorkspace opportunityId={item.id} />);
    const card = openCommercials();
    fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "1.001" } });
    fireEvent.click(card.getByRole("button", { name: en.common.save }));
    expect(await card.findByRole("alert")).toHaveTextContent("Localized write error");
    expect(mocks.patch).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText("0.00")).toHaveValue("1.001");
  });

  it.each([400, 403, 422])("shows a localized %s refusal without closing the form", async (status) => {
    mocks.patch.mockRejectedValueOnce(refuse(status));
    render(<OpportunityDetailWorkspace opportunityId={item.id} />);
    const card = editTitle();
    expect(await card.findByRole("alert")).toHaveTextContent("Localized write error");
    expect(mocks.describeError).toHaveBeenCalledWith(expect.objectContaining({ status }));
    expect(screen.getByDisplayValue("Updated title")).toBeInTheDocument();
    expect(card.getByRole("button", { name: en.common.save })).toBeEnabled();
    expect(mocks.reload).not.toHaveBeenCalled();
  });

  it("keeps a 5xx draft and replays its original payload and key", async () => {
    mocks.patch.mockRejectedValueOnce(refuse(503));
    render(<OpportunityDetailWorkspace opportunityId={item.id} />);
    const card = editTitle();
    await screen.findByText(en.crmShared.ambiguousTitle);
    expect(card.getByRole("button", { name: en.common.save })).toBeDisabled();
    expect(mocks.reload).not.toHaveBeenCalled();
    fireEvent.change(screen.getByDisplayValue("Updated title"), { target: { value: "Later draft" } });
    fireEvent.click(screen.getByRole("button", { name: en.common.retry }));
    await waitFor(() => expect(mocks.reload).toHaveBeenCalledOnce());
    expect(mocks.patch).toHaveBeenCalledTimes(2);
    expect(mocks.patch.mock.calls[1]).toEqual(mocks.patch.mock.calls[0]);
    expect(mocks.key).toHaveBeenCalledOnce();
  });

  it("reconciles an applied write with an unreadable receipt and offers refresh", async () => {
    mocks.patch.mockResolvedValueOnce(response({}));
    render(<OpportunityDetailWorkspace opportunityId={item.id} />);
    editTitle();
    await screen.findByText(en.crmShared.appliedUnreadableTitle);
    expect(mocks.reload).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: en.common.save })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: en.crmShared.appliedUnreadableRefresh }));
    expect(mocks.reload).toHaveBeenCalledTimes(2);
    expect(mocks.patch).toHaveBeenCalledOnce();
  });

  it("patches colour through the normal route and retains it after reload", async () => {
    const view = render(<OpportunityDetailWorkspace opportunityId={item.id} />);
    const colours = within(screen.getByRole("group", { name: en.crmLeads.card.cardColor }));
    fireEvent.click(colours.getByRole("button", { name: en.crmLeads.card.colors.BLUE }));
    await waitFor(() => expect(mocks.reload).toHaveBeenCalledOnce());
    expect(mocks.patch).toHaveBeenCalledWith(path, { cardColor: "BLUE" }, expect.anything());
    setDetail({ ...item, cardColor: "BLUE" });
    view.rerender(<OpportunityDetailWorkspace opportunityId={item.id} />);
    expect(colours.getByRole("button", { name: en.crmLeads.card.colors.BLUE })).toHaveClass("active");
    fireEvent.click(colours.getByRole("button", { name: en.crmLeads.card.colorNone }));
    await waitFor(() => expect(mocks.patch).toHaveBeenCalledWith(path, { cardColor: null }, expect.anything()));
  });

  it("attaches tagIds through the write handler, reloads, and can detach", async () => {
    const view = render(<OpportunityDetailWorkspace opportunityId={item.id} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Tag" }));
    fireEvent.click(screen.getByRole("button", { name: tag.name }));
    await waitFor(() => expect(mocks.reload).toHaveBeenCalledOnce());
    expect(mocks.post).toHaveBeenCalledWith(`${path}/tags`, { tagIds: [tag.id] }, expect.objectContaining({
      headers: { "x-idempotency-key": "01900100-0000-7000-8000-000000000099" },
    }));
    setDetail({ ...item, tags: [tag] });
    view.rerender(<OpportunityDetailWorkspace opportunityId={item.id} />);
    fireEvent.click(screen.getByRole("button", { name: `Remove ${tag.name}` }));
    await waitFor(() => expect(mocks.delete).toHaveBeenCalledWith(`${path}/tags/${tag.id}`, expect.anything()));
    await waitFor(() => expect(mocks.reload).toHaveBeenCalledTimes(2));
  });

  it.each(["colour", "tag"])("reports a refused %s write without claiming a change", async (control) => {
    mocks.patch.mockRejectedValueOnce(refuse(403));
    mocks.post.mockRejectedValueOnce(refuse(403));
    render(<OpportunityDetailWorkspace opportunityId={item.id} />);
    if (control === "colour") {
      fireEvent.click(screen.getByRole("button", { name: en.crmLeads.card.colors.BLUE }));
    } else {
      fireEvent.click(screen.getByRole("button", { name: "+ Tag" }));
      fireEvent.click(screen.getByRole("button", { name: tag.name }));
    }
    expect(await screen.findByRole("alert")).toHaveTextContent("Localized write error");
    expect(mocks.reload).not.toHaveBeenCalled();
  });
});
