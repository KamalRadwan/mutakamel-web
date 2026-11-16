// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/design-system";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import type { MovementReferences } from "../hooks/useMovementWorkspace";
import { OpeningBalanceForm } from "./OpeningBalanceForm";
import { ReservationPanel } from "./ReservationPanel";
import { MovementPanel } from "./MovementPanel";

let language: "ar" | "en" = "en";
const dictionaries = { ar, en };
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: dictionaries[language], lang: language, dir: language === "ar" ? "rtl" : "ltr" }) }));
vi.mock("../hooks/useMovementSources", () => ({ useMovementSources: () => ({
  source: null, items: [], selectedId: "", error: null, loading: false, page: 1, total: 0,
  select: vi.fn(), refresh: vi.fn(), previous: vi.fn(), next: vi.fn(),
}) }));
const refresh = vi.fn();
const refs = {
  items: [], nodes: [], uoms: [], canCatalog: true, canNodes: true, isLoading: false,
  itemError: null, searchItems: vi.fn(), refresh,
  nodeLabel: () => "Cairo", uomLabel: () => "Piece", itemLabel: () => "Scanner",
} as unknown as MovementReferences;
afterEach(() => { cleanup(); language = "en"; vi.clearAllMocks(); });

describe.each(["ar", "en"] as const)("movement create form validation (%s)", locale => {
  it("identifies opening quantity/date fields and focuses the first invalid required control", () => {
    language = locale;
    const inv = dictionaries[locale].tradeInventory;
    const submit = vi.fn().mockResolvedValue(false);
    render(<TooltipProvider><OpeningBalanceForm refs={refs} onSubmit={submit} isPending={false} error={null} onClose={vi.fn()} /></TooltipProvider>);
    fireEvent.click(screen.getByRole("button", { name: inv.submitOpeningBalance }));
    expect(submit).not.toHaveBeenCalled();
    const node = screen.getByRole("combobox", { name: new RegExp(inv.movementNode) });
    expect(node).toHaveAttribute("aria-required", "true");
    expect(node).toHaveAttribute("aria-invalid", "true");
    expect(node).toHaveFocus();
    expect(screen.getByLabelText(new RegExp(inv.quantity))).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(new RegExp(inv.businessEffectiveAt))).toHaveAttribute("aria-invalid", "true");
    fireEvent.change(screen.getByLabelText(new RegExp(inv.quantity)), { target: { value: "0.00000001" } });
    fireEvent.click(screen.getByRole("button", { name: inv.submitOpeningBalance }));
    expect(screen.getByLabelText(new RegExp(inv.quantity))).not.toHaveAttribute("aria-invalid", "true");
    expect(node).toHaveFocus();
  });

  it.each(["reservation", "receipt", "delivery"] as const)("identifies and focuses a missing %s source without submitting", kind => {
    language = locale;
    const inv = dictionaries[locale].tradeInventory;
    const submit = vi.fn().mockResolvedValue(false);
    render(<TooltipProvider>{kind === "reservation"
      ? <ReservationPanel refs={refs} headers={{}} canReadSource onSubmit={submit} pending={false} error={null} onClose={vi.fn()} />
      : <MovementPanel refs={refs} headers={{}} canReadSource isDelivery={kind === "delivery"} sessionEntries={[]} onSubmit={submit} pending={false} error={null} onClose={vi.fn()} />}</TooltipProvider>);
    fireEvent.click(screen.getByRole("button", { name: kind === "reservation" ? inv.submitReservation : inv.movementCreateDraft }));
    const source = screen.getByRole("combobox", { name: new RegExp(kind === "receipt" ? inv.movementPurchaseOrder : inv.movementSalesOrder) });
    expect(source).toHaveAttribute("aria-invalid", "true");
    expect(source).toHaveFocus();
    expect(screen.getByLabelText(new RegExp(inv.quantity))).toHaveAttribute("aria-invalid", "true");
    expect(submit).not.toHaveBeenCalled();
  });

  it("offers item-search retry inside the active opening modal", () => {
    language = locale;
    const inv = dictionaries[locale].tradeInventory;
    render(<TooltipProvider><OpeningBalanceForm refs={{ ...refs, itemError: { status: 0, message: "Catalogue unavailable" } }}
      onSubmit={vi.fn()} isPending={false} error={null} onClose={vi.fn()} /></TooltipProvider>);
    fireEvent.click(screen.getByLabelText(new RegExp(inv.movementItem)));
    expect(screen.getByRole("alert")).toHaveTextContent(inv.movementReferencesFailed);
    expect(screen.queryByText("Catalogue unavailable")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: dictionaries[locale].common.retry }));
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("retries the preserved original operation independently of current draft validation", async () => {
    language = locale;
    const retry = vi.fn().mockResolvedValue(true);
    const submit = vi.fn();
    const close = vi.fn();
    render(<TooltipProvider><OpeningBalanceForm refs={refs} onSubmit={submit} isPending={false}
      error={dictionaries[locale].tradeInventory.unresolvedWrite} onClose={close} retry={retry} /></TooltipProvider>);
    fireEvent.click(screen.getByRole("button", { name: dictionaries[locale].tradeInventory.movementRetryOriginal }));
    await waitFor(() => expect(close).toHaveBeenCalledWith(true));
    expect(retry).toHaveBeenCalledOnce();
    expect(submit).not.toHaveBeenCalled();
  });
});
