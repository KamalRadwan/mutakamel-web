// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DetailSection } from "./DetailSection";

afterEach(cleanup);

describe("DetailSection", () => {
  it("renders fields as a definition list, not a table", () => {
    const { container } = render(
      <DetailSection
        title="Identity"
        fields={[
          { label: "Name", value: "Acme Holding" },
          { label: "Company", value: "Acme LLC" },
        ]}
      />,
    );
    expect(container.querySelector("dl")).not.toBeNull();
    expect(container.querySelector("table")).toBeNull();
    expect(screen.getByText("Acme Holding")).toBeInTheDocument();
  });

  it("keeps a label visible when the value is missing", () => {
    render(
      <DetailSection
        title="Contact"
        emptyValueLabel="Not recorded"
        fields={[{ label: "Email", value: null }]}
      />,
    );
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("Not recorded")).toBeInTheDocument();
  });

  it("renders arbitrary nodes as values — Money, DateTime, StatusBadge", () => {
    render(
      <DetailSection
        title="Totals"
        fields={[{ label: "Amount", value: <bdi data-testid="money">1,250.00</bdi> }]}
      />,
    );
    expect(screen.getByTestId("money")).toBeInTheDocument();
  });

  it("renders children under the fields for composed content", () => {
    render(
      <DetailSection title="Attachments" fields={[{ label: "Count", value: "2" }]}>
        <p>Nested content</p>
      </DetailSection>,
    );
    expect(screen.getByText("Nested content")).toBeInTheDocument();
  });

  it("renders with no fields at all", () => {
    render(
      <DetailSection title="Custom fields">
        <p>Only children</p>
      </DetailSection>,
    );
    expect(screen.getByText("Custom fields")).toBeInTheDocument();
    expect(screen.getByText("Only children")).toBeInTheDocument();
  });
});
