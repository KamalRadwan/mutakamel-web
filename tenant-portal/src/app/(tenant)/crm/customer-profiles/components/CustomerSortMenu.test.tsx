// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { useWorkspaceState } from "@/design-system";
import type { CustomerProfileSortBy } from "../customer-profile-search-contract";

import { CustomerSortMenu } from "./CustomerSortMenu";

type CustomerSort = { id: CustomerProfileSortBy; direction: "asc" | "desc" };

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
  window.history.replaceState(null, "", "/crm/customer-profiles");
});

const choices = [
  { key: "newestFirst", sort: { id: "createdAt", direction: "desc" } },
  { key: "oldestFirst", sort: { id: "createdAt", direction: "asc" } },
  { key: "nameAscending", sort: { id: "displayName", direction: "asc" } },
  { key: "nameDescending", sort: { id: "displayName", direction: "desc" } },
] satisfies { key: keyof typeof en.crmCustomerProfiles.ui.sort; sort: CustomerSort }[];
const defaultSort: CustomerSort = { id: "createdAt", direction: "desc" };

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

function WorkspaceSortMenu({ onSortChange, onPageChange }: {
  onSortChange: (sort: { id: string; direction: "asc" | "desc" }) => void;
  onPageChange: (page: number) => void;
}) {
  const workspace = useWorkspaceState("customerProfiles", {
    defaultView: "board",
    defaultSort,
    onSortChange,
    onPageChange,
  });
  return <CustomerSortMenu sort={workspace.sort ?? defaultSort} setSort={workspace.setSort} />;
}

describe.each(["en", "ar"] as const)("CustomerSortMenu (%s)", (lang) => {
  it.each(choices.flatMap((choice) =>
    (["board", "card", "table"] as const).map((view) => ({ ...choice, view })),
  ))("writes $key in $view to the workspace URL and resets pagination", async (choice) => {
    language.value = lang;
    const labels = dictionaries[lang].crmCustomerProfiles.ui.sort;
    window.history.replaceState(null, "", `/crm/customer-profiles?view=${choice.view}&page=4&sort=createdAt&dir=asc`);
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
    expect(params.get("view")).toBe(choice.view);

    rerender(<WorkspaceSortMenu {...props} />);
    expect(onSortChange).toHaveBeenLastCalledWith(choice.sort);
    expect(onPageChange).toHaveBeenLastCalledWith(1);
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    fireEvent.keyDown(screen.getByRole("button", { name: labels.label }), { key: "Enter" });
    expect(await screen.findByRole("menuitemradio", { name: labels[choice.key] })).toHaveAttribute("aria-checked", "true");
  });

  it("offers only the four supported sorts and marks the current one", async () => {
    language.value = lang;
    const labels = dictionaries[lang].crmCustomerProfiles.ui.sort;
    const setSort = vi.fn();
    render(<CustomerSortMenu sort={defaultSort} setSort={setSort} />);

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
    const labels = dictionaries[lang].crmCustomerProfiles.ui.sort;
    const setSort = vi.fn();
    const { rerender } = render(<CustomerSortMenu sort={defaultSort} setSort={setSort} />);

    fireEvent.keyDown(screen.getByRole("button", { name: labels.label }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitemradio", { name: labels[choice.key] }));
    expect(setSort).toHaveBeenCalledTimes(1);
    expect(setSort).toHaveBeenCalledWith(choice.sort);
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());

    rerender(<CustomerSortMenu sort={choice.sort} setSort={setSort} />);
    fireEvent.keyDown(screen.getByRole("button", { name: labels.label }), { key: "Enter" });
    expect(await screen.findByRole("menuitemradio", { name: labels[choice.key] })).toHaveAttribute("aria-checked", "true");
    expect(screen.getAllByRole("menuitemradio").filter((option) => option.getAttribute("aria-checked") === "true")).toHaveLength(1);
  });

  it("allows keyboard selection", async () => {
    language.value = lang;
    const labels = dictionaries[lang].crmCustomerProfiles.ui.sort;
    const setSort = vi.fn();
    render(<CustomerSortMenu sort={defaultSort} setSort={setSort} />);

    fireEvent.keyDown(screen.getByRole("button", { name: labels.label }), { key: "Enter" });
    const oldest = await screen.findByRole("menuitemradio", { name: labels.oldestFirst });
    fireEvent.keyDown(oldest, { key: "Enter" });

    expect(setSort).toHaveBeenCalledWith({ id: "createdAt", direction: "asc" });
  });
});
