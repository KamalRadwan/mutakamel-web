// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { InitialCommercialQuote } from "./initial-commercial/InitialCommercialQuote";
import { initialCommercialCopy } from "./initial-commercial/initial-commercial-copy";
import { initialQuoteFixture } from "./initial-commercial/initial-commercial.fixture";
import { CommercialPreviewEvidence } from "./commercial-change/CommercialChangeEvidence";
import { commercialPreviewFixture } from "../tenant-workspace/billing/model/subscription-commercial-fixtures";
import { localeForLanguage } from "@/i18n/locale";

const locale = vi.hoisted(() => ({ lang: "en" as "en" | "ar" }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => locale }));
afterEach(cleanup);

it.each(["en", "ar"] as const)("formats both quote expiries in %s while retaining ISO datetime", (lang) => {
  locale.lang = lang;
  const initial = initialQuoteFixture("INITIAL_SEED");
  const commercial = commercialPreviewFixture();
  const view = render(<>
    <InitialCommercialQuote quote={initial} expired={false} copy={initialCommercialCopy(lang)} />
    <CommercialPreviewEvidence value={commercial} lang={lang} expired={false} />
  </>);
  const times = view.container.querySelectorAll("time");
  expect(times).toHaveLength(2);
  [initial.expiresAt, commercial.expiresAt].forEach((iso, index) => {
    expect(times[index]).toHaveAttribute("dateTime", iso);
    expect(times[index]).toHaveTextContent(new Intl.DateTimeFormat(localeForLanguage(lang), {
      dateStyle: "medium", timeStyle: "short",
    }).format(new Date(iso)));
    expect(times[index].textContent).not.toBe(iso);
  });
});
