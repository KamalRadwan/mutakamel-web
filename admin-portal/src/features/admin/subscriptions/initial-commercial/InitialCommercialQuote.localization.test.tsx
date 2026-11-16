// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { localeForLanguage } from "@/i18n/locale";
import { commercialPreviewFixture } from "@/features/admin/tenant-workspace/billing/model/subscription-commercial-fixtures";
import { CommercialPreviewEvidence } from "../commercial-change/CommercialChangeEvidence";
import { initialQuoteFixture } from "./initial-commercial.fixture";
import { initialCommercialCopy } from "./initial-commercial-copy";
import { InitialCommercialQuote } from "./InitialCommercialQuote";

const locale = vi.hoisted(() => ({ lang: "en" as "ar" | "en" }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => locale }));
afterEach(cleanup);

describe.each(["ar", "en"] as const)("quote expiry localization (%s)", lang => {
  it.each(["initial", "change"] as const)("formats the %s quote and preserves the machine timestamp", kind => {
    locale.lang = lang;
    const quote = initialQuoteFixture();
    const preview = commercialPreviewFixture();
    const expiresAt = kind === "initial" ? quote.expiresAt : preview.expiresAt;
    const { container } = render(kind === "initial"
      ? <InitialCommercialQuote quote={quote} expired={false} copy={initialCommercialCopy(lang)} />
      : <CommercialPreviewEvidence value={preview} lang={lang} expired={false} />);
    const time = container.querySelector("time");
    expect(time).toHaveAttribute("datetime", expiresAt);
    expect(time?.textContent).toBe(new Intl.DateTimeFormat(localeForLanguage(lang), {
      dateStyle: "medium", timeStyle: "short",
    }).format(new Date(expiresAt)));
    expect(time?.textContent).not.toBe(expiresAt);
  });
});
