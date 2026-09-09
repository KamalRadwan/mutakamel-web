// @vitest-environment jsdom

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { acceptedInvoiceFixture, invoiceCommercialId, manualInvoiceFixture } from "../model/invoice-commercial-fixtures";
import { InvoiceCommercialEvidence } from "./invoice-commercial-evidence";

vi.mock("@/design-system", () => ({ Card: ({ children }: { children: React.ReactNode }) => <section>{children}</section>, Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }));

describe("Invoice commercial evidence", () => {
  it("shows seats separately from quantity and accepted parent/definition identities", () => {
    render(<InvoiceCommercialEvidence value={acceptedInvoiceFixture()} lang="en" />);
    const line = screen.getAllByRole("listitem")[1];
    expect(within(line).getByText("Accepted seats").nextElementSibling).toHaveTextContent("30");
    expect(within(line).getByText("Invoice line quantity").nextElementSibling).toHaveTextContent("1.00");
    expect(within(line).getByText(invoiceCommercialId(6))).toBeInTheDocument();
    expect(within(line).getByText(invoiceCommercialId(8))).toBeInTheDocument();
    expect(within(line).getByText("USD 275.0000")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
  it("does not fabricate evidence or pricing controls for legacy invoices", () => {
    render(<InvoiceCommercialEvidence value={manualInvoiceFixture()} lang="en" />);
    expect(screen.getByText(/cannot be inferred/)).toBeInTheDocument();
    expect(screen.queryByText("Accepted seats")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
  it("retains complete pricing alongside known seats", () => {
    const value = acceptedInvoiceFixture();
    render(<InvoiceCommercialEvidence value={value} lang="en" />);
    expect(screen.getAllByText("Recorded applied pricing brackets")).toHaveLength(2);
    expect(screen.getAllByText("Accepted seats")).toHaveLength(2);
  });
  it("renders Arabic labels and original descriptions without synthetic translations", () => {
    render(<InvoiceCommercialEvidence value={acceptedInvoiceFixture()} lang="ar" />);
    expect(screen.getByRole("heading", { name: "الأدلة التجارية المحفوظة" })).toBeInTheDocument();
    expect(screen.getAllByText("المقاعد المقبولة")).toHaveLength(2);
    expect(screen.getByText("Retained addon subscription line")).toBeInTheDocument();
    expect(screen.queryByText("Accepted seats")).not.toBeInTheDocument();
  });
});
