// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, expect, it } from "vitest";
import { ar } from "./dictionaries/ar";
import { en } from "./dictionaries/en";
import { I18nProvider, useI18n } from "./I18nContext";
import { DirectionBridge } from "./DirectionBridge";
import { setLanguage, useDictionary, useDirection } from "./useLanguage";

afterEach(() => { cleanup(); localStorage.clear(); });

function Copy() {
  const { t, lang, dir } = useI18n();
  const dictionary = useDictionary();
  const direction = useDirection();
  return <p data-testid="copy" lang={lang} dir={dir} data-direction={direction}>
    {t.common.portalName} / {dictionary.common.portalName}
  </p>;
}

it("uses each request's snapshot during server rendering", () => {
  for (const [lang, dictionary, dir] of [["en", en, "ltr"], ["ar", ar, "rtl"]] as const) {
    const html = renderToString(<I18nProvider initialLanguage={lang}>
      <I18nProvider><Copy /></I18nProvider>
    </I18nProvider>);
    expect(html).toContain(dictionary.common.portalName);
    expect(html).toContain(`lang="${lang}"`);
    expect(html).toContain(`data-direction="${dir}"`);
  }
});

it("keeps nested providers, provider-free hooks and the document direction together", async () => {
  await setLanguage("ar");
  render(<I18nProvider initialLanguage="ar">
    <DirectionBridge><I18nProvider><Copy /></I18nProvider></DirectionBridge>
  </I18nProvider>);
  expect(screen.getByTestId("copy")).toHaveAttribute("dir", "rtl");
  await act(() => setLanguage("en"));
  expect(screen.getByTestId("copy")).toHaveTextContent(`${en.common.portalName} / ${en.common.portalName}`);
  expect(screen.getByTestId("copy")).toHaveAttribute("lang", "en");
  expect(screen.getByTestId("copy")).toHaveAttribute("data-direction", "ltr");
  expect(document.documentElement).toHaveAttribute("dir", "ltr");
  expect(document.documentElement).toHaveAttribute("lang", "en");
});
