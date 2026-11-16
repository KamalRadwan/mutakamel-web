// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { widgetPath, type WidgetUsage } from "../../dashboards/widget-contract";
import { WidgetUsagePanel } from "./WidgetUsagePanel";

const mocks = vi.hoisted(() => ({ get: vi.fn(), startRead: () => ({}), currentRead: () => true }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("@/lib/api/axiosClient", () => ({ axiosClient: { get: mocks.get } }));
vi.mock("../hooks/useWidgetSafety", () => ({ useWidgetSafety: () => ({ scope: "actor", busy: false,
  startRead: mocks.startRead, currentRead: mocks.currentRead }) }));

const id = (number: number) => `018f0000-0000-7000-8000-${String(number).padStart(12, "0")}`;
const widgetId = id(300);
const placement = (number: number) => ({ placementId: id(number), dashboardId: id(number + 500),
  dashboardName: `Board ${number}`, dashboardRevision: 1, x: 0, y: 0, width: 4, height: 3 });
const placements = Array.from({ length: 20 }, (_, index) => placement(100 - index));
const firstPage: WidgetUsage = { placementCount: 22, dashboardCount: 22, hiddenPlacementCount: 1,
  activeShareCount: 2, placements, nextCursor: placements.at(-1)!.placementId };
const owner = { id: widgetId, ownerUserId: id(1), ownerName: null, name: "Conversion report", accessLevel: "OWNER",
  isShared: false, status: "PUBLISHED", revision: 1, governanceRevision: 1, versionNumber: 1, hasDraft: false, draftRevision: null,
  visualizationType: "METRIC_CARD", querySpec: { series: [{ metricKey: "crm.leads.created.count" }], dimension: { key: "none" } },
  displaySpec: {}, schemaVersion: 1, createdAt: "2026-11-10T09:00:00Z", updatedAt: "2026-11-10T09:00:00Z" };

afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe("widget placement usage", () => {
  it("renders admitted dashboard links and replaces the visible page after a cursor read", async () => {
    mocks.get.mockResolvedValueOnce({ status: 200, data: { ...owner, usage: { ...firstPage, placements: [placement(80)], nextCursor: null } } });
    render(<WidgetUsagePanel widgetId={widgetId} widgetName={owner.name} initialUsage={firstPage} />);
    expect(mocks.get).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Board 100" })).toHaveAttribute("href", `/crm/dashboards/${id(600)}`);
    fireEvent.click(screen.getByRole("button", { name: en.common.nextPage }));
    expect(screen.queryByRole("link", { name: "Board 100" })).toBeNull();
    await waitFor(() => expect(screen.getByRole("link", { name: "Board 80" })).toBeVisible());
    expect(mocks.get).toHaveBeenCalledWith(`${widgetPath(widgetId)}?usageCursor=${firstPage.nextCursor}`, expect.objectContaining({ cache: "no-store" }));
    expect(screen.getByRole("button", { name: en.common.nextPage })).toBeDisabled();
    expect(screen.getByRole("button", { name: en.common.previousPage })).toBeEnabled();
  });

  it("refuses owner-only aggregate data in a collaborator response", async () => {
    mocks.get.mockResolvedValueOnce({ status: 200, data: { ...owner, accessLevel: "VIEW", isShared: true, hasDraft: null, usage: firstPage } });
    render(<WidgetUsagePanel widgetId={widgetId} widgetName={owner.name} onClose={vi.fn()} />);
    expect(await screen.findByText(en.crmWidgets.usageLoadFailed)).toBeVisible();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
