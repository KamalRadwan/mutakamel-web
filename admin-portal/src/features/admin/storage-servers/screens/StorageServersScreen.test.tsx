// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import type { NormalizedApiError } from "@/shared/api/normalized-api-error";

const { languageMock, hookMock } = vi.hoisted(() => ({
  languageMock: { lang: "ar" as "ar" | "en" },
  hookMock: vi.fn(),
}));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ ...languageMock, t: languageMock.lang === "ar" ? ar : en }),
  useOptionalI18n: () => languageMock,
}));
vi.mock("../hooks/useStorageServers", () => ({ useStorageServers: hookMock }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/storage-servers",
  useSearchParams: () => new URLSearchParams(),
}));

import { StorageServersScreen } from "./StorageServersScreen";

describe("storage server list error messages", () => {
  it.each(["ar", "en"] as const)("localizes unknown failures and keeps diagnostics (%s)", (lang) => {
    languageMock.lang = lang;
    const error: NormalizedApiError = {
      isNormalized: true, httpStatus: 500, errorCode: "FUTURE.STORAGE_FAILURE",
      message: "Private storage backend wording", correlationId: "019f1000-0000-7000-8000-000000000999",
    };
    hookMock.mockReturnValue({
      servers: [], page: 1, limit: 20, total: 0, totalPages: 0,
      search: "", status: "ALL", sortBy: "name", sortDir: "ASC",
      isLoading: false, isAuthLoading: false, canRead: true, canCreate: false, error,
      refresh: vi.fn(), setPage: vi.fn(), setSearch: vi.fn(), setStatus: vi.fn(),
      setSortBy: vi.fn(), setSortDir: vi.fn(),
    });
    render(<StorageServersScreen />);
    expect(screen.getByText((lang === "ar" ? ar : en).apiErrorMessages.generic)).toBeInTheDocument();
    expect(screen.getByText(error.errorCode)).toBeInTheDocument();
    expect(screen.getByText(error.correlationId!)).toBeInTheDocument();
    expect(screen.queryByText(error.message)).toBeNull();
  });
});
