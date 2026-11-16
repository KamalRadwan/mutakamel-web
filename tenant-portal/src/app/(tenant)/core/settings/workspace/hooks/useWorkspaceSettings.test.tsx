// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { coreGet, corePut } from "../../../core-api";
import { loadCurrencyOptions } from "../currency-options";
import {
  CURRENCY_NOT_ENABLED_CODE,
  LANGUAGE_INVALID_CODE,
  TIMEZONE_INVALID_CODE,
  WORKSPACE_SETTINGS_PATH,
  type WorkspaceSettings,
} from "../workspace-settings-contract";
import { useWorkspaceSettings } from "./useWorkspaceSettings";

const mocks = vi.hoisted(() => ({
  router: {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  },
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    outcomeFromApi: vi.fn(() => false),
    errorFromApi: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/core/settings/workspace",
  useRouter: () => mocks.router,
}));
vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({
    isLoading: false,
    realtimeAuthGeneration: 0,
    user: {
      id: "01900000-0000-7000-8000-000000000001",
      isTenantOwner: false,
      permissions: ["workspace.read", "workspace.manage", "currencies.currency.read"],
    },
  }),
}));
vi.mock("../../../core-api", () => ({ coreGet: vi.fn(), corePut: vi.fn() }));
vi.mock("../currency-options", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../currency-options")>();
  return {
    ...actual,
    loadCurrencyOptions: vi.fn(),
  };
});
vi.mock("@/design-system", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/design-system")>();
  return {
    ...actual,
    useCan: () => true,
    useToast: () => mocks.toast,
  };
});
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));

const baseline: WorkspaceSettings = {
  id: "01900000-0000-7000-8000-000000000001",
  defaultLanguage: "en",
  defaultCurrencyCode: "USD",
  timezone: "UTC",
  allowSupport: false,
  updatedAt: "2026-10-30T00:00:00.000Z",
};
const response = (data: unknown) => ({ data, headers: new Headers(), status: 200 });

