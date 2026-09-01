// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Activity } from "lucide-react";

const i18n = vi.hoisted(() => ({ lang: "en" as "en" | "ar" }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: i18n.lang }),
}));

import { StatCard, StatGrid } from "./StatCard";

// This component had no test at all when it was restyled to match the admin
// portal, and the restyle changed its layout rather than only its classes.
// These pin the decisions that the rewrite could silently undo.

describe("StatCard", () => {
  it("wraps full labels and descriptions instead of hiding them behind pointer-only truncation", () => {
    const label = "A complete operational metric label that must remain available";
    const description = "A complete explanation that remains readable with keyboard and zoom.";
    render(<StatCard label={label} value="Ready" description={description} />);

    // The previous horizontal tile truncated its label, which is content a
    // keyboard or zoom user can never recover — there is no title attribute
    // behind it and no hover to reveal it.
    expect(screen.getByText(label)).not.toHaveClass("truncate");
    expect(screen.getByText(label)).not.toHaveAttribute("title");
    expect(screen.getByText(description)).not.toHaveClass("truncate");
  });

  it("keeps Arabic on Western digits, which is this portal's settled decision", () => {
    // Deliberately NOT admin's assertion. Admin renders Arabic-Indic digits;
    // this portal pins `ar-EG-u-nu-latn` in src/lib/format/locale.ts —
    // docs/design/typography.md#the-digit-decision--settled. Porting admin's
    // expectation here would have quietly reversed a settled decision.
    i18n.lang = "ar";
    render(<StatCard label="الإجمالي" value={1234} />);
    expect(screen.getByText("1,234")).toBeInTheDocument();
    i18n.lang = "en";
  });

  it("passes a pre-formatted string through untouched", () => {
    // Every existing call site formats its own value — one of them needs
    // `style: "percent"`, which no default inside this component could infer.
    render(<StatCard label="Conversion" value="12.5%" />);
    expect(screen.getByText("12.5%")).toBeInTheDocument();
  });

  it("stacks the value under the label rather than beside it", () => {
    // The layout change itself. A horizontal tile offsets each value by however
    // wide its icon and label happen to be, so a row of them has no common edge
    // to scan down — which is the whole job of a KPI strip.
    const { container } = render(<StatCard label="Leads" value="42" icon={Activity} />);
    const label = screen.getByText("Leads");
    const value = screen.getByText("42");
    // Queried as a node, not by role: the icon is aria-hidden by design, so it
    // is absent from the accessibility tree and getByRole cannot see it.
    const icon = container.querySelector("svg");

    expect(icon).not.toBeNull();
    expect(label.parentElement).toContainElement(icon);
    expect(label.parentElement).not.toContainElement(value);
    // DOCUMENT_POSITION_FOLLOWING === 4: the value comes after the label row.
    expect(label.compareDocumentPosition(value) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.firstElementChild).not.toHaveClass("flex");
  });

  it("adds an accent only when a tone is asked for", () => {
    const { container: plain } = render(<StatCard label="A" value="1" />);
    expect(plain.firstElementChild?.className).not.toMatch(/border-t-2/);

    const { container: toned } = render(<StatCard label="B" value="2" tone="danger" />);
    expect(toned.firstElementChild).toHaveClass("border-t-2", "border-t-destructive");
  });
});

describe("StatGrid", () => {
  it("lays its tiles out on one responsive grid", () => {
    const { container } = render(
      <StatGrid>
        <StatCard label="A" value="1" />
        <StatCard label="B" value="2" />
      </StatGrid>,
    );
    expect(container.firstElementChild).toHaveClass("grid", "grid-cols-2", "sm:grid-cols-3", "lg:grid-cols-4");
  });
});
