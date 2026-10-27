// @vitest-environment jsdom

import { createElement, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { FormDrawerProps } from "@/design-system";
import { en } from "@/i18n/dictionaries/en";
import { DOCUMENT_ID, ITEM_ID, PARTY_ID } from "../../documents/financial-document.test-fixtures";
import type { TradeEvidenceLineDraft } from "../../documents/lib/trade-financial-evidence";
import { InvoiceFormDrawer } from "./InvoiceFormDrawer";

const mocks = vi.hoisted(() => ({
  post: vi.fn(), patch: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), errorFromApi: vi.fn(), outcomeFromApi: vi.fn(() => false) },
}));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en }) }));
vi.mock("@/lib/api/errors", () => ({ normalizeApiError: () => ({ status: 0 }) }));
vi.mock("../../trade-api", () => ({
  tradePost: mocks.post, tradePatch: mocks.patch, tradeIfMatch: (version: number) => `"${version}"`,
  isTradeReplay: (headers: Headers) => headers.get("idempotency-replayed") === "true",
}));
// Keep the real form hook, write hook and recovery boundary; replace only
// presentation primitives and the line editor to focus on the write lifecycle.
vi.mock("@/design-system", () => ({
  useToast: () => mocks.toast,
  cn: (...values: string[]) => values.join(" "), proseMeasure: "",
  EmptyState: () => null,
  IdentifierText: ({ children }: { children: ReactNode }) => <bdi>{children}</bdi>,
  Field: ({ label, children }: { label: string; children: ReactNode }) => <label>{label}{children}</label>,
  Input: ({ value, onChange, readOnly, type, placeholder }: InputHTMLAttributes<HTMLInputElement>) =>
    createElement("input", { value, onChange, readOnly, type, placeholder }),
  Button: ({ children, onClick, loading, disabled, type }: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) =>
    createElement("button", { type, onClick, disabled: disabled || loading }, children),
  FormDrawer: ({ children, onSubmit, onOpenChange, isSubmitting, submitDisabled, labels }: FormDrawerProps) => (
    <form onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
      {children}
      {createElement("button", { type: "submit", disabled: isSubmitting || submitDisabled }, labels.submit)}
      {createElement("button", { type: "button", onClick: () => onOpenChange(false) }, labels.cancel)}
    </form>
  ),
}));
vi.mock("./InvoiceDraftLinesEditor", () => ({ InvoiceDraftLinesEditor: () => null }));
vi.mock("../../documents/components/TradeFinancialLinesEditor", () => ({
  TradeFinancialLinesEditor: ({ lines, onChangeLines }: {
    lines: TradeEvidenceLineDraft[];
    onChangeLines: (lines: TradeEvidenceLineDraft[]) => void;
  }) =>
    createElement("button", {
      type: "button",
      onClick: () => onChangeLines([
        { ...lines[0]!, itemId: ITEM_ID, uomCode: DOCUMENT_ID, unitPrice: "10" },
      ]),
    }, "Set line"),
}));

beforeEach(() => vi.clearAllMocks());

it("fences a committed create with a lost response and closes/refreshes after same-key replay", async () => {
  const committed = new Map<string, unknown>();
  mocks.post.mockImplementation(async (_path: string, body: unknown, options: { headers: Record<string, string> }) => {
    const key = options.headers["x-idempotency-key"]!;
    if (!committed.has(key)) {
      committed.set(key, body);
      throw new Error("Response lost after commit");
    }
    return { data: committed.get(key), headers: new Headers({ "idempotency-replayed": "true" }), status: 201 };
  });
  const onOpenChange = vi.fn();
  const onSaved = vi.fn().mockResolvedValue(undefined);
  const headers = { "x-mutakamel-company-id": DOCUMENT_ID, "x-mutakamel-branch-id": PARTY_ID };
  render(<InvoiceFormDrawer open headers={headers} onOpenChange={onOpenChange} onSaved={onSaved} />);
  fireEvent.change(screen.getByLabelText(en.tradeDocuments.customer), { target: { value: PARTY_ID } });
  fireEvent.click(screen.getByRole("button", { name: "Set line" }));
  const save = screen.getByRole("button", { name: en.tradeDocuments.executive.saveInvoiceDraft });
  expect(save).toBeEnabled();
  fireEvent.click(save);
  await screen.findByRole("heading", { name: en.tradeDocuments.ambiguousTitle });
  expect(save).toBeDisabled();
  expect(screen.getByLabelText(en.tradeDocuments.notes)).toBeDisabled();
  fireEvent.click(save);
  fireEvent.click(screen.getByRole("button", { name: en.common.cancel }));
  expect(mocks.post).toHaveBeenCalledOnce();
  expect(onOpenChange).not.toHaveBeenCalled();
  expect(onSaved).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: en.common.dismiss })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: en.common.retry }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(mocks.post).toHaveBeenCalledTimes(2);
  expect(mocks.post.mock.calls[1]).toEqual(mocks.post.mock.calls[0]);
  expect(committed.size).toBe(1);
  expect(onOpenChange).toHaveBeenCalledWith(false);
  expect(screen.queryByRole("heading", { name: en.tradeDocuments.ambiguousTitle })).not.toBeInTheDocument();
});
