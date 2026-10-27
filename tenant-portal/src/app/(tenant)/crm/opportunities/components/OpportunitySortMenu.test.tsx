// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { useWorkspaceState } from "@/design-system";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import type { OpportunitiesSort } from "../hooks/useOpportunitiesList";
import { OpportunitySortMenu } from "./OpportunitySortMenu";

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
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

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
  window.history.replaceState(null, "", "/crm/opportunities");
});

const choices = [
  { key: "sortNewest", sort: { id: "createdAt", direction: "desc" } },
  { key: "sortOldest", sort: { id: "createdAt", direction: "asc" } },
  { key: "sortValue", sort: { id: "amount", direction: "desc" } },
  { key: "sortProbability", sort: { id: "probabilityPercent", direction: "desc" } },
  { key: "sortCloseDate", sort: { id: "expectedCloseDate", direction: "asc" } },
  { key: "sortTitle", sort: { id: "title", direction: "asc" } },
] satisfies { key: keyof typeof en.crmOpportunities; sort: OpportunitiesSort }[];
const defaultSort: OpportunitiesSort = { id: "createdAt", direction: "desc" };

function WorkspaceSortMenu({ onSortChange, onPageChange }: {
  onSortChange: (sort: { id: string; direction: "asc" | "desc" }) => void;
  onPageChange: (page: number) => void;
}) {
  const workspace = useWorkspaceState("opportunities", {
    defaultView: "board",
    defaultSort,
    onSortChange,
    onPageChange,
  });
  return <OpportunitySortMenu sort={workspace.sort ?? defaultSort} setSort={workspace.setSort} />;
}

describe.each(["en", "ar"] as const)("OpportunitySortMenu (%s)", (lang) => {
  it("offers only the six supported sorts and marks the current one", async () => {
    language.value = lang;
    const labels = dictionaries[lang].crmOpportunities;
    const setSort = vi.fn();
    render(<OpportunitySortMenu sort={defaultSort} setSort={setSort} />);

    const trigger = screen.getByRole("button", { name: labels.sortLabel });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveClass("size-(--size-toolbar-control)", "border-line-control", "bg-surface-subtle");
    fireEvent.keyDown(trigger, { key: "Enter" });

    const options = await screen.findAllByRole("menuitemradio");
    expect(options.map((option) => option.textContent)).toEqual(choices.map((choice) => labels[choice.key]));
    expect(screen.getByRole("menu")).toHaveAttribute("dir", directions[lang]);
    expect(options.map((option) => option.getAttribute("aria-checked"))).toEqual([
      "true", "false", "false", "false", "false", "false",
    ]);
    expect(setSort).not.toHaveBeenCalled();
  });

  it.each(choices)("sets $key and reflects the updated sort", async (choice) => {
    language.value = lang;
    const labels = dictionaries[lang].crmOpportunities;
    const setSort = vi.fn();
    const { rerender } = render(<OpportunitySortMenu sort={defaultSort} setSort={setSort} />);

    fireEvent.keyDown(screen.getByRole("button", { name: labels.sortLabel }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitemradio", { name: labels[choice.key] }));
    expect(setSort).toHaveBeenCalledTimes(1);
    expect(setSort).toHaveBeenCalledWith(choice.sort);
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());

    rerender(<OpportunitySortMenu sort={choice.sort} setSort={setSort} />);
    fireEvent.keyDown(screen.getByRole("button", { name: labels.sortLabel }), { key: "Enter" });
    expect(await screen.findByRole("menuitemradio", { name: labels[choice.key] })).toHaveAttribute("aria-checked", "true");
    expect(screen.getAllByRole("menuitemradio").filter((option) => option.getAttribute("aria-checked") === "true")).toHaveLength(1);
  });

  it.each(choices)("writes $key to the workspace URL and resets pagination", async (choice) => {
    language.value = lang;
    const labels = dictionaries[lang].crmOpportunities;
    window.history.replaceState(null, "", "/crm/opportunities?view=table&page=4&sort=createdAt&dir=asc");
    const onSortChange = vi.fn();
    const onPageChange = vi.fn();
    const props = { onSortChange, onPageChange };
    const { rerender } = render(<WorkspaceSortMenu {...props} />);

    fireEvent.keyDown(screen.getByRole("button", { name: labels.sortLabel }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitemradio", { name: labels[choice.key] }));
    const params = new URLSearchParams(window.location.search);
    expect(params.get("sort")).toBe(choice.sort.id);
    expect(params.get("dir")).toBe(choice.sort.direction);
    expect(params.get("page")).toBe("1");
    expect(params.get("view")).toBe("table");

    rerender(<WorkspaceSortMenu {...props} />);
    expect(onSortChange).toHaveBeenLastCalledWith(choice.sort);
    expect(onPageChange).toHaveBeenLastCalledWith(1);
  });

  it("allows keyboard selection", async () => {
    language.value = lang;
    const labels = dictionaries[lang].crmOpportunities;
    const setSort = vi.fn();
    render(<OpportunitySortMenu sort={defaultSort} setSort={setSort} />);

    fireEvent.keyDown(screen.getByRole("button", { name: labels.sortLabel }), { key: "Enter" });
    const oldest = await screen.findByRole("menuitemradio", { name: labels.sortOldest });
    fireEvent.keyDown(oldest, { key: "Enter" });
    expect(setSort).toHaveBeenCalledWith({ id: "createdAt", direction: "asc" });
  });
});
