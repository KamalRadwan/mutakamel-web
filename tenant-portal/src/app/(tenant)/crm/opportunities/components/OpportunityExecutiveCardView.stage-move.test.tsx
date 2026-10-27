// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import type { OpportunityListItem } from "../hooks/useOpportunitiesList";
import { OpportunityExecutiveBoardView } from "./OpportunityExecutiveBoardView";
import { OpportunityExecutiveTableView } from "./OpportunityExecutiveTableView";
import type { OpportunityCardRecord, OpportunityStage } from "../hooks/pipeline-types";
import { OpportunityExecutiveCardView, type OpportunityExecutiveCardViewProps } from "./OpportunityExecutiveCardView";

const auth = vi.hoisted(() => ({ permissions: [] as string[], canMutate: true }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: auth }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("./opportunity-card/OpportunityCardMenu", () => ({ OpportunityCardMenu: () => null }));
vi.mock("@/hooks/useAccessMode", () => ({ useAccessMode: () => ({ canMutate: auth.canMutate }) }));
beforeEach(() => { auth.permissions = []; auth.canMutate = true; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const item: OpportunityListItem = {
  id: "0192f3a0-0000-7000-8000-000000000001",
  title: "Enterprise renewal",
  stageId: "0192f3a0-0000-7000-8000-000000000002",
  stageFlag: "PROPOSAL",
  status: "IN_PROGRESS",
  customerPartyId: "0192f3a0-0000-7000-8000-000000000003",
  customerProfileType: "CORPORATE",
  customerDisplayName: "Acme Trading",
  customerCompanyName: "Acme Trading LLC",
  customerPhone: "+201000000000",
  customerEmail: "sales@acme.example",
  customerCountry: "Egypt",
  customerCity: "Cairo",
  primaryContact: {
    partyId: "0192f3a0-0000-7000-8000-000000000004",
    displayName: "Nora Saleh",
    jobTitle: "Procurement Director",
    isPrimary: true,
    email: "nora@acme.example",
    phones: ["+201111111111"],
  },
  leadSourceName: "Website",
  leadSourceIconUrl: null,
  ownerUserId: "0192f3a0-0000-7000-8000-000000000005",
  ownerDisplayName: "Kamal Radwan",
  ownerAvatarUrl: null,
  importance: 2,
  cardColor: "TEAL",
  amount: "9007199254740991.25",
  currencyCode: "EGP",
  probabilityPercent: 65,
  expectedCloseDate: "2026-10-31",
  openActivityCount: 1,
  nextOpenActivityAt: "2026-09-18T09:00:00.000Z",
  activityState: "FUTURE",
  tags: [],
  branchId: "branch",
  customerProfileId: "profile",
  pipelineId: "pipeline",
  createdAt: "2026-10-17T00:00:00Z",
};

function props(canUpdate: OpportunityExecutiveCardViewProps["canUpdate"]): OpportunityExecutiveCardViewProps {
  return {
    items: [item], stages: [{ id: "won", pipelineId: "pipeline", opportunityStageId: "master-won", category: "CLOSED", isSystem: true, nameEn: "Won", nameAr: "Won", flag: "WON", rank: 1, isActive: true }],
    branchId: "branch", selectedIds: new Set([item.id]), onSelectionChange: vi.fn(),
    canUpdate, canDelete: () => false, isLoading: false, error: null, onRetry: vi.fn(),
    onOpenOpportunity: vi.fn(),
    onDeleteOpportunity: vi.fn(), onMoveStage: vi.fn(), onCardChange: vi.fn(),
    onBulkMoveStage: vi.fn(async () => undefined),
  };
}

it("disables toolbar stage moves when selected rows cannot be updated", () => {
  const options = props(() => false);
  render(<OpportunityExecutiveCardView {...options} />);
  const select = screen.getByRole("combobox", { name: en.crmOpportunities.bulkMoveStage });
  expect((select as HTMLSelectElement).disabled).toBe(true);
  fireEvent.change(select, { target: { value: "won" } });
  expect(options.onBulkMoveStage).not.toHaveBeenCalled();
});

it("enables toolbar stage moves for an updatable selection", () => {
  const options = props(() => true);
  render(<OpportunityExecutiveCardView {...options} />);
  const select = screen.getByRole("combobox", { name: en.crmOpportunities.bulkMoveStage });
  expect((select as HTMLSelectElement).disabled).toBe(false);
  fireEvent.change(select, { target: { value: "won" } });
  expect(options.onBulkMoveStage).toHaveBeenCalledWith("won");
});


it("hides export without its dedicated permission", () => {
  render(<OpportunityExecutiveCardView {...props(() => true)} />);
  expect(screen.queryByRole("button", { name: en.crmOpportunities.exportSelectedOnPage })).toBeNull();
});

it.each([new Set<string>(), new Set(["another-page"])])("disables export without selected current-page rows: %s", (selectedIds) => {
  auth.permissions = ["crm.opportunities.export"];
  render(<OpportunityExecutiveCardView {...props(() => true)} selectedIds={selectedIds} />);
  expect((screen.getByRole("button", { name: en.crmOpportunities.exportSelectedOnPage }) as HTMLButtonElement).disabled).toBe(true);
});

async function exportText(title: string) {
  auth.permissions = ["crm.opportunities.export"];
  const createObjectURL = vi.fn<(blob: Blob) => string>(() => "blob:export");
  vi.stubGlobal("URL", class extends URL {
    static createObjectURL = createObjectURL;
    static revokeObjectURL = vi.fn();
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  const options = props(() => true);
  const selected = { ...item, title, customerCompanyName: "@customer", amount: "-123.456" };
  render(<OpportunityExecutiveCardView {...options} items={[selected, { ...item, id: "unselected", title: "Excluded row" }]} selectedIds={new Set([item.id, "another-page"])} />);
  fireEvent.click(screen.getByRole("button", { name: en.crmOpportunities.exportSelectedOnPage }));
  expect(createObjectURL).toHaveBeenCalledOnce();
  const blob = createObjectURL.mock.calls[0][0];
  const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
  expect(Array.from(new Uint8Array(bytes).slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
  return new TextDecoder().decode(bytes);
}

it.each(["=1+1", "+1+1", "-1+1", "@SUM(1)", " \t=1+1", "\tcommand", " \tcommand", " \rcommand"])("exports formula-like title %s as text with a UTF-8 BOM", async (title) => {
  const text = await exportText(title);
  expect(text).toContain(`"'${title}"`);
  expect(text).toContain(`"'@customer"`);
  expect(text).toContain(`"'-123.456"`);
  expect(text).not.toContain("Excluded row");
  expect(text).toContain("\r\n");
});

it("preserves Arabic, commas, quotes and newlines in quoted CSV cells", async () => {
  const text = await exportText('\u0641\u0631\u0635\u0629, "\u062a\u062c\u062f\u064a\u062f"\n\u0627\u0644\u0633\u0646\u0629');
  expect(text).toContain('"\u0641\u0631\u0635\u0629, ""\u062a\u062c\u062f\u064a\u062f""\n\u0627\u0644\u0633\u0646\u0629"');
});

it("shows the server page offset and omits misleading toolbar actions", () => {
  render(<OpportunityExecutiveCardView {...props(() => true)} page={{ page: 2, limit: 25, total: 26 }} />);
  expect(screen.getByText("Showing 26\u201326 of 26 opportunities")).toBeTruthy();
  expect(screen.getByText(en.crmOpportunities.detailedCards)).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Assign Salesperson|Importance & Tags/ })).toBeNull();
});

it("allows a closed card's stage selector to request reopening", () => {
  const options = props(() => true);
  render(<OpportunityExecutiveCardView {...options} items={[{ ...item, stageId: "won", status: "WON", stageFlag: "WON" }]} />);
  expect(screen.getByRole("combobox", { name: `Stage for ${item.title}` })).toBeTruthy();
});

it("offers no stage or importance writes in read-only mode", () => {
  auth.canMutate = false;
  render(<OpportunityExecutiveCardView {...props(() => true)} />);
  expect(screen.queryByRole("combobox", { name: `Stage for ${item.title}` })).toBeNull();
  expect(screen.queryByRole("combobox", { name: en.crmOpportunities.bulkMoveStage })).toBeNull();
});

it("allows the table's closed stage popover and uses the shared phone links", () => {
  const options = props(() => true);
  render(<OpportunityExecutiveTableView {...options}
    onOpenQuickModal={vi.fn()} onOpenActivities={vi.fn()}
    items={[{ ...item, stageId: "won", status: "WON", stageFlag: "WON", customerPhone: "01012345678", primaryContact: null }]}
  />);
  const stageButton = screen.getByRole("button", { name: "Won" });
  expect((stageButton as HTMLButtonElement).disabled).toBe(false);
  expect(document.querySelector('a[href="https://wa.me/201012345678"]')).toBeTruthy();
});

it("allows dragging a closed board row and uses country-aware phone actions", () => {
  const stage: OpportunityStage = { id: "won", pipelineId: "pipeline", opportunityStageId: "won-master", nameAr: "Won", nameEn: "Won", flag: "WON", category: "POSITIVE", rank: 1, isActive: true, isSystem: true };
  const boardRow: OpportunityCardRecord = { ...item, importance: 2, stageId: "won", stageFlag: "WON", status: "WON", updatedAt: item.createdAt, primaryContact: null, customerPhone: "01012345678" };
  const pipeline = { id: "pipeline", code: "SALES", nameAr: "Sales", nameEn: "Sales", isDefault: true, isActive: true, stages: [stage] };
  const board = { pipeline, stages: [{ stage, items: [boardRow], summary: { totalCount: 1, amountsByCurrency: {} }, activitySummary: { totalCount: 1, noOpenCount: 1, overdueCount: 0, todayCount: 0, futureCount: 0 }, pageInfo: { limit: 50, hasMore: false, nextCursor: null } }] };
  const { container } = render(<OpportunityExecutiveBoardView pipeline={pipeline} board={board}
    branchId={item.branchId} isLoading={false} isMutating={false} loadingStageId={null}
    canCreate={false} createCapability={null} canUpdate={() => true} canDelete={() => false}
    onOpen={vi.fn()} onDelete={vi.fn()} onOpenActivities={vi.fn()} onCardChange={vi.fn()}
    onMoveCard={vi.fn()} onLoadMoreStage={vi.fn()} onRefreshBoard={vi.fn()}
  />);
  expect(container.querySelector('[draggable="true"]')).toBeTruthy();
  expect(container.querySelector('a[href="https://wa.me/201012345678"]')).toBeTruthy();
});
