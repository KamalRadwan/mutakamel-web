// @vitest-environment jsdom

/**
 * Connected Reusable History Template (`RecordHistoryTab`):
 * - Standalone mode (`<RecordHistoryTab entityType="..." entityId="..." />`)
 * - Tabbed page wrapper mode (`<RecordHistoryTab ...>{children}</RecordHistoryTab>`)
 */

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { api, authMock } = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  authMock: {
    user: { permissions: ["audit.read"] as string[], isTenantOwner: false },
    isLoading: false,
  },
}));

vi.mock("@/lib/api/axiosClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/axiosClient")>()),
  axiosClient: api,
}));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => authMock }));
vi.mock("@/design-system", async () => ({
  ...(await import("@/design-system/lib/cn")),
  ...(await import("@/design-system/patterns/detail-section/DetailSection")),
  ...(await import("@/design-system/patterns/empty-state/EmptyState")),
  ...(await import("@/design-system/patterns/error-state/ErrorState")),
  ...(await import("@/design-system/patterns/history-tree/history-tree-types")),
  ...(await import("@/design-system/patterns/history-tree/HistoryDiffList")),
  ...(await import("@/design-system/patterns/history-tree/HistoryTree")),
  ...(await import("@/design-system/patterns/history-tree/HistorySection")),
  ...(await import("@/design-system/patterns/permission-gate/PermissionGate")),
  ...(await import("@/design-system/primitives/Avatar")),
  ...(await import("@/design-system/primitives/Badge")),
  ...(await import("@/design-system/primitives/Button")),
  ...(await import("@/design-system/primitives/Collapsible")),
  ...(await import("@/design-system/primitives/IdentifierText")),
  ...(await import("@/design-system/primitives/RatingStars")),
  ...(await import("@/design-system/primitives/Skeleton")),
  ...(await import("@/design-system/primitives/Tabs")),
  ...(await import("@/design-system/primitives/ToggleGroup")),
}));

import { I18nProvider } from "@/i18n/I18nContext";
import { en } from "@/i18n/dictionaries/en";
import { RecordHistoryTab } from "./RecordHistoryTab";

vi.mock("@/i18n/I18nContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/i18n/I18nContext")>()),
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));

const ENTITY_ID = "01900100-0000-7000-8000-0000000000a1";

function ledger(items: unknown[]) {
  return {
    data: {
      success: true,
      data: { items, nextCursor: null as string | null },
      correlationId: "c",
    },
  };
}

const STAGE_CHANGE = {
  id: "01900100-0000-7000-8000-0000000000e1",
  action: "LEAD_STAGE_CHANGED",
  actorLabel: "Kamal Radwan",
  createdAt: "2026-09-06T08:01:00",
  outcome: "SUCCESS",
  correlationId: "reference-that-must-not-render",
  diff: [
    { field: "stageId", before: "New", after: "Qualifying" },
    { field: "ownerUserId", before: null, after: "Saly Essam" },
  ],
};

function renderCard(props: Partial<React.ComponentProps<typeof RecordHistoryTab>> = {}) {
  render(
    <I18nProvider>
      <RecordHistoryTab entityType="Lead" entityId={ENTITY_ID} {...props} />
    </I18nProvider>,
  );
}

async function expandFirstDetails() {
  const triggers = await screen.findAllByRole("button", {
    name: new RegExp(en.audit.detailsOfChanges, "u"),
  });
  fireEvent.click(triggers[0]!);
  return triggers[0]!;
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.user = { permissions: ["audit.read"], isTenantOwner: false };
  api.get.mockResolvedValue(ledger([STAGE_CHANGE]));
});

afterEach(cleanup);

describe("RecordHistoryTab admission & tabbed wrapper mode", () => {
  it("hides the History tab trigger and renders children directly without an audit grant", () => {
    authMock.user = { permissions: [], isTenantOwner: false };
    render(
      <RecordHistoryTab entityType="TradeItemEntity" entityId={ENTITY_ID}>
        <p>Record content</p>
      </RecordHistoryTab>,
    );
    expect(screen.getByText("Record content")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: en.audit.historyTitle })).toBeNull();
    expect(api.get).not.toHaveBeenCalled();
  });

  it.each(["audit.read", "audit.read.branch", "audit.read.own"])(
    "shows Record | History tabs and loads history when activated with %s",
    async (permission) => {
      authMock.user = { permissions: [permission], isTenantOwner: false };
      render(
        <RecordHistoryTab entityType="TradeItemEntity" entityId={ENTITY_ID}>
          <p>Record content</p>
        </RecordHistoryTab>,
      );
      fireEvent.mouseDown(screen.getByRole("tab", { name: en.audit.historyTitle }), {
        button: 0,
        ctrlKey: false,
      });
      expect(await screen.findByText(STAGE_CHANGE.actorLabel)).toBeInTheDocument();
    },
  );
});

