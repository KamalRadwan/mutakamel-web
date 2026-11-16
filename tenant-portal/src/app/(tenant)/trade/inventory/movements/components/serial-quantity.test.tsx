// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Field, Input, TooltipProvider } from "@/design-system";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { MovementTrackingFields } from "./MovementTrackingFields";
import { MovementActionModal } from "./MovementActionModal";
import type { useInventoryMovements } from "../hooks/useInventoryMovements";
import type { SessionMovementEntry } from "../movements-contract";

let language: "ar" | "en" = "en";
const dictionaries = { ar, en };
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: dictionaries[language], lang: language, dir: language === "ar" ? "rtl" : "ltr" }),
}));
afterEach(() => { cleanup(); language = "en"; });

function TrackingHarness({ mode }: { mode: "NONE" | "LOT" | "SERIAL" }) {
  const [values, setValues] = useState({ quantity: "12.5", lotKey: "", serialKeys: "" });
  return <><Field label={dictionaries[language].tradeInventory.quantity} showLabel>
    <Input value={values.quantity} onChange={event => setValues(current => ({ ...current, quantity: event.target.value }))} />
  </Field><MovementTrackingFields mode={mode} values={values} disabled={false}
    onChange={patch => setValues(current => ({ ...current, ...patch }))} /></>;
}

describe.each(["ar", "en"] as const)("tracking and centered follow-up forms (%s)", lang => {
  it("keeps decimal quantity editable and validates explicit serial cardinality", () => {
    language = lang;
    const t = dictionaries[lang].tradeInventory;
    render(<TooltipProvider><TrackingHarness mode="SERIAL" /></TooltipProvider>);
    const quantity = screen.getByLabelText(t.quantity);
    const serials = screen.getByLabelText(new RegExp(t.serialKeysLabel));
    fireEvent.change(serials, { target: { value: "SN001\nSN002" } });
    expect(quantity).toHaveValue("12.5");
    expect(quantity).toBeEnabled();
    expect(serials).toHaveAttribute("aria-invalid", "true");
    fireEvent.change(quantity, { target: { value: "2" } });
    expect(serials).not.toHaveAttribute("aria-invalid", "true");
    fireEvent.change(serials, { target: { value: "SN001\nSN001" } });
    expect(screen.getByText(t.serialSelectionInvalid)).toBeInTheDocument();
  });

  it("shows only the tracking dimension supported by the item", () => {
    language = lang;
    const t = dictionaries[lang].tradeInventory;
    const { rerender } = render(<TrackingHarness mode="LOT" />);
    expect(screen.getByLabelText(new RegExp(t.lotKey))).toBeInTheDocument();
    expect(screen.queryByLabelText(t.serialKeysLabel)).not.toBeInTheDocument();
    rerender(<TrackingHarness mode="NONE" />);
    expect(screen.queryByLabelText(t.lotKey)).not.toBeInTheDocument();
  });

  it("releases the actual session reservation using its hidden version and exact serial subset", async () => {
    language = lang;
    const t = dictionaries[lang].tradeInventory;
    const release = vi.fn().mockResolvedValue(false);
    const id = "01902001-3000-7000-8000-000000000001";
    const target: SessionMovementEntry = { id, kind: "reservation", nodeId: id, summary: "Scanner", status: "ACTIVE", version: 7,
      recordedAt: "2026-11-03T08:00:00Z", display: { sourceLabel: "SO-2026-001", nodeLabel: "Cairo warehouse" }, serialKeys: ["SN001", "SN002"],
      reservation: { id, fulfillmentNodeId: id, status: "ACTIVE", version: 7, quantity: "2", releasedQuantity: "0", consumedQuantity: "0", remainingQuantity: "2" } };
    const controller = { pending: null, formError: null, releaseReservation: release } as unknown as ReturnType<typeof useInventoryMovements>;
    render(<TooltipProvider><MovementActionModal target={target} mode="release" controller={controller} onClose={vi.fn()} /></TooltipProvider>);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByDisplayValue(id)).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("7")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(t.quantity), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText(t.serialKeysLabel), { target: { value: "SN002" } });
    fireEvent.click(screen.getByRole("button", { name: t.releaseTitle }));
    await waitFor(() => expect(release).toHaveBeenCalledWith(id, 7, "1", "", "SN002"));
  });
});
