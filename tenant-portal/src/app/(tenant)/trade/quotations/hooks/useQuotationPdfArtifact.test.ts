import { createHash, webcrypto } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { validateQuotationPdf, QUOTATION_PDF_MAX_BYTES } from "./useQuotationPdfArtifact";

describe("authorized quotation PDF binary boundary", () => {
  it("accepts only bounded PDF bytes with the expected MIME and signature", async () => {
    await expect(validateQuotationPdf(new Blob(["%PDF-1.7\nfixture"], { type: "application/pdf" }))).resolves.toBeUndefined();
    await expect(validateQuotationPdf(new Blob(["<html>error"], { type: "application/pdf" }))).rejects.toThrow("INVALID_PDF");
    await expect(validateQuotationPdf(new Blob(["%PDF-1.7"], { type: "text/html" }))).rejects.toThrow("INVALID_PDF");
    await expect(validateQuotationPdf(new Blob([], { type: "application/pdf" }))).rejects.toThrow("INVALID_PDF");
    await expect(validateQuotationPdf(new Blob([new Uint8Array(QUOTATION_PDF_MAX_BYTES + 1)], { type: "application/pdf" }))).rejects.toThrow("INVALID_PDF");
  });

  it.each([
    { context: "HTTPS", crypto: webcrypto },
    { context: "HTTP", crypto: { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) } },
  ])("checks the accepted artifact checksum over $context", async ({ crypto }) => {
    const pdf = "%PDF-1.7\nfixture";
    const blob = new Blob([pdf], { type: "application/pdf" });
    const expected = { sizeBytes: blob.size, checksum: createHash("sha256").update(pdf).digest("hex") };
    vi.stubGlobal("crypto", crypto);
    try {
      await expect(validateQuotationPdf(blob, expected)).resolves.toBeUndefined();
      await expect(validateQuotationPdf(new Blob([pdf.replace("fixture", "changed")], { type: "application/pdf" }), expected))
        .rejects.toThrow("INVALID_PDF");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
