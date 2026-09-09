// @vitest-environment jsdom

/**
 * The shared history card.
 *
 * What these prove: the actor is the compact headline rather than the action
 * key; a diff renders as field, old, new; the timestamp is all digits with the
 * day first; and a user without `audit.read` gets no card at all rather than an
 * empty one.
 */

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { api, authMock } = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  authMock: {
    user: { permissions: ["audit.read"], isTenantOwner: false },
    isLoading: false,
  },
}));

vi.mock("@/lib/api/axiosClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/axiosClient")>()),
  axiosClient: api,
}));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => authMock }));

import { I18nProvider } from "@/i18n/I18nContext";
import { en } from "@/i18n/dictionaries/en";
import { EntityHistoryCard } from "./EntityHistoryCard";

vi.mock("@/i18n/I18nContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/i18n/I18nContext")>()),
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));

const ENTITY_ID = "01900100-0000-7000-8000-0000000000a1";

function ledger(items: unknown[]) {
  // Core's envelope: the rows in `data`, the pager in a sibling `meta`.
  return { data: { success: true, data: items, meta: { hasNext: false }, correlationId: "c" } };
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

function renderCard() {
  render(
    <I18nProvider>
      <EntityHistoryCard entityType="Lead" entityId={ENTITY_ID} />
    </I18nProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.user = { permissions: ["audit.read"], isTenantOwner: false };
  api.get.mockResolvedValue(ledger([STAGE_CHANGE]));
});

afterEach(cleanup);

describe("the history card", () => {
  it("requests all related parties once, keeps a stable subject set, and refreshes after a save", async () => {
    const parties = [ENTITY_ID, "01900100-0000-7000-8000-0000000000a2"];
    const { rerender } = render(<EntityHistoryCard entityType="Lead" entityId={ENTITY_ID}
      relatedPartyIds={parties} refreshToken={1} />);
    await screen.findByText(STAGE_CHANGE.actorLabel);
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(String(api.get.mock.calls[0][0])).toContain(`relatedPartyIds=${parties.join("%2C")}`);
    rerender(<EntityHistoryCard entityType="Lead" entityId={ENTITY_ID}
      relatedPartyIds={[...parties].reverse()} refreshToken={1} />);
    await act(async () => {});
    expect(api.get).toHaveBeenCalledTimes(1);
    rerender(<EntityHistoryCard entityType="Lead" entityId={ENTITY_ID}
      relatedPartyIds={parties} refreshToken={2} />);
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  });

  it("labels company/contact changes and shows phone arrays without JSON punctuation", async () => {
    api.get.mockResolvedValue(ledger([{ ...STAGE_CHANGE, diff: [
      { field: "phone", before: ["0100"], after: ["0200"], subjectId: "company", subjectLabel: "Mersany" },
      { field: "phone", before: ["[NOT_RECORDED]"], after: ["0300"], subjectId: "contact", subjectLabel: "Saly Essam" },
    ] }]));
    renderCard();
    expect(await screen.findByText("Mersany")).toBeInTheDocument();
    expect(screen.getByText("Saly Essam")).toBeInTheDocument();
    expect(screen.getByText("0100")).toHaveClass("line-through");
    expect(screen.getByText(en.audit.valueNotRecorded)).toBeInTheDocument();
    expect(screen.queryByText('["0200"]')).toBeNull();
  });

  it("discards an old load-more response after a successful save refresh", async () => {
    const first = ledger([STAGE_CHANGE]);
    first.data.meta.hasNext = true;
    let resolveOld!: (result: ReturnType<typeof ledger>) => void;
    api.get.mockResolvedValueOnce(first)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }))
      .mockResolvedValueOnce(ledger([{ ...STAGE_CHANGE, actorLabel: "Fresh actor" }]));
    const { rerender } = render(<EntityHistoryCard entityType="Lead" entityId={ENTITY_ID} refreshToken={1} />);
    fireEvent.click(await screen.findByRole("button", { name: en.audit.loadMore }));
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
    rerender(<EntityHistoryCard entityType="Lead" entityId={ENTITY_ID} refreshToken={2} />);
    await screen.findByText("Fresh actor");
    await act(async () => resolveOld(ledger([{ ...STAGE_CHANGE, id: "old-page", actorLabel: "Stale actor" }])));
    expect(screen.queryByText("Stale actor")).toBeNull();
  });

  it("does not leave legacy events blank when their change details were never stored", async () => {
    api.get.mockResolvedValue(ledger([{ ...STAGE_CHANGE, action: "LEAD_UPDATED", diff: [] }]));
    renderCard();
    expect(await screen.findByText(en.audit.detailsNotRecorded)).toBeInTheDocument();
  });

  it("keeps the History title without the introductory description", async () => {
    renderCard();
    expect(screen.getByRole("heading", { name: en.audit.historyTitle })).toBeInTheDocument();
    expect(screen.queryByText("Everything recorded against this record, newest first.")).toBeNull();
    await screen.findByText(STAGE_CHANGE.actorLabel);
    expect(screen.queryByText("Everything recorded against this record, newest first.")).toBeNull();
  });

  it("uses the actor as the only headline instead of the action", async () => {
    renderCard();
    expect(await screen.findAllByText(STAGE_CHANGE.actorLabel)).toHaveLength(1);
    expect(screen.queryByText(en.audit.actions.LEAD_STAGE_CHANGED)).toBeNull();
    expect(screen.queryByText("LEAD_STAGE_CHANGED")).toBeNull();
  });

  it("uses the unknown-actor fallback when the ledger has no person", async () => {
    api.get.mockResolvedValue(ledger([{ ...STAGE_CHANGE, actorLabel: null, actorType: null }]));
    renderCard();
    expect(await screen.findByText(en.audit.actorUnknown)).toBeInTheDocument();
  });

  it("shows what moved, old beside new", async () => {
    renderCard();
    await screen.findByText(STAGE_CHANGE.actorLabel);
    const timeline = screen.getByRole("list");
    // One compact row: field: old > new, without another heading or card.
    const field = within(timeline).getByText(`${en.audit.fields.stageId}:`);
    expect(field.parentElement).toHaveTextContent(`${en.audit.fields.stageId}:New>Qualifying`);
    expect(field.parentElement).not.toHaveClass("rounded-md", "border", "p-2");
    expect(within(timeline).getByText("New")).toHaveClass(
      "line-through",
      "text-danger-600",
      "dark:text-danger-300",
    );
    expect(within(timeline).queryByText("Changes")).toBeNull();
    expect(within(timeline).queryByText("Old value:")).toBeNull();
    expect(within(timeline).queryByText("New value:")).toBeNull();
    expect(within(timeline).getByText("Qualifying")).toBeInTheDocument();
    // A value that was not set reads as the empty marker, not as "null".
    expect(within(timeline).getAllByText(en.audit.valueEmpty).length).toBeGreaterThan(0);
    expect(within(timeline).queryByText("null")).toBeNull();
  });

  it("removes the correlation reference from the visible history", async () => {
    renderCard();
    await screen.findByText(STAGE_CHANGE.actorLabel);
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
    await screen.findByText(STAGE_CHANGE.actorLabel);
    expect(screen.getByText(en.statusValues["LeadStageFlag.NEW"])).toBeInTheDocument();
    expect(screen.getByText(en.statusValues["LeadStageFlag.CONTACTED"])).toBeInTheDocument();
  });

  it("stamps every row with all digits, day first", async () => {
    renderCard();
    expect(await screen.findByText("06/09/2026 08:01 AM")).toBeInTheDocument();
  });

  it("keeps the actor beside the timestamp in the compact header row", async () => {
    renderCard();
    const actor = await screen.findByText(STAGE_CHANGE.actorLabel);
    const timestamp = screen.getByText("06/09/2026 08:01 AM");
    expect(actor.parentElement).toBe(timestamp.parentElement);
  });

  it("renders nothing at all without audit.read", async () => {
    authMock.user = { permissions: [], isTenantOwner: false };
    const { container } = render(
      <I18nProvider>
        <EntityHistoryCard entityType="Lead" entityId={ENTITY_ID} />
      </I18nProvider>,
    );
    // Not an empty card: a log somebody may not read is a different fact from
    // a log with no entries, and the ledger is never asked.
    expect(container).toBeEmptyDOMElement();
    await waitFor(() => expect(api.get).not.toHaveBeenCalled());
  });
});
