// @vitest-environment jsdom

import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { normalizeApiError } from "@/lib/api/errors";
import { useAcquisitionSourceErrors } from "./useAcquisitionSourceErrors";

const state = vi.hoisted(() => ({ lang: "en" as "ar" | "en" }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: state.lang === "ar" ? ar : en, lang: state.lang }),
}));
afterEach(cleanup);

it.each(["ar", "en"] as const)("explains a generic multipart validation failure with its reference in %s", (lang) => {
  state.lang = lang;
  const dictionary = lang === "ar" ? ar : en;
  const correlationId = "01a1a78c-1a1f-7cad-9327-501dd251c4f7";
  const error = normalizeApiError(new TenantApiClientError("raw server prose", {
    status: 400, statusText: "Bad Request", headers: new Headers(),
    data: {
      success: false, statusCode: 400, errorCode: "CRM_VALIDATION_FAILED",
      errorCategory: "VALIDATION", message: "raw server prose", correlationId,
      timestamp: "2026-11-04T17:12:19.662Z",
      path: "/api/v1/crm/acquisition-sources/01a1a78a-a608-76da-b67b-e3195bce8f51/icon",
    },
  }));
  const { result } = renderHook(() => useAcquisitionSourceErrors());
  const message = result.current(error);
  expect(message).toContain(dictionary.crmShared.errorValidation);
  expect(message).toContain(correlationId);
  expect(message).not.toContain("raw server prose");
});
