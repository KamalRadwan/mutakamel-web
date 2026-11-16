// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/design-system";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import {
  buildQuotationEmailHref,
  buildQuotationTelegramHref,
  buildQuotationWhatsAppHref,
  normalizeWhatsAppDigits,
  type QuotationShareContext,
} from "./quotation-share-links";
import { QuotationShareButtons } from "./components/QuotationShareButtons";

vi.mock("@/i18n/I18nContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/i18n/I18nContext")>()),
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const sampleContext: QuotationShareContext = {
  reference: "QT-2026-0042",
  customerName: "Al-Mutahida Group",
  currencyCode: "EGP",
  grandTotal: "148500.00",
  recipientEmail: "procurement@mutahida.eg",
  recipientPhone: "+20 (100) 555-8899",
  subjectTemplate: en.tradeDocuments.quotations.shareSubjectTemplate,
  bodyTemplate: en.tradeDocuments.quotations.shareSummaryTemplate,
};

describe("quotation-share-links builders", () => {
  it("normalizes international phone numbers to clean digits for wa.me", () => {
    expect(normalizeWhatsAppDigits("+20 (100) 555-8899")).toBe("201005558899");
    expect(normalizeWhatsAppDigits("00966 50 123 4567")).toBe("966501234567");
    expect(normalizeWhatsAppDigits(null)).toBe("");
  });

  it("constructs RFC-encoded mailto, WhatsApp, and Telegram share links", () => {
    const emailHref = buildQuotationEmailHref(sampleContext);
    expect(emailHref.startsWith("mailto:procurement%40mutahida.eg?subject=")).toBe(true);
    expect(decodeURIComponent(emailHref)).toContain("QT-2026-0042");
    expect(decodeURIComponent(emailHref)).toContain("148500.00");

    const waHref = buildQuotationWhatsAppHref(sampleContext);
    expect(waHref.startsWith("https://wa.me/201005558899?text=")).toBe(true);
    expect(decodeURIComponent(waHref)).toContain(sampleContext.grandTotal);

    const tgHref = buildQuotationTelegramHref(sampleContext);
    expect(tgHref.startsWith("https://t.me/share/url?url=")).toBe(true);
    expect(new URL(tgHref).searchParams.get("url")).toBe("");
    expect(decodeURIComponent(tgHref)).toContain(sampleContext.grandTotal);
  });

  it.each([en, ar])("shares only the localized summary, ignoring stale URL data", (dictionary) => {
    for (const targetUrl of [
      "https://storage.example/private.pdf?X-Amz-Signature=secret&X-Amz-Expires=300",
      "https://mersany.mutakamel.ai/trade/quotations/private-id",
    ]) {
      const context = {
        ...sampleContext,
        targetUrl,
        subjectTemplate: dictionary.tradeDocuments.quotations.shareSubjectTemplate,
        bodyTemplate: dictionary.tradeDocuments.quotations.shareSummaryTemplate,
      };
      for (const build of [
        buildQuotationEmailHref,
        buildQuotationWhatsAppHref,
        buildQuotationTelegramHref,
      ]) {
        const href = new URL(build(context));
        const summary = href.searchParams.get("body") ?? href.searchParams.get("text");
        expect(summary).toContain(context.reference);
        expect(summary).toContain(context.customerName);
        expect(summary).toContain(`${context.currencyCode} ${context.grandTotal}`);
        const decoded = decodeURIComponent(href.href);
        expect(decoded).not.toContain(targetUrl);
        expect(decoded).not.toContain("/trade/");
        expect(decoded).not.toContain("X-Amz-");
        expect(decoded).not.toContain("{url}");
      }
    }
  });
});

describe("QuotationShareButtons icons-only rendering", () => {
  it("renders Email, WhatsApp, and Telegram strictly as icon-only buttons with aria-labels and zero visible text", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    render(
      <TooltipProvider>
        <QuotationShareButtons
          quotation={{
            id: "01890000-0000-7000-8000-000000000042",
            documentNumber: "QT-2026-0042",
            draftReference: "RFQ-42",
            currencyCode: "EGP",
            grandTotal: "148500.00",
            partySnapshot: {
              displayName: "Al-Mutahida Group",
              email: "procurement@mutahida.eg",
              phone: "+201005558899",
            },
          }}
        />
      </TooltipProvider>,
    );

    const emailBtn = screen.getByRole("button", { name: "Send to Email" });
    const whatsappBtn = screen.getByRole("button", { name: "Send to WhatsApp" });
    const telegramBtn = screen.getByRole("button", { name: "Send to Telegram" });

    expect(emailBtn).toBeTruthy();
    expect(whatsappBtn).toBeTruthy();
    expect(telegramBtn).toBeTruthy();

    // Mandate: icons-only — zero visible text labels inside any channel button.
    expect(emailBtn.textContent?.trim()).toBe("");
    expect(whatsappBtn.textContent?.trim()).toBe("");
    expect(telegramBtn.textContent?.trim()).toBe("");

    fireEvent.click(whatsappBtn);
    fireEvent.click(telegramBtn);
    expect(open).toHaveBeenCalledTimes(2);
    for (const [href, target, features] of open.mock.calls) {
      const decoded = decodeURIComponent(String(href));
      expect(decoded).toContain("QT-2026-0042");
      expect(decoded).toContain("148500.00");
      expect(decoded).not.toContain("/trade/");
      expect(target).toBe("_blank");
      expect(features).toBe("noopener,noreferrer");
    }
  });
});
