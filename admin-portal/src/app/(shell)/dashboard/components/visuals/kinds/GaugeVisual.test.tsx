// @vitest-environment jsdom

import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DashboardVisual } from "@/types/dashboard";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";

const language = { lang: "en" as "ar" | "en", dir: "ltr" as "ltr" | "rtl", t: en as typeof ar };

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => language,
}));

/**
 * Recharts measures 0×0 under jsdom and renders no arc at all, so the fill of
 * each slice is only observable through the props. These doubles surface them.
 */
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({ children }: { children: React.ReactNode }) => <div data-testid="pie">{children}</div>,
  Cell: (props: Record<string, unknown>) => <div data-testid="cell" data-fill={String(props.fill)} />,
}));

import { GaugeVisual } from "./GaugeVisual";

function speak(lang: "ar" | "en") {
  language.lang = lang;
  language.dir = lang === "ar" ? "rtl" : "ltr";
  language.t = lang === "ar" ? ar : en;
}

/** 3 of 4 verified, with a single all-green band, as Core authors it. */
function verificationRate(
  remainderTone?: "neutral" | "danger",
): DashboardVisual {
  return {
    key: "domains.customVerificationRate",
    kind: "gauge",
    title: "Custom Domain Verification Rate",
    unit: "count",
    emphasis: "primary",
    reference: {
      maximum: 4,
      bands: [{ upTo: 1, tone: "green" }],
      ...(remainderTone ? { remainderTone } : {}),
    },
    data: { value: 3, maximum: 4 },
  } as DashboardVisual;
}

function arcFills(): string[] {
  return screen.getAllByTestId("cell").map((cell) => cell.dataset.fill ?? "");
}

function remainderSwatch(): string {
  const legend = screen.getByRole("list", { name: /Chart legend|مفتاح الرسم البياني/ });
  const item = within(legend).getAllByRole("listitem")[1];
  return item.querySelector("span[aria-hidden='true']")?.getAttribute("style") ?? "";
}

describe("GaugeVisual remainder", () => {
  afterEach(() => speak("en"));

  it("paints the unreached arc red when the shortfall is itself the problem", () => {
    render(<GaugeVisual visual={verificationRate("danger") as never} />);

    const [filled, rest] = arcFills();
    // The filled part is verified work and keeps the band colour it earned;
    // only the gap — the unverified domains — turns red.
    expect(filled).toBe("var(--chart-success)");
    expect(rest).toBe("var(--chart-danger)");
    expect(remainderSwatch()).toContain("var(--chart-danger)");
  });

  it("leaves the remainder the neutral grid grey when the field is absent", () => {
    render(<GaugeVisual visual={verificationRate() as never} />);

    expect(arcFills()).toEqual(["var(--chart-success)", "var(--chart-grid)"]);
    expect(remainderSwatch()).toContain("var(--chart-grid)");
  });

  it("treats an explicit neutral remainder exactly like today's gauges", () => {
    render(<GaugeVisual visual={verificationRate("neutral") as never} />);

    expect(arcFills()).toEqual(["var(--chart-success)", "var(--chart-grid)"]);
  });

  it("says the shortfall in words too, so colour is never the only encoding", () => {
    render(<GaugeVisual visual={verificationRate("danger") as never} />);

    expect(
      screen.getByRole("figure", { name: "Custom Domain Verification Rate" }),
    ).toHaveAccessibleDescription(
      "Custom Domain Verification Rate: 3 of 4, or 75%. Status: Healthy. The unreached remainder is what needs attention.",
    );
  });

  it("leaves a neutral gauge's description as it was", () => {
    render(<GaugeVisual visual={verificationRate() as never} />);

    expect(
      screen.getByRole("figure", { name: "Custom Domain Verification Rate" }),
    ).toHaveAccessibleDescription(
      "Custom Domain Verification Rate: 3 of 4, or 75%. Status: Healthy.",
    );
  });

  it("carries the shortfall sentence in Arabic as well", () => {
    speak("ar");
    render(<GaugeVisual visual={verificationRate("danger") as never} />);

    expect(
      screen.getByRole("figure", { name: "Custom Domain Verification Rate" }),
    ).toHaveAccessibleDescription(
      expect.stringContaining("الجزء غير المكتمل من القوس هو ما يحتاج متابعة."),
    );
  });
});
