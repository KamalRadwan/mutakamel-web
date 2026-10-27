// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { useWorkspaceState } from "@/design-system";
import type { LeadsSort } from "../hooks/useLeadList";
import { LeadSortMenu } from "./LeadSortMenu";
import { LeadGridToolbar } from "./lead-grid/LeadGridToolbar";
import { useLeadExecutiveCardView } from "./lead-grid/useLeadExecutiveCardView";

const dictionaries = { en, ar };
const directions = { en: "ltr", ar: "rtl" } as const;
const { language } = vi.hoisted(() => ({ language: { value: "en" as "en" | "ar" } }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({
    lang: language.value,
    dir: directions[language.value],
    t: dictionaries[language.value],
  }),
}));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: null }) }));
vi.mock("@/hooks/useAccessMode", () => ({ useAccessMode: () => ({ canMutate: false }) }));

// Exercise the real Radix menu; jsdom lacks its pointer and measurement APIs.
beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(() => {
  cleanup();
  language.value = "en";
  window.history.replaceState(null, "", "/crm/leads");
});

const choices = [
  { key: "newestFirst", sort: { id: "createdAt", direction: "desc" } },
  { key: "oldestFirst", sort: { id: "createdAt", direction: "asc" } },
  { key: "nameAscending", sort: { id: "displayName", direction: "asc" } },
  { key: "nameDescending", sort: { id: "displayName", direction: "desc" } },
] satisfies { key: keyof typeof en.crmLeadWorkspace.sort; sort: LeadsSort }[];
const defaultSort: LeadsSort = { id: "createdAt", direction: "desc" };

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

function WorkspaceSortMenu({ onSortChange, onPageChange }: {
  onSortChange: (sort: { id: string; direction: "asc" | "desc" }) => void;
  onPageChange: (page: number) => void;
}) {
  const workspace = useWorkspaceState("leads", {
    defaultView: "board",
    defaultSort,
    onSortChange,
    onPageChange,
  });
  return <LeadSortMenu sort={workspace.sort ?? defaultSort} setSort={workspace.setSort} />;
}

function GridSortToolbar({ sort, onSortChange }: {
  sort: LeadsSort;
  onSortChange: (sort: { id: string; direction: "asc" | "desc" }) => void;
}) {
  const grid = useLeadExecutiveCardView({
    items: [], stages: [], selectedIds: new Set(), onSelectionChange: () => {},
    canUpdate: () => false, canDelete: () => false, sort, onSortChange,
  });
  return (
    <LeadGridToolbar
      selectedCount={0} hasSelectedOnPage={false} isAllSelected={false} isSomeSelected={false}
      canExport={false} canSort sortValue={grid.activeSortValue} loadedCount={0} totalCount={0}
      onToggleSelectAll={grid.toggleSelectAll} onExportCsv={grid.exportCsv}
      onSortValueChange={grid.handleSortValueChange}
    />
  );
}

