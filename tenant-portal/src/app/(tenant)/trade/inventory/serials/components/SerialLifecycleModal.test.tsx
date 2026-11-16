// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/design-system";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { SerialLifecycleModal } from "./SerialLifecycleModal";

let language: "ar" | "en" = "en";
const dictionaries = { ar, en };
const id = "019f2200-0000-7000-8000-000000000001";
const reservationId = "019f2200-0000-7000-8000-000000000002";
const ledgerEntryId = "019f2200-0000-7000-8000-000000000003";
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: { permissions: ["trade.inventory.read"] } }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: dictionaries[language], lang: language, dir: language === "ar" ? "rtl" : "ltr" }) }));
vi.mock("@/components/audit/RecordHistoryTab", () => ({ RecordHistoryTab: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("../[id]/hooks/useInventorySerial", () => ({ useInventorySerial: () => ({
  t: dictionaries[language], lang: language, canRead: true, isScopeResolved: true, isNotFound: false, isLoading: false, queryError: null,
  serial: { id, itemId: id, itemCompanyProfileId: id, serialKey: "SN-001", state: "RESERVED", currentFulfillmentNodeId: null,
    currentUomId: null, currentReservationId: null, lastTransitionAt: "2026-11-03T08:00:00Z", lifecycle: [
      { id, eventType: "RESERVATION", occurredAt: "2026-11-03T08:00:00Z", fromState: "ON_HAND", toState: "RESERVED",
        fulfillmentNodeId: null, uomId: null, sourceType: null, sourceId: null, reservationId, ledgerEntryId },
    ] },
  references: { itemLabel: () => "Laser printer", nodeLabel: () => "Cairo", uomLabel: () => "Piece" }, reload: vi.fn(), isRefreshing: false,
}) }));
afterEach(() => { cleanup(); language = "en"; });
describe.each(["ar", "en"] as const)("serial event references (%s)", locale => {
  it("discloses independent reservation and ledger references even when a source reference is absent", () => {
    language = locale;
    const copy = dictionaries[locale].tradeInventory.readViews;
    render(<TooltipProvider><SerialLifecycleModal id={id} onClose={vi.fn()} onRestoreFocus={vi.fn()} /></TooltipProvider>);
    expect(screen.queryByText(reservationId)).not.toBeInTheDocument();
    expect(screen.queryByText(ledgerEntryId)).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: copy.technicalDetails })[0]);
    expect(screen.getByText(reservationId)).toBeVisible();
    expect(screen.getByText(ledgerEntryId)).toBeVisible();
    expect(screen.getByText(copy.ledgerReference)).toBeVisible();
    expect(screen.getByText(dictionaries[locale].tradeInventory.reservationId)).toBeVisible();
  });
});
