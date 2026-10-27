// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { setLanguage } from "@/i18n/useLanguage";
import { formatNumber } from "@/lib/format/number";
import type { LeadKpis } from "../lead-bulk-contract";
import { LeadKpiStrip } from "./LeadKpiStrip";

const dictionaries = { ar, en };
const { language } = vi.hoisted(() => ({ language: { value: "en" as "ar" | "en" } }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: language.value, t: dictionaries[language.value] }),
}));
vi.mock("@/design-system", async () => ({
  ...(await import("@/design-system/patterns/kpi/KpiBadge")),
}));

const kpis: LeadKpis = {
  totalLeads: 101,
  newStageLeads: 60,
  newTodayLeads: 0,
  hotLeads: 39,
  qualifiedLeads: 51,
  overdueActivityLeads: 12,
};

function badgeNamed(label: string, count: number): HTMLElement {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return screen.getByRole("button", { name: new RegExp(`^${escaped}\\s*${count}$`, "u") });
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe("Lead KPI pills", () => {
  it.each(["en", "ar"] as const)("shows new-today context inline beside New in %s", (lang) => {
    language.value = lang;
    setLanguage(lang);
    const labels = dictionaries[lang].crmLeadWorkspace.kpis;
    const hint = labels.newToday.replace("{count}", formatNumber(1234, lang));
    const { rerender } = render(
      <LeadKpiStrip kpis={{ ...kpis, newTodayLeads: 1234 }} activePreset="ALL" onSelectPreset={vi.fn()} />,
    );

    const newBadge = badgeNamed(labels.new, 60);
    const inlineHint = screen.getByText(hint);
    expect(inlineHint).toBeVisible();
    expect(inlineHint).toHaveClass("text-badge", "text-kpi-new-text");
    expect(newBadge.parentElement).toContainElement(inlineHint);
    expect(newBadge.parentElement).toHaveClass("inline-flex", "items-center", "whitespace-nowrap");
    expect(newBadge).not.toHaveAttribute("title");

    rerender(<LeadKpiStrip kpis={kpis} activePreset="ALL" onSelectPreset={vi.fn()} />);
    expect(screen.queryByText(hint)).toBeNull();
    expect(screen.queryByText(labels.newToday.replace("{count}", "0"))).toBeNull();
    rerender(<LeadKpiStrip kpis={null} activePreset="ALL" onSelectPreset={vi.fn()} />);
    expect(screen.queryByText(hint)).toBeNull();
  });

  it.each(["en", "ar"] as const)("selects and clears server presets with localized counts in %s", (lang) => {
    language.value = lang;
    setLanguage(lang);
    const labels = dictionaries[lang].crmLeadWorkspace.kpis;
    const onSelectPreset = vi.fn();
    const { rerender } = render(<LeadKpiStrip kpis={kpis} activePreset="ALL" onSelectPreset={onSelectPreset} />);

    expect(screen.getByRole("region", { name: labels.label })).toHaveClass("gap-1.5");
    expect(badgeNamed(labels.total, 101)).toHaveClass("bg-kpi-total-surface", "ring-2", "ring-kpi-total-line");
    expect(badgeNamed(labels.new, 60)).toHaveClass("bg-kpi-new-surface");
    expect(badgeNamed(labels.hot, 39)).toHaveClass("bg-kpi-rated-surface");
    expect(badgeNamed(labels.qualified, 51)).toHaveClass("bg-kpi-qualified-surface");
    expect(badgeNamed(labels.overdue, 12)).toHaveClass("bg-kpi-overdue-surface");
    for (const button of screen.getAllByRole("button")) {
      expect(button.querySelector("svg")).not.toBeNull();
    }

    fireEvent.click(badgeNamed(labels.hot, 39));
    expect(onSelectPreset).toHaveBeenLastCalledWith("HOT_3_STAR");

    rerender(<LeadKpiStrip kpis={kpis} activePreset="HOT_3_STAR" onSelectPreset={onSelectPreset} />);
    const active = badgeNamed(labels.hot, 39);
    expect(active).toHaveAttribute("aria-pressed", "true");
    expect(active).toHaveClass("ring-2", "ring-kpi-rated-line");
    fireEvent.click(active);
    expect(onSelectPreset).toHaveBeenLastCalledWith("ALL");

    const overdue = badgeNamed(labels.overdue, 12);
    fireEvent.click(overdue);
    expect(onSelectPreset).toHaveBeenLastCalledWith("OVERDUE_ACTIVITY");

    rerender(<LeadKpiStrip kpis={kpis} activePreset="OVERDUE_ACTIVITY" onSelectPreset={onSelectPreset} />);
    const activeOverdue = badgeNamed(labels.overdue, 12);
    expect(activeOverdue).toHaveAttribute("aria-pressed", "true");
    expect(activeOverdue).toHaveClass("ring-2", "ring-kpi-overdue-line");
    fireEvent.click(activeOverdue);
    expect(onSelectPreset).toHaveBeenLastCalledWith("ALL");
  });

  it("shows placeholder count chips and disables filters when the KPI read is unavailable", () => {
    language.value = "en";
    setLanguage("en");
    const { container } = render(<LeadKpiStrip kpis={null} activePreset="ALL" onSelectPreset={vi.fn()} />);

    expect(container.querySelectorAll('[data-slot="kpi-count-placeholder"]')).toHaveLength(5);
    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("aria-busy", "true");
    }
  });
});
