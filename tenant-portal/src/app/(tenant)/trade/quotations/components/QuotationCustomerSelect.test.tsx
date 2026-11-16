// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import type { QuotationCustomersState } from "../hooks/useQuotationCustomers";
import { CUSTOMER_OPTION } from "../hooks/quotation-composer.test-fixtures";
import { QuotationCustomerSelect } from "./QuotationCustomerSelect";

vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en", dir: "ltr" }) }));
const defaults: QuotationCustomersState = { options: [], search: "", setSearch: vi.fn(),
  isLoading: false, hasMore: false, loadMore: vi.fn(), error: null, retry: vi.fn() };
function open(customers: Partial<QuotationCustomersState>) {
  render(<QuotationCustomerSelect customers={{ ...defaults, ...customers }} selected={null} onSelect={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: en.quotationExperience.chooseCustomer }));
}
afterEach(cleanup);
describe("quotation customer dependency boundaries", () => {
  it("shows an empty result only after a successful empty read", () => {
    open({}); expect(screen.getByText(en.quotationExperience.customerNoResults)).toBeTruthy();
  });
  it("shows dependency recovery without a contradictory empty result", () => {
    const retry = vi.fn(); open({ error: { status: 503, code: "TRADE.DEPENDENCY.UNAVAILABLE" }, retry });
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByText(en.quotationExperience.customerNoResults)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: en.common.retry })); expect(retry).toHaveBeenCalledOnce();
  });
  it("hides stale selectable rows and pagination after a failed refresh", () => {
    open({ options: [CUSTOMER_OPTION], hasMore: true, error: { status: 503, code: "TRADE.DEPENDENCY.UNAVAILABLE" } });
    expect(screen.queryByText(CUSTOMER_OPTION.displayName)).toBeNull();
    expect(screen.queryByRole("button", { name: en.tradeDocuments.quotations.customerMore })).toBeNull();
  });
});
