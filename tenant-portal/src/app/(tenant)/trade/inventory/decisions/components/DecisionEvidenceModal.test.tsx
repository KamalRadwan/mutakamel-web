// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/design-system";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { DecisionEvidenceModal } from "./DecisionEvidenceModal";

let language: "ar" | "en" = "en";
const dictionaries = { ar, en };
const id = "019f2200-0000-7000-8000-000000000001";
const decision = {
  id, decisionType: "INVENTORY_TOLERANCE", aggregateType: "INVENTORY_RECEIPT_LINE",
  aggregateId: "019f2200-0000-7000-8000-000000000002", outcome: "ALLOW", selectedValue: "ALLOW",
  explanation: "The published tolerance policy allows this receipt.", explanationCode: "WITHIN_TOLERANCE",
  evaluatedAt: "2026-11-03T08:42:00Z", correlationId: "019f2200-0000-7000-8000-000000000003",
  policyVersions: [], matchedRules: ["RECEIPT_TOLERANCE"], branchId: null, companyId: null,
};
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: { permissions: [] } }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: dictionaries[language], lang: language, dir: language === "ar" ? "rtl" : "ltr" }) }));
vi.mock("@/components/audit/RecordHistoryTab", () => ({ RecordHistoryTab: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("../[id]/hooks/useInventoryDecision", () => ({ useInventoryDecision: () => ({
  t: dictionaries[language], lang: language, canRead: true, isScopeResolved: true, decision,
  isLoading: false, isRefreshing: false, isNotFound: false, queryError: null, reload: vi.fn(),
  policyRows: [{ key: "policy1", code: "RECEIPT_TOLERANCE", version: "3" }], selectedLabel: dictionaries[language].tradeStatus.ALLOW,
  aggregateLabel: dictionaries[language].tradeInventory.readViews.aggregates.INVENTORY_RECEIPT_LINE, branchLabel: "Cairo",
}) }));

afterEach(() => { cleanup(); language = "en"; });

describe.each(["ar", "en"] as const)("decision evidence (%s)", (locale) => {
  it("shows safe policy evidence in a centered read-only dossier and hides technical references initially", () => {
    language = locale;
    const close = vi.fn();
    render(<TooltipProvider><DecisionEvidenceModal id={id} onClose={close} onRestoreFocus={vi.fn()} /></TooltipProvider>);
    const dialog = screen.getByRole("dialog");
    const copy = dictionaries[locale].tradeInventory.readViews;
    expect(within(dialog).getByText(dictionaries[locale].tradeStatus.INVENTORY_TOLERANCE)).toBeInTheDocument();
    expect(within(dialog).getByText(decision.explanation)).toBeInTheDocument();
    expect(within(dialog).getByText(copy.policyVersions)).toBeInTheDocument();
    expect(within(dialog).getByText(copy.matchedRules)).toBeInTheDocument();
    expect(within(dialog).queryByText(id)).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /approve|override|rerun|اعتماد|تجاوز/u })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: copy.technicalDetails }));
    expect(within(dialog).getByText(id)).toBeVisible();
    const closeButtons = within(dialog).getAllByRole("button", { name: dictionaries[locale].common.close });
    fireEvent.click(closeButtons[closeButtons.length - 1]);
    expect(close).toHaveBeenCalled();
  });
});
