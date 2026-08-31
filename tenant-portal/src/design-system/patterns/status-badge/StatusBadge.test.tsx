// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StatusBadge } from "./StatusBadge";

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: { statusValues: {} } }),
}));

afterEach(cleanup);

describe("StatusBadge", () => {
  it("renders a mapped value with its role's tone and a text label", () => {
    render(<StatusBadge value="CONVERTED" kind="LeadStatus" />);
    expect(screen.getByText("CONVERTED")).toBeInTheDocument();
  });

  it("renders a pending dot for an ink + motion role", () => {
    const { container } = render(<StatusBadge value="OPEN" kind="LeadStatus" />);
    expect(container.querySelector(".dot-pending")).not.toBeNull();
  });

  it("falls back to neutral with the raw value in monospace for an unmapped value, instead of throwing", () => {
    expect(() => render(<StatusBadge value="SOME_FUTURE_VALUE" kind="LeadStatus" />)).not.toThrow();
    const raw = screen.getByText("SOME_FUTURE_VALUE");
    expect(raw.tagName.toLowerCase()).toBe("span");
    expect(raw).toHaveClass("font-mono");
  });
});
