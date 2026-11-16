// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import type { MovementReferences } from "../hooks/useMovementWorkspace";
import type { SessionMovementEntry } from "../movements-contract";
import { MovementLinesReview } from "./MovementLinesReview";

let language: "ar" | "en" = "en";
const dictionaries = { ar, en };
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: dictionaries[language], lang: language, dir: language === "ar" ? "rtl" : "ltr" }) }));
const id = "019f2200-0000-7000-8000-000000000001";
const baseId = "019f2200-0000-7000-8000-000000000002";
const target: SessionMovementEntry = { id, nodeId: id, kind: "delivery", status: "DRAFT", version: 1, recordedAt: "2026-11-03T08:00:00Z", summary: "1 line",
  lines: [{ id, quantity: "2.00000000", uomId: id, normalizedUomId: baseId, normalizedQuantity: "24.00000000",
    serialKeys: ["SN-001", "SN-002"], lotKey: "LOT-01", expiryDate: "2027-01-01", reservationId: id,
    descriptionSnapshot: "Printer cartridges", reversedQuantity: "0.00000000", normalizedReversedQuantity: "0.00000000" }] };
const ensureUom = vi.fn().mockResolvedValue(undefined);
const references = { ensureUom, uomLabel: (value: string) => value === id ? "Carton" : "Piece", uomError: null } as unknown as MovementReferences;
afterEach(() => { cleanup(); language = "en"; vi.clearAllMocks(); });

describe.each(["ar", "en"] as const)("movement confirmation lines (%s)", locale => {
  it("reviews actual returned quantities, named units and tracking without exposing internal references", () => {
    language = locale;
    render(<MovementLinesReview target={target} references={references} />);
    const inv = dictionaries[locale].tradeInventory;
    expect(screen.getByText("Printer cartridges")).toBeInTheDocument();
    expect(screen.getByText(inv.movementBaseQuantity)).toBeInTheDocument();
    expect(screen.getAllByText("Carton").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Piece").length).toBeGreaterThan(0);
    expect(screen.getByText("LOT-01")).toBeInTheDocument();
    expect(screen.queryByText("2027-01-01")).not.toBeInTheDocument();
    expect(screen.getByText({ en: /^Jan 1, 2027$/u, ar: /^01.*\/01.*\/2027$/u }[locale])).toBeInTheDocument();
    expect(screen.getByText(inv.movementLinkedReservation)).toBeInTheDocument();
    expect(screen.queryByText(id)).not.toBeInTheDocument();
    expect(screen.queryByText("SN-001")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: new RegExp(inv.serialKeysLabel) }));
    expect(screen.getByText("SN-001")).toBeVisible();
    expect(ensureUom).toHaveBeenCalledWith(id);
    expect(ensureUom).toHaveBeenCalledWith(baseId);
  });
  it("does not invent normalization or use UUIDs as missing unit labels", () => {
    language = locale;
    render(<MovementLinesReview target={{ ...target, lines: [{ id, quantity: "2", serialKeys: [], uomId: id }] }} />);
    expect(screen.getByText(dictionaries[locale].tradeCommon.notSet)).toBeInTheDocument();
    expect(screen.getByText(dictionaries[locale].common.nameUnavailable)).toBeInTheDocument();
    expect(screen.queryByText(id)).not.toBeInTheDocument();
  });
});
