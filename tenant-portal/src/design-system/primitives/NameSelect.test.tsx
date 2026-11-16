// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { NameSelect } from "./NameSelect";

const state = vi.hoisted(() => ({ lang: "en" as "en" | "ar" }));
const dictionaries = { en, ar };
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: dictionaries[state.lang], lang: state.lang, dir: state.lang === "ar" ? "rtl" : "ltr" }) }));
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
Element.prototype.scrollIntoView ??= () => {};
afterEach(() => { cleanup(); state.lang = "en"; });
const options = [
  { value: "01900100-0000-7000-8000-000000000001", label: "Cairo", description: "CAI" },
  { value: "01900100-0000-7000-8000-000000000002", label: "Alexandria" },
  { value: "01900100-0000-7000-8000-000000000003", label: "Giza" },
  { value: "01900100-0000-7000-8000-000000000004", label: "Aswan" },
];

describe("name-only scope picker", () => {
  it.each(["en", "ar"] as const)("renders compact names and preserves exact IDs on selection in %s", async (lang) => {
    state.lang = lang;
    const onValueChange = vi.fn();
    const { container } = render(<NameSelect value={options[0].value} options={options.slice(0, 2)}
      onValueChange={onValueChange} placeholder="Choose scope" aria-label="Scope" />);
    const trigger = screen.getByRole("combobox", { name: "Scope" });
    expect(trigger).toHaveTextContent("Cairo");
    expect(trigger).toHaveClass("font-sans", "font-normal", "text-caption");
    expect(trigger).toHaveAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: "Alexandria" }));
    expect(onValueChange).toHaveBeenCalledWith(options[1].value);
    expect(container.textContent).not.toContain(options[0].value);
    expect(screen.queryByText("CAI")).not.toBeInTheDocument();
  });

  it("searches long lists by name and keeps the selected label while searching", async () => {
    const onValueChange = vi.fn();
    render(<NameSelect value={options[0].value} options={options} onValueChange={onValueChange}
      placeholder="Choose scope" aria-label="Scope" searchPlaceholder="Find scope" />);
    const trigger = screen.getByRole("button", { name: "Scope" });
    fireEvent.click(trigger);
    fireEvent.change(screen.getByRole("combobox", { name: "Find scope" }), { target: { value: "asw" } });
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(1));
    expect(trigger).toHaveTextContent("Cairo");
    const aswan = screen.getByRole("option", { name: "Aswan" });
    expect(aswan).toHaveClass("font-sans", "font-normal", "text-caption");
    fireEvent.click(aswan);
    expect(onValueChange).toHaveBeenCalledWith(options[3].value);
  });

  it.each([2, 4])("never exposes an unresolved ID with %s options", (count) => {
    const missing = "01900100-0000-7000-8000-000000000099";
    const { container } = render(<NameSelect value={missing} options={options.slice(0, count)}
      onValueChange={vi.fn()} placeholder="Choose scope" />);
    expect(container).toHaveTextContent(en.common.nameUnavailable);
    expect(container.textContent).not.toContain(missing);
  });
});
