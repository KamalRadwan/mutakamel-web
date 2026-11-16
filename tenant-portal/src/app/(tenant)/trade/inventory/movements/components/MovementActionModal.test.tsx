// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/design-system";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import type { useInventoryMovements } from "../hooks/useInventoryMovements";
import type { SessionMovementEntry } from "../movements-contract";
import { MovementActionModal } from "./MovementActionModal";

let language: "ar" | "en" = "en";
const dictionaries = { ar, en };
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: dictionaries[language], lang: language, dir: language === "ar" ? "rtl" : "ltr" }) }));
const id = "019f2200-0000-7000-8000-000000000001";
const target: SessionMovementEntry = { id, nodeId: id, kind: "reservation", status: "ACTIVE", version: 4,
  recordedAt: "2026-11-03T08:00:00Z", businessEffectiveAt: "2026-11-03T08:00:00Z", summary: "2 serials",
  serialKeys: ["SN-001", "SN-002"], reservation: { id, fulfillmentNodeId: id, status: "ACTIVE", version: 4,
    quantity: "2", consumedQuantity: "0", releasedQuantity: "0", remainingQuantity: "2" },
  lines: [{ id, quantity: "2", serialKeys: ["SN-001", "SN-002"], reversedQuantity: "0" }],
  display: { nodeLabel: "Cairo", sourceLabel: "SO-418", lineLabels: ["Printer line"] } };
const release = vi.fn().mockResolvedValue(false);
const reverse = vi.fn().mockResolvedValue(false);
const controller = { pending: null, formError: null, hasUnresolvedWrite: false,
  releaseReservation: release, reverseReceipt: reverse, reverseDelivery: reverse } as unknown as ReturnType<typeof useInventoryMovements>;
afterEach(() => { cleanup(); language = "en"; vi.clearAllMocks(); });

describe.each(["ar", "en"] as const)("movement action validation (%s)", locale => {
  it("requires an exact partial serial selection and validates quantity/reason beside their fields", () => {
    language = locale;
    const inv = dictionaries[locale].tradeInventory;
    render(<TooltipProvider><MovementActionModal target={target} mode="release" controller={controller} onClose={vi.fn()} /></TooltipProvider>);
    const quantity = screen.getByLabelText(inv.quantity);
    fireEvent.change(quantity, { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText(inv.reasonCode), { target: { value: "!" } });
    fireEvent.click(screen.getByRole("button", { name: inv.releaseTitle }));
    expect(release).not.toHaveBeenCalled();
    expect(quantity).toHaveAttribute("aria-invalid", "true");
    expect(quantity).toHaveFocus();
    expect(screen.getByLabelText(inv.reasonCode)).toHaveAttribute("aria-invalid", "true");
    fireEvent.change(quantity, { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText(inv.reasonCode), { target: { value: "CUSTOMER_CANCELLED" } });
    fireEvent.click(screen.getByRole("button", { name: inv.releaseTitle }));
    expect(screen.getByLabelText(inv.serialKeysLabel)).toHaveAttribute("aria-invalid", "true");
    fireEvent.change(screen.getByLabelText(inv.serialKeysLabel), { target: { value: "SN-002" } });
    fireEvent.click(screen.getByRole("button", { name: inv.releaseTitle }));
    expect(release).toHaveBeenCalledWith(id, 4, "1", "CUSTOMER_CANCELLED", "SN-002");
  });
  it("validates reversal reason, calendar instant and partial line fields before submitting", () => {
    language = locale;
    const inv = dictionaries[locale].tradeInventory;
    render(<TooltipProvider><MovementActionModal target={{ ...target, kind: "receipt", status: "POSTED" }} mode="reverse" controller={controller} onClose={vi.fn()} /></TooltipProvider>);
    fireEvent.click(screen.getByRole("button", { name: inv.reverseReceipt }));
    expect(reverse).not.toHaveBeenCalled();
    expect(screen.getByLabelText(new RegExp(inv.reasonCode))).toHaveFocus();
    expect(screen.getByLabelText(new RegExp(inv.reversalEffectiveAt))).toHaveAttribute("aria-invalid", "true");
  });
});
