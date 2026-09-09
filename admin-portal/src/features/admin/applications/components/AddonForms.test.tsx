// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AddonDefinitionDialog } from "./AddonDefinitionDialog";
import { AddonPricingEditor } from "./AddonPricingEditor";
import { addonCopy } from "../lib/addon-copy";
import { addonFixture, addonPricesFixture, addonReceiptFixture } from "../lib/addon-test-fixtures";
vi.mock("@/i18n/I18nContext", () => ({ useOptionalI18n: () => ({ lang: "en", dir: "ltr", t: { common: { close: "Close" } } }) }));
const mutation = () => ({ submit: vi.fn().mockResolvedValue(addonReceiptFixture()), retry: vi.fn(), pending: null, error: null, canRetry: false, isSubmitting: false });
afterEach(cleanup);
describe("Addon form interaction", () => {
  it("focuses a linked summary and retains inline field errors", async () => {
    const write = mutation();
    render(<AddonDefinitionDialog applicationKey="crm" action="CREATE" mutation={write} copy={addonCopy("en")} onAccepted={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(document.activeElement).toHaveAttribute("role", "alert"));
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getAllByRole("link").some(link => link.getAttribute("href") === "#addon-name")).toBe(true);
    expect(write.submit).not.toHaveBeenCalled();
  });
  it("submits owner-qualified draft creation without commercial defaults", async () => {
    const write = mutation(); const onAccepted = vi.fn();
    render(<AddonDefinitionDialog applicationKey="crm" action="CREATE" mutation={write} copy={addonCopy("en")} onAccepted={onAccepted} onClose={vi.fn()} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Immutable key" }), { target: { value: "crm.logistics" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: " Logistics " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(write.submit).toHaveBeenCalledWith({ type: "definition", addonKey: "crm.logistics", command: { kind: "CREATE", body: { key: "crm.logistics", name: "Logistics" } } }));
    expect(onAccepted).toHaveBeenCalledOnce();
  });
  it("freezes reviewed definition revisions across background refresh", async () => {
    const write = mutation(); const detail = addonFixture();
    const props = { applicationKey: "crm", action: "UPDATE" as const, detail, mutation: write, copy: addonCopy("en"), onAccepted: vi.fn(), onClose: vi.fn() };
    const ui = render(<AddonDefinitionDialog {...props} />);
    ui.rerender(<AddonDefinitionDialog {...props} detail={{ ...detail, catalogueRevision: "12", draft: { ...detail.draft!, definitionRevision: "13" } }} />);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(write.submit).toHaveBeenCalled());
    expect(write.submit.mock.calls[0][0].command.body).toMatchObject({ expectedCatalogueRevision: "9007199254740993", expectedDefinitionRevision: "2" });
  });
  it("uses Arabic written form labels", () => {
    render(<AddonDefinitionDialog applicationKey="crm" action="CREATE" mutation={mutation()} copy={addonCopy("ar")} onAccepted={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole("textbox", { name: "الاسم" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "حفظ" })).toBeInTheDocument();
  });
});
describe("Dynamic addon ladder editor", () => {
  it("retains the selected annual cycle after an authoritative revision remount", () => {
    const props = { prices: addonPricesFixture(), canMutate: true, mutation: mutation(), copy: addonCopy("en"), onAccepted: vi.fn(), initialCycle: "ANNUAL" as const };
    const ui = render(<AddonPricingEditor key="0" {...props} />);
    const saved = addonPricesFixture();
    saved.ladders[1] = { billingCycle: "ANNUAL", configured: true, revision: "7", revisionId: "01900000-0000-7000-8000-000000000005", brackets: [{ minUsers: 1, maxUsers: null, unitPrice: "73.1250" }] };
    ui.rerender(<AddonPricingEditor key="7" {...props} prices={saved} />);
    expect(screen.getByRole("combobox")).toHaveTextContent("Annual");
    expect(screen.getByRole("textbox", { name: "USD / user" })).toHaveValue("73.1250");
  });
  it("starts an unconfigured ladder without inventing a free rate", () => {
    render(<AddonPricingEditor prices={addonPricesFixture()} canMutate mutation={mutation()} copy={addonCopy("en")} onAccepted={vi.fn()} />);
    expect(screen.getByText("Not configured — unavailable, not free")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "USD / user" })).toHaveValue("");
  });
  it("uses user-entered graduated brackets and independent expected revision", async () => {
    const write = mutation();
    render(<AddonPricingEditor prices={addonPricesFixture()} canMutate mutation={write} copy={addonCopy("en")} onAccepted={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Add bracket" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Through users" }), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Add bracket" }));
    fireEvent.change(screen.getAllByRole("textbox", { name: "Through users" })[1], { target: { value: "25" } });
    screen.getAllByRole("textbox", { name: "USD / user" }).forEach((input, index) => fireEvent.change(input, { target: { value: ["10", "9", "8"][index] } }));
    fireEvent.change(screen.getByRole("textbox", { name: "Audited reason" }), { target: { value: "Reviewed ladder" } });
    fireEvent.click(screen.getByRole("button", { name: "Save price ladder" }));
    await waitFor(() => expect(write.submit).toHaveBeenCalled());
    expect(write.submit.mock.calls[0][0].body).toEqual({ billingCycle: "MONTHLY", expectedLadderRevision: "0", reason: "Reviewed ladder",
      brackets: [{ minUsers: 1, maxUsers: 10, unitPrice: "10" }, { minUsers: 11, maxUsers: 25, unitPrice: "9" }, { minUsers: 26, maxUsers: null, unitPrice: "8" }] });
  });
  it("keeps a final open-ended bracket after deleting the last row", () => {
    render(<AddonPricingEditor prices={addonPricesFixture()} canMutate mutation={mutation()} copy={addonCopy("en")} onAccepted={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Add bracket" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove bracket 2" }));
    expect(screen.getByText("No upper limit")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Through users" })).not.toBeInTheDocument();
  });
  it("cannot write without both critical permissions", () => {
    render(<AddonPricingEditor prices={addonPricesFixture()} canMutate={false} mutation={mutation()} copy={addonCopy("en")} onAccepted={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Save price ladder" })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "USD / user" })).toBeDisabled();
  });
});