describe.each(["en", "ar"] as const)("LeadSortMenu (%s)", (lang) => {
  it.each(choices)("keeps grid $key distinct and offers all four localized sorts", async (choice) => {
    language.value = lang;
    const dictionary = dictionaries[lang];
    const labels = dictionary.crmLeadWorkspace.sort;
    const onSortChange = vi.fn();
    const { rerender } = render(<GridSortToolbar sort={choice.sort} onSortChange={onSortChange} />);
    const trigger = screen.getByRole("combobox", { name: dictionary.crmLeads.executive.sortBy });
    expect(trigger).toHaveTextContent(labels[choice.key]);
    fireEvent.keyDown(trigger, { key: "Enter" });
    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(choices.map((item) => labels[item.key]));
    expect(screen.getByRole("option", { name: labels[choice.key] })).toHaveAttribute("aria-selected", "true");

    const next = choices[(choices.indexOf(choice) + 1) % choices.length];
    fireEvent.click(screen.getByRole("option", { name: labels[next.key] }));
    expect(onSortChange).toHaveBeenCalledWith(next.sort);
    rerender(<GridSortToolbar sort={next.sort} onSortChange={onSortChange} />);
    expect(screen.getByRole("combobox")).toHaveTextContent(labels[next.key]);
  });

  it.each(choices)("writes $key to the workspace URL and resets pagination", async (choice) => {
    language.value = lang;
    const labels = dictionaries[lang].crmLeadWorkspace.sort;
    window.history.replaceState(null, "", "/crm/leads?view=board&page=4&sort=createdAt&dir=asc");
    const onSortChange = vi.fn();
    const onPageChange = vi.fn();
    const props = { onSortChange, onPageChange };
    const { rerender } = render(<WorkspaceSortMenu {...props} />);

    fireEvent.keyDown(screen.getByRole("button", { name: labels.label }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitemradio", { name: labels[choice.key] }));
    const params = new URLSearchParams(window.location.search);
    expect(params.get("sort")).toBe(choice.sort.id);
    expect(params.get("dir")).toBe(choice.sort.direction);
    expect(params.get("page")).toBe("1");
    expect(params.get("view")).toBe("board");

    rerender(<WorkspaceSortMenu {...props} />);
    expect(onSortChange).toHaveBeenLastCalledWith(choice.sort);
    expect(onPageChange).toHaveBeenLastCalledWith(1);
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    fireEvent.keyDown(screen.getByRole("button", { name: labels.label }), { key: "Enter" });
    expect(await screen.findByRole("menuitemradio", { name: labels[choice.key] })).toHaveAttribute("aria-checked", "true");
  });

  it("offers only the four supported sorts and marks the current one", async () => {
    language.value = lang;
    const labels = dictionaries[lang].crmLeadWorkspace.sort;
    const setSort = vi.fn();
    render(<LeadSortMenu sort={defaultSort} setSort={setSort} />);

    const trigger = screen.getByRole("button", { name: labels.label });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    fireEvent.keyDown(trigger, { key: "Enter" });

    const options = await screen.findAllByRole("menuitemradio");
    expect(options.map((option) => option.textContent)).toEqual(choices.map((choice) => labels[choice.key]));
    expect(screen.getByRole("menu")).toHaveAttribute("dir", directions[lang]);
    expect(options.map((option) => option.getAttribute("aria-checked"))).toEqual(["true", "false", "false", "false"]);
    expect(setSort).not.toHaveBeenCalled();
  });

  it.each(choices)("sets $key and reflects the updated sort", async (choice) => {
    language.value = lang;
    const labels = dictionaries[lang].crmLeadWorkspace.sort;
    const setSort = vi.fn();
    const { rerender } = render(<LeadSortMenu sort={defaultSort} setSort={setSort} />);

    fireEvent.keyDown(screen.getByRole("button", { name: labels.label }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitemradio", { name: labels[choice.key] }));
    expect(setSort).toHaveBeenCalledTimes(1);
    expect(setSort).toHaveBeenCalledWith(choice.sort);
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());

    rerender(<LeadSortMenu sort={choice.sort} setSort={setSort} />);
    fireEvent.keyDown(screen.getByRole("button", { name: labels.label }), { key: "Enter" });
    expect(await screen.findByRole("menuitemradio", { name: labels[choice.key] })).toHaveAttribute("aria-checked", "true");
    expect(screen.getAllByRole("menuitemradio").filter((option) => option.getAttribute("aria-checked") === "true")).toHaveLength(1);
  });

  it("allows keyboard selection", async () => {
    language.value = lang;
    const labels = dictionaries[lang].crmLeadWorkspace.sort;
    const setSort = vi.fn();
    render(<LeadSortMenu sort={defaultSort} setSort={setSort} />);

    fireEvent.keyDown(screen.getByRole("button", { name: labels.label }), { key: "Enter" });
    const oldest = await screen.findByRole("menuitemradio", { name: labels.oldestFirst });
    fireEvent.keyDown(oldest, { key: "Enter" });

    expect(setSort).toHaveBeenCalledWith({ id: "createdAt", direction: "asc" });
  });
});
