// @vitest-environment jsdom

import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DashboardVisual } from "@/types/dashboard";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { DASHBOARD_CHART_VISUAL_ITEM_LIMIT } from "../../charts/ChartAccessibility";

const language = { lang: "en" as "ar" | "en", dir: "ltr" as "ltr" | "rtl", t: en as typeof ar };

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => language,
}));

import { DashboardVisualCard } from "../DashboardVisualCard";
import { ListVisual } from "./ListVisual";

function speak(lang: "ar" | "en") {
  language.lang = lang;
  language.dir = lang === "ar" ? "rtl" : "ltr";
  language.t = lang === "ar" ? ar : en;
}

const invalidTenants = {
  key: "domains.invalidTenants",
  kind: "list",
  title: "Invalid Tenant Domains",
  unit: "count",
  emphasis: "primary",
  data: {
    rows: [
      {
        key: "t-1:acme.example",
        label: "Acme Holdings",
        detail: "acme.example",
        value: "Validation failed",
        href: "/tenants/11111111-1111-4111-8111-111111111111",
        tone: "red",
      },
      {
        key: "t-2:beta.example",
        label: "Beta Logistics",
        detail: "beta.example",
        value: "Callback timed out",
        tone: "red",
      },
    ],
  },
} as DashboardVisual;

describe("ListVisual", () => {
  afterEach(() => speak("en"));

  it("makes a row with an href a real internal link to that record", () => {
    render(<ListVisual visual={invalidTenants as never} />);

    const link = screen.getByRole("link", { name: /Acme Holdings/ });
    expect(link).toHaveAttribute("href", "/tenants/11111111-1111-4111-8111-111111111111");
    // Both the name and the domain live inside the one link target.
    expect(within(link).getByText("acme.example")).toBeInTheDocument();
  });

  it("renders a row without an href as plain text, not a dead link", () => {
    render(<ListVisual visual={invalidTenants as never} />);

    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getAllByText("Beta Logistics").length).toBeGreaterThan(0);
  });

  it("leaves its links reachable instead of hiding them behind aria-hidden", () => {
    const { container } = render(<ListVisual visual={invalidTenants as never} />);

    // A chart body is decorative and hidden; a body made of links cannot be —
    // aria-hidden over a focusable element keeps it in the tab order while
    // taking it out of the accessibility tree.
    const link = screen.getByRole("link", { name: /Acme Holdings/ });
    expect(link.closest("[aria-hidden='true']")).toBeNull();
    expect(container.querySelector("figure > div[aria-hidden='true']")).toBeNull();
  });

  it("shows the label, the detail line and the trailing note on each row", () => {
    render(<ListVisual visual={invalidTenants as never} />);

    const list = screen.getByRole("list");
    const first = within(list).getAllByRole("listitem")[0];
    expect(within(first).getByText("Acme Holdings")).toBeInTheDocument();
    expect(within(first).getByText("acme.example")).toBeInTheDocument();
    expect(within(first).getByText("Validation failed")).toBeInTheDocument();
  });

  it("repeats every row in the exact-value table, including ones past the visual limit", () => {
    const many = {
      ...invalidTenants,
      data: {
        rows: Array.from({ length: DASHBOARD_CHART_VISUAL_ITEM_LIMIT + 4 }, (_, index) => ({
          key: `t-${index}`,
          label: `Tenant ${index}`,
          detail: `tenant-${index}.example`,
          value: "Validation failed",
        })),
      },
    };

    render(<ListVisual visual={many as never} />);

    expect(within(screen.getByRole("list")).getAllByRole("listitem")).toHaveLength(
      DASHBOARD_CHART_VISUAL_ITEM_LIMIT,
    );
    // The table is the complete record, so nothing Core sent is lost.
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(
      DASHBOARD_CHART_VISUAL_ITEM_LIMIT + 5,
    );
    expect(screen.getByRole("figure", { name: "Invalid Tenant Domains" })).toHaveAccessibleDescription(
      "Invalid Tenant Domains: 16 records. The list shows 12; the rest are in the exact-value table.",
    );
  });

  it("titles the table columns from the portal's own copy", () => {
    render(<ListVisual visual={invalidTenants as never} />);

    expect(
      within(screen.getByRole("table"))
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent),
    ).toEqual(["Record", "Detail", "Note"]);
  });

  it("translates the title and the reason but never the tenant's own name", () => {
    speak("ar");
    render(<DashboardVisualCard visual={invalidTenants} />);

    expect(screen.getByRole("heading", { name: "نطاقات مستأجرين غير صالحة" })).toBeInTheDocument();
    expect(screen.getAllByText("فشل التحقق").length).toBeGreaterThan(0);

    // A tenant name and its domain are records, not vocabulary. Translating
    // them would rename the thing the operator has to go and open.
    expect(screen.getAllByText("Acme Holdings").length).toBeGreaterThan(0);
    expect(screen.getAllByText("acme.example").length).toBeGreaterThan(0);
  });

  it("falls back to the empty state when Core sends no rows", () => {
    render(<ListVisual visual={{ ...invalidTenants, data: { rows: [] } } as never} />);

    expect(screen.getByRole("status", { name: "Invalid Tenant Domains" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  /**
   * The panel renders whatever href a provider puts in the payload. A report
   * is a place to send an operator to a record, never off the portal, so a
   * row that names somewhere else still shows — it just is not a link.
   */
  it.each([
    ["an absolute URL", "https://example.com/tenants/1"],
    ["a protocol-relative URL", "//example.com/tenants/1"],
    ["a javascript: URL", "javascript:alert(1)"],
  ])("renders %s as plain text rather than a link", (_name, href) => {
    render(
      <ListVisual
        visual={
          {
            ...invalidTenants,
            data: {
              rows: [
                {
                  key: "t-1:acme.example",
                  label: "Acme Holdings",
                  detail: "acme.example",
                  href,
                },
              ],
            },
          } as never
        }
      />,
    );

    expect(screen.getAllByText("Acme Holdings").length).toBeGreaterThan(0);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
