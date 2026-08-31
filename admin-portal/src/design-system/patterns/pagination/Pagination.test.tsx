// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const i18n = vi.hoisted(() => ({ lang: "en" as "en" | "ar" }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: i18n.lang, dir: i18n.lang === "ar" ? "rtl" : "ltr" }),
}));

import { Pagination } from "./Pagination";

describe("Pagination", () => {
  it("stays mounted at a single page and exposes named controls", () => {
    render(
      <Pagination
        page={1}
        limit={20}
        totalItems={3}
        totalPages={1}
        onPageChange={vi.fn()}
        onLimitChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("navigation", { name: "Table pagination" })).toBeInTheDocument();
    expect(screen.getByText("Showing 1–3 of 3 · Page 1 of 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Rows per page" })).toHaveTextContent("20");
  });

  it("moves by one authoritative page without unmounting the controls", () => {
    const onPageChange = vi.fn();
    render(
      <Pagination
        page={2}
        limit={10}
        totalItems={35}
        totalPages={4}
        onPageChange={onPageChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(onPageChange).toHaveBeenNthCalledWith(1, 1);
    expect(onPageChange).toHaveBeenNthCalledWith(2, 3);
  });

  it("uses Arabic locale-default digits for visible pagination values", () => {
    i18n.lang = "ar";
    render(
      <Pagination
        page={2}
        limit={20}
        totalItems={35}
        totalPages={2}
        onPageChange={vi.fn()}
        onLimitChange={vi.fn()}
      />,
    );

    expect(screen.getByText("عرض ٢١–٣٥ من ٣٥ · الصفحة ٢ من ٢")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "عدد الصفوف في كل صفحة" })).toHaveTextContent("٢٠");
    i18n.lang = "en";
  });
});
