// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { RecordHistoryTab } from "./RecordHistoryTab";
const auth = vi.hoisted(() => ({ user: { permissions: [] as string[] } }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => auth }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en }) }));
vi.mock("@/design-system", async () => await import("@/design-system/primitives/Tabs"));
vi.mock("./EntityHistoryCard", () => ({ EntityHistoryCard: () => <p>Loaded history</p> }));
afterEach(cleanup);
describe("record history tab admission", () => {
  it("hides the trigger and content without an audit grant", () => {
    auth.user.permissions = [];
    render(<RecordHistoryTab entityType="TradeItemEntity" entityId="id"><p>Record content</p></RecordHistoryTab>);
    expect(screen.getByText("Record content")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: en.audit.historyTitle })).toBeNull();
    expect(screen.queryByText("Loaded history")).toBeNull();
  });
  it.each(["audit.read", "audit.read.branch", "audit.read.own"])("shows history with %s", (permission) => {
    auth.user.permissions = [permission];
    render(<RecordHistoryTab entityType="TradeItemEntity" entityId="id"><p>Record content</p></RecordHistoryTab>);
    fireEvent.mouseDown(screen.getByRole("tab", { name: en.audit.historyTitle }), { button: 0, ctrlKey: false });
    expect(screen.getByText("Loaded history")).toBeInTheDocument();
  });
});
