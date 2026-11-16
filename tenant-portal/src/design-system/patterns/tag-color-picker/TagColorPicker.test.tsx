// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { TagColorPicker } from "./TagColorPicker";

vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en", dir: "ltr" }) }));
afterEach(cleanup);

it("exposes matching native and draft validity for custom six-digit hex inputs", () => {
  const validity = vi.fn();
  render(<TagColorPicker value={{ backgroundColor: "#DBEAFE", textColor: "#1E40AF" }} onChange={vi.fn()} onValidityChange={validity} />);
  const background = screen.getByRole("textbox", { name: en.tagColors.background }) as HTMLInputElement;
  expect(background.checkValidity()).toBe(true);
  fireEvent.change(background, { target: { value: "#1D4" } });
  expect(background.checkValidity()).toBe(false);
  expect(background).toHaveAttribute("aria-invalid", "true");
  expect(validity).toHaveBeenLastCalledWith(false);
  fireEvent.change(background, { target: { value: "1d4ed8" } });
  expect(background.checkValidity()).toBe(true);
  expect(background).not.toHaveAttribute("aria-invalid");
  expect(validity).toHaveBeenLastCalledWith(true);
});
