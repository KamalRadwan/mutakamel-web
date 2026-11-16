// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StatusBadge } from "./StatusBadge";

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: { statusValues: {} } }),
}));

afterEach(cleanup);

describe("StatusBadge", () => {
  it.each(["NEW", "DISCOVERY", "QUALIFICATION", "PROPOSAL", "NEGOTIATION", "CONTRACTING"])("uses the shared active progress treatment for opportunity %s", (value) => {
    const { container } = render(<StatusBadge value={value} kind="OpportunityStageFlag" />);
    expect(screen.getByText(value)).toHaveClass("bg-info-subtle", "text-info-subtle-foreground");
    expect(container.querySelector(".dot-pending")).toHaveClass("bg-current");
  });

  it.each([
    ["WON", "bg-success-subtle"], ["LOST", "bg-destructive-subtle"], ["ON_HOLD", "bg-warning-subtle"],
  ])("preserves the semantic outcome tone for opportunity %s", (value, tone) => {
    const { container } = render(<StatusBadge value={value} kind="OpportunityStageFlag" />);
    expect(screen.getByText(value)).toHaveClass(tone);
    expect(container.querySelector(".dot-pending")).toBeNull();
  });

  it("keeps an unknown opportunity stage neutral", () => {
    render(<StatusBadge value="FUTURE_STAGE" kind="OpportunityStageFlag" />);
    expect(screen.getByText("FUTURE_STAGE").closest("span")).toHaveClass("bg-muted");
  });
  it("renders a mapped value with its role's tone and a text label", () => {
    render(<StatusBadge value="CONVERTED" kind="LeadStatus" />);
    expect(screen.getByText("CONVERTED")).toBeInTheDocument();
  });

  it("renders a pending dot for an ink + motion role", () => {
    const { container } = render(<StatusBadge value="OPEN" kind="LeadStatus" />);
    expect(container.querySelector(".dot-pending")).not.toBeNull();
  });

  it("falls back to neutral with the raw value bidi-isolated for an unmapped value, instead of throwing", () => {
    expect(() => render(<StatusBadge value="SOME_FUTURE_VALUE" kind="LeadStatus" />)).not.toThrow();
    const raw = screen.getByText("SOME_FUTURE_VALUE");
    // Was a plain monospace <span>. An unmapped wire value IS an identifier —
    // a Latin code sitting in Arabic chrome — so it now renders through
    // `IdentifierText`. Without the isolation the code the user reads is
    // reordered and stops being the code the system holds (U8).
    expect(raw.tagName.toLowerCase()).toBe("bdi");
    expect(raw).toHaveAttribute("dir", "ltr");
    expect(raw).toHaveClass("font-mono");
  });
});