describe("RecordHistoryTab connected HistorySection template", () => {
  it("requests all related parties once, keeps a stable subject set, and refreshes after a save", async () => {
    const parties = [ENTITY_ID, "01900100-0000-7000-8000-0000000000a2"];
    const { rerender } = render(
      <RecordHistoryTab
        entityType="Lead"
        entityId={ENTITY_ID}
        relatedPartyIds={parties}
        refreshToken={1}
      />,
    );
    await screen.findByText(STAGE_CHANGE.actorLabel);
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(String(api.get.mock.calls[0]?.[0])).toContain(`relatedPartyIds=${parties.join("%2C")}`);
    rerender(
      <RecordHistoryTab
        entityType="Lead"
        entityId={ENTITY_ID}
        relatedPartyIds={[...parties].reverse()}
        refreshToken={1}
      />,
    );
    await act(async () => {});
    expect(api.get).toHaveBeenCalledTimes(1);
    rerender(
      <RecordHistoryTab
        entityType="Lead"
        entityId={ENTITY_ID}
        relatedPartyIds={parties}
        refreshToken={2}
      />,
    );
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  });

  it("renders the 3-level hierarchy collapsed by default and supports Expand all / Collapse all", async () => {
    const quotationId = "01900100-0000-7000-8000-0000000000b1";
    api.get.mockResolvedValue(
      ledger([
        STAGE_CHANGE,
        {
          id: "01900100-0000-7000-8000-0000000000e2",
          action: "QUOTATION_CREATED",
          subjectKind: "quotation",
          subjectId: quotationId,
          referenceLabel: "QT-2026-0018",
          actorLabel: "Saly Essam",
          createdAt: "2026-09-07T09:30:00",
          outcome: "SUCCESS",
          diff: [{ field: "grandTotal", before: null, after: "5000" }],
        },
      ]),
    );
    renderCard();

    expect(await screen.findByText(STAGE_CHANGE.actorLabel)).toBeInTheDocument();
    expect(screen.getByText(en.audit.actions.LEAD_STAGE_CHANGED)).toBeInTheDocument();
    expect(screen.getByText(en.audit.actions.QUOTATION_CREATED)).toBeInTheDocument();
    expect(screen.queryByText("LEAD_STAGE_CHANGED")).toBeNull();

    const refLink = screen.getByRole("link", { name: "#QT-2026-0018" });
    expect(refLink).toHaveAttribute("href", `/trade/quotations/${quotationId}`);

    const triggers = screen.getAllByRole("button", {
      name: new RegExp(en.audit.detailsOfChanges, "u"),
    });
    expect(triggers).toHaveLength(2);
    expect(triggers[0]).toHaveAttribute("aria-expanded", "false");
    expect(triggers[1]).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Qualifying")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: en.audit.expandAll }));
    expect(triggers[0]).toHaveAttribute("aria-expanded", "true");
    expect(triggers[1]).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Qualifying")).toBeInTheDocument();
    expect(screen.getByText("5000")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: en.audit.collapseAll }));
    expect(triggers[0]).toHaveAttribute("aria-expanded", "false");
    expect(triggers[1]).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Qualifying")).toBeNull();
  });

  it("filters related CRM history by category via ToggleGroup and omits the filter bar on standalone records", async () => {
    renderCard();
    await screen.findByText(STAGE_CHANGE.actorLabel);
    expect(screen.queryByRole("radiogroup", { name: en.audit.filterLabel })).toBeNull();
    cleanup();

    const parties = [ENTITY_ID, "01900100-0000-7000-8000-0000000000a2"];
    renderCard({ relatedPartyIds: parties });
    await screen.findByText(STAGE_CHANGE.actorLabel);
    const filterGroup = screen.getByRole("radiogroup", { name: en.audit.filterLabel });
    fireEvent.click(within(filterGroup).getByRole("radio", { name: en.audit.filters.quotation }));
    await waitFor(() =>
      expect(String(api.get.mock.calls.at(-1)?.[0])).toContain("historyCategory=quotation"),
    );

    fireEvent.click(within(filterGroup).getByRole("radio", { name: en.audit.filters.all }));
    await waitFor(() =>
      expect(String(api.get.mock.calls.at(-1)?.[0])).not.toContain("historyCategory="),
    );
  });

  it("labels company/contact changes and shows phone arrays without JSON punctuation when expanded", async () => {
    api.get.mockResolvedValue(
      ledger([
        {
          ...STAGE_CHANGE,
          diff: [
            { field: "phone", before: ["0100"], after: ["0200"], subjectId: "company", subjectLabel: "Mersany" },
            {
              field: "phone",
              before: ["[NOT_RECORDED]"],
              after: ["0300"],
              subjectId: "contact",
              subjectLabel: "Saly Essam",
            },
          ],
        },
      ]),
    );
    renderCard();
    await expandFirstDetails();
    expect(screen.getByText("Mersany")).toBeInTheDocument();
    expect(screen.getByText("Saly Essam")).toBeInTheDocument();
    expect(screen.getByText("0100")).toHaveClass("line-through");
    expect(screen.getByText(en.audit.valueNotRecorded)).toBeInTheDocument();
    expect(screen.queryByText('["0200"]')).toBeNull();
  });

  it("discards an old load-more response after a successful save refresh", async () => {
    const first = ledger([STAGE_CHANGE]);
    first.data.data.nextCursor = "opaque-cursor";
    let resolveOld!: (result: ReturnType<typeof ledger>) => void;
    api.get
      .mockResolvedValueOnce(first)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOld = resolve;
          }),
      )
      .mockResolvedValueOnce(ledger([{ ...STAGE_CHANGE, actorLabel: "Fresh actor" }]));
    const { rerender } = render(
      <RecordHistoryTab entityType="Lead" entityId={ENTITY_ID} refreshToken={1} />,
    );
    fireEvent.click(await screen.findByRole("button", { name: en.audit.loadMore }));
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
    rerender(<RecordHistoryTab entityType="Lead" entityId={ENTITY_ID} refreshToken={2} />);
    await screen.findByText("Fresh actor");
    await act(async () =>
      resolveOld(ledger([{ ...STAGE_CHANGE, id: "old-page", actorLabel: "Stale actor" }])),
    );
    expect(screen.queryByText("Stale actor")).toBeNull();
  });

  it("does not leave legacy events blank when their change details were never stored", async () => {
    api.get.mockResolvedValue(ledger([{ ...STAGE_CHANGE, action: "LEAD_UPDATED", diff: [] }]));
    renderCard();
    await expandFirstDetails();
    expect(screen.getByText(en.audit.detailsNotRecorded)).toBeInTheDocument();
  });

  it("keeps the History title without redundant introductory description", async () => {
    renderCard();
    expect(screen.getByRole("heading", { name: en.audit.historyTitle })).toBeInTheDocument();
    await screen.findByText(STAGE_CHANGE.actorLabel);
  });

  it("uses the unknown-actor fallback when the ledger has no person", async () => {
    api.get.mockResolvedValue(ledger([{ ...STAGE_CHANGE, actorLabel: null, actorType: null }]));
    renderCard();
    expect(await screen.findByText(en.audit.actorUnknown)).toBeInTheDocument();
  });

  it("shows what moved, old beside new, inside the collapsible details panel", async () => {
    renderCard();
    await expandFirstDetails();
    const timeline = screen.getByRole("list");
    const field = within(timeline).getByText(`${en.audit.fields.stageId}:`);
    expect(field.parentElement).toHaveTextContent(`${en.audit.fields.stageId}:New>Qualifying`);
    expect(within(timeline).getByText("New")).toHaveClass(
      "line-through",
      "text-danger-600",
      "dark:text-danger-300",
    );
    expect(within(timeline).queryByText("Changes")).toBeNull();
    expect(within(timeline).queryByText("Old value:")).toBeNull();
    expect(within(timeline).queryByText("New value:")).toBeNull();
    expect(within(timeline).getByText("Qualifying")).toBeInTheDocument();
    expect(within(timeline).getAllByText(en.audit.valueEmpty).length).toBeGreaterThan(0);
    expect(within(timeline).queryByText("null")).toBeNull();
  });

  it("removes the correlation reference from the visible history", async () => {
    renderCard();
    await expandFirstDetails();
    expect(screen.queryByText(STAGE_CHANGE.correlationId)).toBeNull();
    expect(screen.queryByText(/Reference:/u)).toBeNull();
  });

  it("shows the old and new stage from legacy metadata when diff is absent", async () => {
    api.get.mockResolvedValue(
      ledger([
        {
          ...STAGE_CHANGE,
          diff: null,
          metadata: {
            fromStageFlag: "NEW",
            toStageFlag: "CONTACTED",
            fromStatus: "OPEN",
            toStatus: "OPEN",
          },
        },
      ]),
    );
    renderCard();
    await expandFirstDetails();
    expect(screen.getByText(en.statusValues["LeadStageFlag.NEW"])).toBeInTheDocument();
    expect(screen.getByText(en.statusValues["LeadStageFlag.CONTACTED"])).toBeInTheDocument();
  });

  it("stamps every row with all digits, day first, keeping actor beside timestamp", async () => {
    renderCard();
    const actor = await screen.findByText(STAGE_CHANGE.actorLabel);
    const timestamp = screen.getByText("06/09/2026 08:01 AM");
    expect(actor.parentElement).toBe(timestamp.parentElement);
  });

  it("renders nothing at all in standalone mode without any audit read permission", async () => {
    authMock.user = { permissions: [], isTenantOwner: false };
    const { container } = render(
      <I18nProvider>
        <RecordHistoryTab entityType="Lead" entityId={ENTITY_ID} />
      </I18nProvider>,
    );
    expect(container).toBeEmptyDOMElement();
    await waitFor(() => expect(api.get).not.toHaveBeenCalled());
  });
});
