// @vitest-environment jsdom

import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import type { WidgetDefinition } from "../../widget-contract";
import { AddWidgetDrawer } from "./AddWidgetDrawer";

const dictionaries = { en, ar } as const;
const state = vi.hoisted(() => ({ lang: "en" as "en" | "ar", missingLabel: false }));

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => {
    const t = dictionaries[state.lang];
    return { t: { ...t, crmDashboards: { ...t.crmDashboards,
      visualizations: state.missingLabel ? {} : t.crmDashboards.visualizations,
    } } };
  },
}));
vi.mock("@/design-system", () => {
  const Slot = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return {
    Button: ({ children, disabled, onClick }: { children?: ReactNode; disabled?: boolean; onClick?: () => void }) =>
      <button disabled={disabled} onClick={onClick}>{children}</button>,
    Field: Slot, FormDrawer: Slot, Select: Slot, SelectContent: Slot,
    SelectItem: Slot, SelectTrigger: Slot, SelectValue: () => null,
  };
});

const widget: WidgetDefinition = {
  id: "01900300-0000-7000-8000-000000000001",
  ownerUserId: "01900300-0000-7000-8000-000000000002",
  ownerName: null, name: "Fixture widget", visualizationType: "TABLE",
  querySpec: { series: [{ metricKey: "crm.leads.created.count" }], dimension: { key: "none" } },
  displaySpec: {}, schemaVersion: 1, revision: 1,
  createdAt: "2026-10-18T00:00:00Z", updatedAt: "2026-10-18T00:00:00Z",
  accessLevel: "OWNER", isShared: false,
};

function renderDrawer() {
  render(<AddWidgetDrawer open onOpenChange={vi.fn()} widgets={[widget]}
    placedWidgetIds={new Set()} widgetsUnavailable={false}
    isSubmitting={false} atCapacity={false} onSubmit={vi.fn()} />);
}

afterEach(() => { cleanup(); state.missingLabel = false; });

describe("dashboard widget picker localization", () => {
  it.each(['en', 'ar'] as const)('offers a translated next-page action in %s and disables it while loading', (lang) => {
    state.lang = lang;
    const onLoadMore = vi.fn();
    const props = { open: true, onOpenChange: vi.fn(), widgets: [widget], placedWidgetIds: new Set<string>(),
      widgetsUnavailable: false, isSubmitting: false, atCapacity: false, onSubmit: vi.fn(), hasMore: true, onLoadMore };
    const { rerender } = render(<AddWidgetDrawer {...props} />);
    const button = screen.getByRole('button', { name: dictionaries[lang].crmDashboards.loadMoreWidgets });
    fireEvent.click(button);
    expect(onLoadMore).toHaveBeenCalledTimes(1);
    rerender(<AddWidgetDrawer {...props} isLoadingMore />);
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });
  it.each(["en", "ar"] as const)("translates known visualization types in %s", (lang) => {
    state.lang = lang;
    renderDrawer();
    expect(screen.getByText(`Fixture widget · ${dictionaries[lang].crmDashboards.visualizations.TABLE}`)).toBeTruthy();
    expect(screen.queryByText(/TABLE/)).toBeNull();
  });

  it.each(["en", "ar"] as const)("uses a translated label when a visualization label is missing in %s", (lang) => {
    state.lang = lang;
    state.missingLabel = true;
    renderDrawer();
    expect(screen.getByText(`Fixture widget · ${dictionaries[lang].crmDashboards.unknownVisualization}`)).toBeTruthy();
    expect(screen.queryByText(/TABLE/)).toBeNull();
  });
});
