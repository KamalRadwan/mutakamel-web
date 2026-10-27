// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/design-system";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { MovementPanel } from "./MovementPanel";
import { OpeningBalanceForm } from "./OpeningBalanceForm";
import { ReservationPanel } from "./ReservationPanel";

let language: "ar" | "en" = "en";
const dictionaries = { ar, en };
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: dictionaries[language], lang: language }),
}));
afterEach(() => { cleanup(); language = "en"; });

describe.each(["ar", "en"] as const)("serial-array quantity controls (%s)", (lang) => {
  it.each(["opening", "receipt", "delivery"] as const)("preserves the quantity for %s and validates serials inline", (kind) => {
    language = lang;
    const t = dictionaries[lang].tradeInventory;
    const submit = vi.fn().mockResolvedValue(true);
    render(
      <TooltipProvider>
        {kind === "opening" ? (
          <OpeningBalanceForm onSubmit={submit} isPending={false} disabled={false} error={null} />
        ) : (
          <MovementPanel
            sourceDocumentLabel="Document" createLabel="Create" postLabel="Post" reverseLabel="Reverse"
            createPendingKey="create" postPendingKey="post" reversePendingKey="reverse"
            createdId={undefined} onCreate={submit} onPost={submit} onReverse={submit}
            pending={null} disabled={false} canReverse={false} error={null} isDelivery={kind === "delivery"}
          />
        )}
      </TooltipProvider>,
    );
    const quantity = screen.getAllByLabelText(new RegExp(t.quantity, "u"))[0];
    fireEvent.change(quantity, { target: { value: "12.5" } });
    expect(quantity).toHaveValue("12.5");
    expect(quantity).toBeEnabled();

    fireEvent.click(screen.getByRole("button", {
      name: kind === "opening"
        ? /Lot, Serial & Expiry|خيارات تتبع الدفعات/u
        : /Lot \/ Serials|إضافة دفعة/u,
    }));
    const serial = screen.getByLabelText(t.serialKeysLabel);
    fireEvent.change(serial, { target: { value: "SN001\nSN002" } });
    expect(quantity).toHaveValue("12.5");
    expect(quantity).toBeEnabled();
    expect(serial).toHaveAttribute("aria-invalid", "true");
    expect(quantity).toHaveAccessibleDescription(t.serialArrayHint);
    fireEvent.change(quantity, { target: { value: "2" } });
    expect(serial).not.toHaveAttribute("aria-invalid", "true");
    fireEvent.change(serial, { target: { value: "SN001\nSN001" } });
    expect(screen.getByText(t.serialSelectionInvalid)).toBeInTheDocument();

    fireEvent.change(serial, { target: { value: "" } });
    expect(quantity).toBeEnabled();
    fireEvent.change(quantity, { target: { value: "3.5" } });
    expect(quantity).toHaveValue("3.5");
  });

  it("passes reservation tracking and an explicit release subset to their handlers", async () => {
    language = lang;
    const t = dictionaries[lang].tradeInventory;
    const create = vi.fn().mockResolvedValue(false);
    const release = vi.fn().mockResolvedValue(false);
    const id = "01902001-3000-7000-8000-000000000001";
    render(<TooltipProvider><ReservationPanel onCreate={create} onRelease={release}
      createdId={id} pending={null} disabled={false} error={null} /></TooltipProvider>);
    const serials = screen.getAllByLabelText(t.serialKeysLabel);
    fireEvent.change(screen.getAllByLabelText(new RegExp(t.quantity, "u"))[0], { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText(t.lotKey), { target: { value: "LOT1" } });
    fireEvent.change(serials[0], { target: { value: "SN001\nSN002" } });
    fireEvent.click(screen.getByRole("button", { name: t.submitReservation }));
    await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({
      quantity: "2", lotKey: "LOT1", serialKeys: "SN001\nSN002",
    })));
    fireEvent.change(screen.getAllByLabelText(new RegExp(t.quantity, "u"))[1], { target: { value: "1" } });
    fireEvent.change(serials[1], { target: { value: "SN002" } });
    fireEvent.click(screen.getByRole("button", { name: t.submitRelease }));
    await waitFor(() => expect(release).toHaveBeenCalledWith(id, 1, "1", "", "SN002"));
  });

  it.each([false, true])("passes a partial reversal subset (delivery=%s)", async (isDelivery) => {
    language = lang;
    const t = dictionaries[lang].tradeInventory;
    const reverse = vi.fn().mockResolvedValue(false);
    const id = "01902001-3000-7000-8000-000000000001";
    render(<TooltipProvider><MovementPanel sourceDocumentLabel="Document" createLabel="Create"
      postLabel="Post" reverseLabel="Reverse" createPendingKey="create" postPendingKey="post"
      reversePendingKey="reverse" createdId={id} onCreate={reverse} onPost={reverse} onReverse={reverse}
      pending={null} disabled={false} canReverse error={null} isDelivery={isDelivery}
      sessionEntries={[{ id, kind: isDelivery ? "delivery" : "receipt", status: "POSTED", nodeId: id,
        summary: "", version: 1, recordedAt: "", lines: [{ id, quantity: "2", serialKeys: ["SN001", "SN002"] }] }]}
    /></TooltipProvider>);
    expect(screen.getByText(`${id}: SN001, SN002`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t.addReversalLine }));
    fireEvent.change(screen.getByLabelText(new RegExp(t.movementLineId, "u")), { target: { value: id } });
    fireEvent.change(screen.getAllByLabelText(new RegExp(t.quantity, "u"))[1], { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText(t.serialKeysLabel), { target: { value: "SN002" } });
    fireEvent.click(screen.getByRole("button", { name: "Reverse" }));
    await waitFor(() => expect(reverse).toHaveBeenCalledWith(id, 1, "", "", [{
      lineId: id, quantity: "1", serialKeys: "SN002",
    }]));
  });
});