beforeEach(() => {
  vi.mocked(coreGet).mockImplementation(async (path) =>
    response(path === WORKSPACE_SETTINGS_PATH ? baseline : {}),
  );
  vi.mocked(corePut).mockResolvedValue(response(baseline));
  vi.mocked(loadCurrencyOptions).mockResolvedValue({
    currencies: [{ code: "USD", name: "US Dollar" }],
    total: 1,
    isTruncated: false,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("workspace save baseline check", () => {
  it("overwrites only the user's edited fields and preserves unrelated concurrent changes", async () => {
    const { result } = renderHook(useWorkspaceSettings);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.updateDraft({ defaultLanguage: "ar" }));
    const server = { ...baseline, defaultLanguage: "fr", timezone: "Africa/Cairo", allowSupport: true };
    vi.mocked(coreGet).mockResolvedValue(response(server));
    await act(async () => { await result.current.save(); });
    expect(result.current.conflict?.editedFields).toEqual(["defaultLanguage"]);
    vi.mocked(corePut).mockResolvedValue(response({ ...server, defaultLanguage: "ar" }));
    await act(async () => { await result.current.overwriteConflict(); });
    expect(corePut).toHaveBeenCalledWith(WORKSPACE_SETTINGS_PATH, { defaultLanguage: "ar" }, expect.anything());
    expect(result.current.draft?.timezone).toBe("Africa/Cairo");
    expect(result.current.draft?.allowSupport).toBe(true);
  });

  it.each([
    { field: "defaultLanguage", mine: "ar", theirs: "fr" },
    { field: "defaultCurrencyCode", mine: "EGP", theirs: "EUR" },
    { field: "timezone", mine: "Africa/Cairo", theirs: "Asia/Riyadh" },
    { field: "allowSupport", mine: true, theirs: true },
  ] as const)("blocks a stale edited $field and keeps the draft", async ({ field, mine, theirs }) => {
    const { result } = renderHook(useWorkspaceSettings);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.updateDraft({ [field]: mine }));
    vi.mocked(coreGet).mockResolvedValue(
      response({ ...baseline, [field]: theirs, updatedAt: "2026-10-30T01:00:00.000Z" }),
    );
    await act(async () => {
      await result.current.save();
    });
    expect(corePut).not.toHaveBeenCalled();
    expect(mocks.toast.error).toHaveBeenCalledWith(
      en.tradeCommon.conflictTitle,
      en.tradeCommon.conflictDescription,
    );
    expect(result.current.draft?.[field]).toBe(mine);
    expect(result.current.conflict?.editedFields).toEqual([field]);
    expect(result.current.isSaving).toBe(false);
  });

  it("allows reloading or overwriting after a pre-PUT conflict", async () => {
    const { result } = renderHook(useWorkspaceSettings);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.updateDraft({ timezone: "Africa/Cairo" }));

    const serverState: WorkspaceSettings = {
      ...baseline,
      timezone: "Asia/Riyadh",
      updatedAt: "2026-10-30T02:00:00.000Z",
    };
    vi.mocked(coreGet).mockResolvedValue(response(serverState));

    await act(async () => {
      await result.current.save();
    });
    expect(result.current.conflict).not.toBeNull();

    const overwritten: WorkspaceSettings = {
      ...serverState,
      timezone: "Africa/Cairo",
      updatedAt: "2026-10-30T02:05:00.000Z",
    };
    vi.mocked(corePut).mockResolvedValue(response(overwritten));

    await act(async () => {
      await result.current.overwriteConflict();
    });
    expect(corePut).toHaveBeenCalledWith(
      WORKSPACE_SETTINGS_PATH,
      { timezone: "Africa/Cairo" },
      expect.any(Object),
    );
    expect(result.current.conflict).toBeNull();
    expect(result.current.settings?.timezone).toBe("Africa/Cairo");
  });

  it("discards unsaved draft edits back to committed singleton state", async () => {
    const { result } = renderHook(useWorkspaceSettings);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.updateDraft({ defaultLanguage: "ar", allowSupport: true }));
    expect(result.current.dirtyCount).toBe(2);
    expect(result.current.isDiscardOpen).toBe(false);

    act(() => result.current.discardDraft());
    expect(result.current.isDiscardOpen).toBe(true);
    expect(result.current.dirtyCount).toBe(2);
    expect(result.current.draft?.defaultLanguage).toBe("ar");
    expect(result.current.draft?.allowSupport).toBe(true);

    act(() => result.current.onDiscardOpenChange(false));
    expect(result.current.isDiscardOpen).toBe(false);
    expect(result.current.dirtyCount).toBe(2);
    expect(result.current.draft?.defaultLanguage).toBe("ar");
    expect(result.current.draft?.allowSupport).toBe(true);

    act(() => result.current.discardDraft());
    expect(result.current.isDiscardOpen).toBe(true);

    act(() => result.current.confirmDiscard());
    expect(result.current.isDiscardOpen).toBe(false);
    expect(result.current.dirtyCount).toBe(0);
    expect(result.current.draft?.defaultLanguage).toBe("en");
    expect(result.current.draft?.allowSupport).toBe(false);
  });

  it.each([
    { code: CURRENCY_NOT_ENABLED_CODE, field: "defaultCurrencyCode" },
    { code: TIMEZONE_INVALID_CODE, field: "timezone" },
    { code: LANGUAGE_INVALID_CODE, field: "defaultLanguage" },
  ] as const)("maps 422 $code to inline fieldError on $field", async ({ code, field }) => {
    const { result } = renderHook(useWorkspaceSettings);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.updateDraft({ timezone: "Africa/Cairo" }));
    vi.mocked(corePut).mockRejectedValue(
      new TenantApiClientError("Rejected", {
        status: 422,
        statusText: "Unprocessable Entity",
        data: { code, message: "Rejected" },
        headers: new Headers(),
      }),
    );

    await act(async () => {
      await result.current.save();
    });
    expect(result.current.fieldError?.field).toBe(field);
  });

  it.each([false, true])(
    "saves when edited fields are unchanged (unrelated change: %s)",
    async (unrelated) => {
      const { result } = renderHook(useWorkspaceSettings);
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      act(() => result.current.updateDraft({ timezone: "Africa/Cairo" }));
      vi.mocked(coreGet).mockResolvedValue(response({ ...baseline, allowSupport: unrelated }));
      await act(async () => {
        await result.current.save();
      });
      expect(corePut).toHaveBeenCalledWith(
        WORKSPACE_SETTINGS_PATH,
        { timezone: "Africa/Cairo" },
        expect.any(Object),
      );
      expect(mocks.toast.error).not.toHaveBeenCalled();
    },
  );

  it.each(["failure", "invalid"])("does not write on a fresh read %s", async (failure) => {
    const { result } = renderHook(useWorkspaceSettings);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.updateDraft({ timezone: "Africa/Cairo" }));
    if (failure === "failure") vi.mocked(coreGet).mockRejectedValue(new Error("Read failed"));
    else vi.mocked(coreGet).mockResolvedValue(response({}));
    await act(async () => {
      await result.current.save();
    });
    expect(corePut).not.toHaveBeenCalled();
    expect(result.current.isSaving).toBe(false);
  });
});
