// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LANGUAGE_KEY } from "@/i18n/dictionary-store";
import { setLanguage } from "@/i18n/useLanguage";
import { safeStorage } from "@/lib/safeStorage";
import { Pagination, type PaginationProps } from "./Pagination";

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
if (typeof HTMLElement.prototype.hasPointerCapture === "undefined") {
  HTMLElement.prototype.hasPointerCapture = () => false;
}
if (typeof HTMLElement.prototype.setPointerCapture === "undefined") {
  HTMLElement.prototype.setPointerCapture = () => {};
}
if (typeof HTMLElement.prototype.releasePointerCapture === "undefined") {
  HTMLElement.prototype.releasePointerCapture = () => {};
}
if (typeof Element.prototype.scrollIntoView === "undefined") {
  Element.prototype.scrollIntoView = () => {};
}

beforeEach(async () => {
  await setLanguage("en");
});

afterEach(async () => {
  cleanup();
  safeStorage.removeItem(LANGUAGE_KEY);
  await setLanguage("ar");
});

const defaultLabels: PaginationProps["labels"] = {
  previous: "Previous page",
  next: "Next page",
  summary: (from, to, total) => `Showing ${from}-${to} of ${total}`,
};

describe("Pagination", () => {
  it("preserves default callers in English: First/Last, Previous/Next, pageWindow, and no page-size picker", () => {
    const onPageChange = vi.fn();
    render(
      <Pagination
        page={{ page: 8, limit: 20, total: 300 }}
        onPageChange={onPageChange}
        labels={defaultLabels}
      />,
    );

    expect(screen.getByText("Showing 141-160 of 300")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).toBeNull();

    expect(screen.getByRole("button", { name: "First page" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Page 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 5" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 8" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Page 11" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 15" })).toBeInTheDocument();
    expect(screen.getAllByText("…")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Next page" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Last page" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "First page" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    fireEvent.click(screen.getByRole("button", { name: "Page 9" }));
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    fireEvent.click(screen.getByRole("button", { name: "Last page" }));

    expect(onPageChange.mock.calls).toEqual([[1], [7], [9], [9], [15]]);
  });

  it("preserves default callers in Arabic with localized dictionary boundary and page labels", async () => {
    await act(async () => {
      await setLanguage("ar");
    });

    render(
      <Pagination
        page={{ page: 1, limit: 20, total: 60 }}
        onPageChange={vi.fn()}
        labels={{
          previous: "الصفحة السابقة",
          next: "الصفحة التالية",
          summary: (from, to, total) => `عرض ${from}-${to} من ${total}`,
        }}
      />,
    );

    expect(screen.getByText("عرض 1-20 من 60")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByRole("button", { name: "الصفحة الأولى" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "الصفحة السابقة" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "صفحة 1" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "صفحة 2" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "صفحة 3" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "الصفحة التالية" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "الصفحة الأخيرة" })).toBeEnabled();
  });

  it("omits the rows-per-page picker when options, callback, or accessible label are missing or invalid", () => {
    const { rerender } = render(
      <Pagination
        page={{ page: 1, limit: 20, total: 40 }}
        onPageChange={vi.fn()}
        pageSizeOptions={[20, 50, 100]}
        labels={defaultLabels}
      />,
    );
    expect(screen.queryByRole("combobox")).toBeNull();

    rerender(
      <Pagination
        page={{ page: 1, limit: 20, total: 40 }}
        onPageChange={vi.fn()}
        pageSizeOptions={[]}
        onPageSizeChange={vi.fn()}
        labels={defaultLabels}
      />,
    );
    expect(screen.queryByRole("combobox")).toBeNull();

    rerender(
      <Pagination
        page={{ page: 1, limit: 20, total: 40 }}
        onPageChange={vi.fn()}
        pageSizeOptions={[0, -20, Number.NaN]}
        onPageSizeChange={vi.fn()}
        labels={defaultLabels}
      />,
    );
    expect(screen.queryByRole("combobox")).toBeNull();

    rerender(
      <Pagination
        page={{ page: 1, limit: 20, total: 40 }}
        onPageChange={vi.fn()}
        pageSizeOptions={[20, 50, 100]}
        onPageSizeChange={vi.fn()}
        labels={{ ...defaultLabels, rowsPerPage: "   " }}
      />,
    );
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("omits First/Last only when hideFirstLast is true while keeping Previous/Next and pageWindow intact", () => {
    const onPageChange = vi.fn();
    const { rerender } = render(
      <Pagination
        page={{ page: 2, limit: 20, total: 60 }}
        onPageChange={onPageChange}
        pageSizeOptions={[20, 50, 100]}
        onPageSizeChange={vi.fn()}
        labels={defaultLabels}
      />,
    );

    expect(screen.getByRole("combobox", { name: "Rows per page" })).toHaveTextContent("20");
    expect(screen.getByRole("button", { name: "First page" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Last page" })).toBeInTheDocument();

    rerender(
      <Pagination
        page={{ page: 2, limit: 20, total: 60 }}
        onPageChange={onPageChange}
        pageSizeOptions={[20, 50, 100]}
        onPageSizeChange={vi.fn()}
        hideFirstLast
        labels={{ ...defaultLabels, rowsPerPage: "Rows per page" }}
      />,
    );

    expect(screen.queryByRole("button", { name: "First page" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Last page" })).toBeNull();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Page 1" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Page 3" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Next page" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(onPageChange.mock.calls).toEqual([[1], [3]]);
  });

  it("emits a supported new page size once and ignores unchanged or unsupported options", () => {
    const onPageSizeChange = vi.fn();
    render(
      <Pagination
        page={{ page: 1, limit: 20, total: 120 }}
        onPageChange={vi.fn()}
        pageSizeOptions={[20, 50, 50, 100, -10, 0]}
        onPageSizeChange={onPageSizeChange}
        hideFirstLast
        labels={{ ...defaultLabels, rowsPerPage: "Rows per page" }}
      />,
    );

    const trigger = screen.getByRole("combobox", { name: "Rows per page" });
    expect(screen.getByLabelText("Rows per page")).toBe(trigger);

    fireEvent.click(trigger);
    const listbox = screen.getByRole("listbox");
    const options = within(listbox).getAllByRole("option");
    expect(options.map((opt) => opt.textContent)).toEqual(["20", "50", "100"]);

    // Selecting the already-active size 20 must not emit.
    fireEvent.click(within(listbox).getByRole("option", { name: "20" }));
    expect(onPageSizeChange).not.toHaveBeenCalled();

    // Selecting a supported changed size emits once as a number.
    fireEvent.click(trigger);
    fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "50" }));
    expect(onPageSizeChange).toHaveBeenCalledTimes(1);
    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });

  it("supports keyboard opening, arrow navigation, Enter selection, Escape dismissal, and focus return in Arabic RTL", async () => {
    await act(async () => {
      await setLanguage("ar");
    });

    const onPageSizeChange = vi.fn();
    render(
      <Pagination
        page={{ page: 1, limit: 20, total: 95 }}
        onPageChange={vi.fn()}
        pageSizeOptions={[20, 50, 100]}
        onPageSizeChange={onPageSizeChange}
        hideFirstLast
        labels={{
          previous: "السابق",
          next: "التالي",
          summary: (from, to, total) => `${from}-${to} من ${total}`,
        }}
      />,
    );

    const trigger = screen.getByRole("combobox", { name: "صفوف لكل صفحة" });
    expect(trigger).toHaveAttribute("dir", "rtl");
    expect(trigger).toHaveTextContent("20");
    expect(screen.queryByRole("button", { name: "الصفحة الأولى" })).toBeNull();
    expect(screen.queryByRole("button", { name: "الصفحة الأخيرة" })).toBeNull();

    // Open with keyboard ArrowDown, wait for listbox option focus, then dismiss with Escape.
    trigger.focus();
    expect(trigger).toHaveFocus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const listboxOnEscape = await screen.findByRole("listbox");
    expect(listboxOnEscape).toHaveAttribute("dir", "rtl");
    const escapeOption20 = within(listboxOnEscape).getByRole("option", { name: "20" });
    await waitFor(() => expect(escapeOption20).toHaveFocus());

    fireEvent.keyDown(escapeOption20, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    expect(onPageSizeChange).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();

    // Reopen via keyboard Enter, move down to 50, confirm with Enter: emits 50 once and restores focus.
    fireEvent.keyDown(trigger, { key: "Enter" });
    const activeOption20 = within(await screen.findByRole("listbox")).getByRole("option", { name: "20" });
    await waitFor(() => expect(activeOption20).toHaveFocus());

    fireEvent.keyDown(activeOption20, { key: "ArrowDown" });
    const activeOption50 = within(screen.getByRole("listbox")).getByRole("option", { name: "50" });
    await waitFor(() => expect(activeOption50).toHaveFocus());

    fireEvent.keyDown(activeOption50, { key: "Enter" });
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    expect(onPageSizeChange).toHaveBeenCalledTimes(1);
    expect(onPageSizeChange).toHaveBeenCalledWith(50);
    expect(trigger).toHaveFocus();
  });
});
