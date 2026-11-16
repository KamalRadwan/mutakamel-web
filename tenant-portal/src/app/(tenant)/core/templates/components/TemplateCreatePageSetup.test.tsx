// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { I18nProvider } from "@/i18n/I18nContext";
import { setLanguage } from "@/i18n/useLanguage";
import { DEFAULT_TEMPLATE_PAGE, templateCreatePageCopy } from "../template-create-page";
import { TemplateCreatePageSetup } from "./TemplateCreatePageSetup";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function PrintControls() {
  const [values, setValues] = useState(DEFAULT_TEMPLATE_PAGE);
  return <TemplateCreatePageSetup
    disabled={false}
    outputChannel="PRINT"
    values={values}
    onChange={patch => setValues(previous => ({ ...previous, ...patch }))}
  />;
}

it("updates A4 printable area while typing and clears invalid output without moving focus", async () => {
  await setLanguage("en");
  const copy = templateCreatePageCopy.en;
  render(<I18nProvider initialLanguage="en"><PrintControls /></I18nProvider>);
  const status = screen.getByRole("status");
  expect(status).toHaveAttribute("aria-atomic", "true");
  expect(status).toHaveTextContent("Printable area 180 × 267 mm");
  for (const name of [copy.top, copy.end, copy.bottom, copy.start]) {
    fireEvent.change(screen.getByRole("textbox", { name }), { target: { value: "12" } });
  }
  expect(status).toHaveTextContent("Printable area 186 × 273 mm");

  const start = screen.getByRole("textbox", { name: copy.start });
  act(() => start.focus());
  fireEvent.change(start, { target: { value: "" } });
  expect(status).toBeEmptyDOMElement();
  expect(screen.getByRole("alert")).toHaveTextContent(copy.pageInvalid);
  expect(start).toHaveFocus();
  fireEvent.change(start, { target: { value: "12" } });
  expect(screen.queryByRole("alert")).toBeNull();
  expect(status).toHaveTextContent("186 × 273 mm");
});

it("localizes decimal dimensions in Arabic and keeps all geometry absent for Email", async () => {
  await setLanguage("ar");
  const values = { ...DEFAULT_TEMPLATE_PAGE, preset: "LETTER" as const, orientation: "LANDSCAPE" as const };
  const controls = (outputChannel: "PRINT" | "EMAIL") => (
    <I18nProvider initialLanguage="ar">
      <div dir="rtl">
        <TemplateCreatePageSetup disabled={false} outputChannel={outputChannel} values={values} onChange={() => {}} />
      </div>
    </I18nProvider>
  );
  const { rerender } = render(controls("PRINT"));
  const status = screen.getByRole("status");
  expect(status).toHaveTextContent("المساحة القابلة للطباعة 249.4 × 185.9 مم");
  expect(status.querySelector("bdi")).toHaveAttribute("dir", "ltr");
  rerender(controls("EMAIL"));
  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.queryByRole("combobox")).toBeNull();
  expect(screen.queryByRole("textbox")).toBeNull();
});
