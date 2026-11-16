// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/design-system";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { readCorePage } from "@/lib/api/envelope";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { coreGet, corePut, type CoreResult } from "../../core-api";
import { CURRENCY_OPTIONS_PATH } from "./currency-options";
import WorkspaceSettingsPage from "./page";
import {
  TENANT_NOT_READY_CODE,
  TIMEZONE_INVALID_CODE,
  WORKSPACE_SETTINGS_PATH,
} from "./workspace-settings-contract";

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

const { routerMock, toastMock, state } = vi.hoisted(() => ({
  routerMock: {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  },
  toastMock: {
    success: vi.fn(),
    error: vi.fn(),
    outcomeFromApi: vi.fn(() => false),
    errorFromApi: vi.fn(),
  },
  state: {
    lang: "en" as "en" | "ar",
    permissions: [
      "workspace.read",
      "workspace.manage",
      "currencies.currency.read",
      "audit.read",
    ] as string[],
    tenantWideManage: true,
    currencies: [
      { code: "EGP", name: "Egyptian Pound", symbol: "E£", decimalPlaces: 2 },
      { code: "USD", name: "US Dollar", symbol: "$", decimalPlaces: 2 },
    ] as Array<{ code: string; name: string; symbol?: string; decimalPlaces?: number }>,
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/core/settings/workspace",
  useRouter: () => routerMock,
}));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: { en, ar }[state.lang], lang: state.lang }),
}));
vi.mock("@/i18n/useLanguage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/i18n/useLanguage")>();
  return {
    ...actual,
    useDictionary: () => ({ en, ar }[state.lang]),
    useLanguage: () => state.lang,
    useDirection: () => (state.lang === "ar" ? "rtl" : "ltr"),
  };
});
vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({
    isLoading: false,
    realtimeAuthGeneration: 0,
    user: {
      id: "01900000-0000-7000-8000-000000000001",
      isTenantOwner: false,
      permissions: state.permissions,
      permissionScopes: Object.fromEntries(
        state.permissions.map((perm) => [
          perm,
          {
            tenantWide: perm === "workspace.manage" ? state.tenantWideManage : true,
            companyIds: state.tenantWideManage ? [] : ["01900000-0000-7000-8000-000000000050"],
            branchIds: [],
          },
        ]),
      ),
    },
  }),
}));
vi.mock("@/design-system", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/design-system")>();
  return {
    ...actual,
    useToast: () => toastMock,
  };
});
vi.mock("../../core-api", () => ({
  coreGet: vi.fn(),
  corePut: vi.fn(),
}));
vi.mock("@/lib/api/envelope", () => ({
  readCorePage: vi.fn(),
}));
vi.mock("./hooks/useTimezoneOptions", () => ({
  useTimezoneOptions: () => ({ hasZones: false, options: [], onSearch: vi.fn() }),
}));

const BASELINE = {
  id: "018f0000-0000-7000-8000-000000000015",
  defaultLanguage: "en",
  defaultCurrencyCode: "EGP",
  timezone: "Africa/Cairo",
  allowSupport: true,
  updatedAt: "2026-10-30T10:00:00.000Z",
};

const AUDIT_PAGE = {
  items: [
    {
      id: "01902001-3000-7000-8000-000000000777",
      action: "UPDATE",
      actorLabel: "Kamal Admin",
      createdAt: "2026-10-30T10:00:00.000Z",
      outcome: "SUCCESS",
      diff: [
        { field: "defaultLanguage", before: "en", after: "ar" },
        { field: "timezone", before: "UTC", after: "Africa/Cairo" },
      ],
    },
  ],
  nextCursor: null,
};

function makeCode(index: number): string {
  const a = String.fromCharCode(65 + Math.floor(index / 676));
  const b = String.fromCharCode(65 + (Math.floor(index / 26) % 26));
  const c = String.fromCharCode(65 + (index % 26));
  return `${a}${b}${c}`;
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function buildCurrencyEnvelope(items = state.currencies) {
  return {
    data: items,
    meta: {
      page: 1,
      limit: 100,
      total: items.length,
      totalPages: items.length === 0 ? 0 : 1,
      hasNext: false,
      hasPrev: false,
    },
  };
}

beforeEach(() => {
  state.lang = "en";
  state.permissions = [
    "workspace.read",
    "workspace.manage",
    "currencies.currency.read",
    "audit.read",
  ];
  state.tenantWideManage = true;
  state.currencies = [
    { code: "EGP", name: "Egyptian Pound", symbol: "E£", decimalPlaces: 2 },
    { code: "USD", name: "US Dollar", symbol: "$", decimalPlaces: 2 },
  ];

  vi.mocked(coreGet).mockImplementation(async (path) => {
    if (path === WORKSPACE_SETTINGS_PATH) {
      return { data: BASELINE, headers: new Headers(), status: 200 };
    }
    return { data: {}, headers: new Headers(), status: 200 };
  });

  vi.mocked(readCorePage).mockImplementation(async (path) => {
    if (path === CURRENCY_OPTIONS_PATH) {
      return buildCurrencyEnvelope();
    }
    if (path.startsWith("/api/tenant/core/v1/audit/entities/")) {
      return { data: AUDIT_PAGE, meta: undefined };
    }
    return { data: [], meta: undefined };
  });

  vi.mocked(corePut).mockImplementation(async (_path, body) => ({
    data: {
      ...BASELINE,
      ...(body as Record<string, unknown>),
      updatedAt: "2026-10-30T11:00:00.000Z",
    },
    headers: new Headers(),
    status: 200,
  }));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe.each(["en", "ar"] as const)("WorkspaceSettingsPage in %s", (language) => {
  it("renders three clean sections using W08 section keys without developer clutter and writes delta-only PUT payloads", async () => {
    state.lang = language;
    const t = { en, ar }[language];

    render(
      <TooltipProvider>
        <WorkspaceSettingsPage />
      </TooltipProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: t.coreSettings.workspaceRegionalTitle }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: t.coreSettings.workspaceCurrencySectionTitle }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: t.coreSettings.workspaceSupportSectionTitle }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect((screen.getByRole("combobox").textContent ?? "").trim()).toBe(
        "Egyptian Pound (EGP · E£)",
      );
    });

    expect(screen.queryByText(t.nav.coreTaxes)).not.toBeInTheDocument();
    expect(screen.queryByText(BASELINE.id)).not.toBeInTheDocument();
    expect(screen.queryByText(/UpdateWorkspaceSettingsDto/i)).not.toBeInTheDocument();
    expect(screen.queryByText("defaultLanguage")).not.toBeInTheDocument();
    expect(screen.queryByText("defaultCurrencyCode")).not.toBeInTheDocument();
    expect(screen.queryByText(/allowSupport/)).not.toBeInTheDocument();
    expect(screen.queryByText("workspace.manage")).not.toBeInTheDocument();
    expect(screen.queryByText("workspace.read")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: t.coreSettings.languageNames.ar }));

    const saveButton = screen.getByRole("button", {
      name: t.coreSettings.workspaceUi.saveWithCount.replace("{count}", "1"),
    });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(corePut).toHaveBeenCalledWith(
        WORKSPACE_SETTINGS_PATH,
        { defaultLanguage: "ar" },
        expect.any(Object),
      );
    });
    expect(screen.queryByText(t.common.discardTitle)).not.toBeInTheDocument();
    expect(toastMock.success).toHaveBeenCalledWith(
      t.coreSettings.savedTitle,
      t.coreSettings.workspaceSavedMessage,
    );
  });

  it("treats authoritative load HTTP 403 as PermissionGate denied with suppressForbiddenToast and no futile retry", async () => {
    state.lang = language;
    const t = { en, ar }[language];

    vi.mocked(coreGet).mockRejectedValueOnce(
      new TenantApiClientError("Forbidden", {
        status: 403,
        statusText: "Forbidden",
        data: { code: "FORBIDDEN", message: "Forbidden" },
        headers: new Headers(),
      }),
    );

    render(
      <TooltipProvider>
        <WorkspaceSettingsPage />
      </TooltipProvider>,
    );

    expect(await screen.findByText(t.permissionGate.title)).toBeInTheDocument();
    expect(screen.getByText(t.permissionGate.description)).toBeInTheDocument();
    expect(screen.queryByText(t.coreSettings.workspaceLoadFailed)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t.common.retry })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t.coreSettings.reload })).not.toBeInTheDocument();
    expect(coreGet).toHaveBeenCalledWith(
      WORKSPACE_SETTINGS_PATH,
      expect.objectContaining({ suppressForbiddenToast: true }),
    );
    expect(toastMock.error).not.toHaveBeenCalled();
    expect(toastMock.errorFromApi).not.toHaveBeenCalled();
  });

  it("distinguishes malformed HTTP 200 responses from status 0 offline errors on workspace and currency reads", async () => {
    state.lang = language;
    const t = { en, ar }[language];

    // 1. Malformed HTTP 200 on workspace singleton load -> honest unreadable-response message, NOT OFFLINE.
    vi.mocked(coreGet).mockResolvedValueOnce({
      data: { id: "not-a-uuid" },
      headers: new Headers(),
      status: 200,
    });

    const { unmount } = render(
      <TooltipProvider>
        <WorkspaceSettingsPage />
      </TooltipProvider>,
    );

    expect(await screen.findByText(t.coreSettings.workspaceLoadFailed)).toBeInTheDocument();
    expect(screen.getByText(t.coreSettings.invalidResponseDescription)).toBeInTheDocument();
    expect(screen.queryByText(t.coreIdentity.errors.OFFLINE)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.common.retry })).toBeInTheDocument();
    unmount();

    // 2. Genuine network failure (status 0) -> OFFLINE, NOT invalidResponseDescription.
    vi.clearAllMocks();
    vi.mocked(coreGet).mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const secondRender = render(
      <TooltipProvider>
        <WorkspaceSettingsPage />
      </TooltipProvider>,
    );

    expect(await screen.findByText(t.coreSettings.workspaceLoadFailed)).toBeInTheDocument();
    expect(screen.getByText(t.coreIdentity.errors.OFFLINE)).toBeInTheDocument();
    expect(screen.queryByText(t.coreSettings.invalidResponseDescription)).not.toBeInTheDocument();
    secondRender.unmount();

    // 3. Cross-page duplicate overlap after HTTP 200 on currency options -> invalidResponseDescription + manual fallback.
    vi.clearAllMocks();
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      code: makeCode(index),
      name: `Currency ${index}`,
    }));
    vi.mocked(readCorePage)
      .mockResolvedValueOnce({
        data: firstPage,
        meta: {
          page: 1,
          limit: 100,
          total: 101,
          totalPages: 2,
          hasNext: true,
          hasPrev: false,
        },
      })
      .mockResolvedValueOnce({
        data: [{ code: makeCode(0), name: "Duplicate Currency 0" }],
        meta: {
          page: 2,
          limit: 100,
          total: 101,
          totalPages: 2,
          hasNext: false,
          hasPrev: true,
        },
      });

    render(
      <TooltipProvider>
        <WorkspaceSettingsPage />
      </TooltipProvider>,
    );

    expect(await screen.findByText(t.coreSettings.currencyLoadFailed)).toBeInTheDocument();
    expect(screen.getByText(t.coreSettings.invalidResponseDescription)).toBeInTheDocument();
    expect(screen.queryByText(t.coreIdentity.errors.OFFLINE)).not.toBeInTheDocument();
    expect(screen.getByText(t.coreSettings.workspaceCurrencyManualHint)).toBeInTheDocument();
    expect(screen.getByDisplayValue("EGP")).toBeInTheDocument();
  });

  it("surfaces currency choice load failures with W08 copy and retries via canonical { data, meta }", async () => {
    state.lang = language;
    const t = { en, ar }[language];
    let currencyCalls = 0;

    vi.mocked(readCorePage).mockImplementation(async (path) => {
      if (path === CURRENCY_OPTIONS_PATH) {
        currencyCalls += 1;
        if (currencyCalls === 1) {
          throw new TenantApiClientError("Currencies unavailable", {
            status: 502,
            statusText: "Bad Gateway",
            data: { message: "Currencies unavailable" },
            headers: new Headers(),
          });
        }
        return buildCurrencyEnvelope();
      }
      return { data: [], meta: undefined };
    });

    render(
      <TooltipProvider>
        <WorkspaceSettingsPage />
      </TooltipProvider>,
    );

    expect(await screen.findByText(t.coreSettings.currencyLoadFailed)).toBeInTheDocument();
    expect(
      screen.getByText(t.coreSettings.currencyOptionsLoadFailedDescription),
    ).toBeInTheDocument();
    expect(screen.getByText(t.coreSettings.workspaceCurrencyManualHint)).toBeInTheDocument();
    expect(screen.getByDisplayValue("EGP")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: t.common.retry }));

    await waitFor(() => {
      expect(screen.queryByText(t.coreSettings.currencyLoadFailed)).not.toBeInTheDocument();
    });
    expect(currencyCalls).toBe(2);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("renders DegradedBanner when currency choices hit the 500-item cap with hasNext and keeps saved currency usable", async () => {
    state.lang = language;
    const t = { en, ar }[language];

    vi.mocked(coreGet).mockResolvedValue({
      data: { ...BASELINE, defaultCurrencyCode: "ZZZ" },
      headers: new Headers(),
      status: 200,
    });

    vi.mocked(readCorePage).mockImplementation(async (path, query) => {
      if (path === CURRENCY_OPTIONS_PATH) {
        const page = Number(new URLSearchParams(query).get("page"));
        const offset = (page - 1) * 100;
        return {
          data: Array.from({ length: 100 }, (_, index) => ({
            code: makeCode(offset + index),
            name: `Currency ${offset + index}`,
          })),
          meta: {
            page,
            limit: 100,
            total: 620,
            totalPages: 7,
            hasNext: page < 7,
            hasPrev: page > 1,
          },
        };
      }
      return { data: [], meta: undefined };
    });

    render(
      <TooltipProvider>
        <WorkspaceSettingsPage />
      </TooltipProvider>,
    );

    const expectedRange = formatTemplate(t.common.showingOf, {
      from: formatNumber(1, language),
      to: formatNumber(500, language),
      total: formatNumber(620, language),
    });
    const expectedNotice = `${t.coreSettings.currenciesTitle}: ${expectedRange}`;

    expect(await screen.findByText(expectedNotice)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(expectedNotice);
    expect((screen.getByRole("combobox").textContent ?? "").trim()).toBe("ZZZ");
    expect(readCorePage).toHaveBeenCalledTimes(5);
  });

  it("deduplicates select labels when backend currency name or symbol repeats the ISO code", async () => {
    state.lang = language;
    state.currencies = [
      { code: "EGP", name: "EGP", symbol: "EGP", decimalPlaces: 2 },
      { code: "SAR", name: "Saudi Riyal", symbol: "SAR", decimalPlaces: 2 },
    ];
    const t = { en, ar }[language];

    const { unmount } = render(
      <TooltipProvider>
        <WorkspaceSettingsPage />
      </TooltipProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: t.coreSettings.workspaceCurrencySectionTitle }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect((screen.getByRole("combobox").textContent ?? "").trim()).toBe("EGP");
    });
    expect(screen.queryByText(/EGP — EGP/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\(EGP\)/)).not.toBeInTheDocument();
    unmount();

    vi.mocked(coreGet).mockResolvedValue({
      data: { ...BASELINE, defaultCurrencyCode: "SAR" },
      headers: new Headers(),
      status: 200,
    });

    render(
      <TooltipProvider>
        <WorkspaceSettingsPage />
      </TooltipProvider>,
    );

    await waitFor(() => {
      expect((screen.getByRole("combobox").textContent ?? "").trim()).toBe("Saudi Riyal (SAR)");
    });
  });

  it("supports manual 3-char currency fallback without currency read permission and enforces read-only mode", async () => {
    state.lang = language;
    state.permissions = ["workspace.read", "workspace.manage"];
    const t = { en, ar }[language];

    const { unmount } = render(
      <TooltipProvider>
        <WorkspaceSettingsPage />
      </TooltipProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: t.coreSettings.workspaceRegionalTitle }),
    ).toBeInTheDocument();
    expect(screen.getByText(t.coreSettings.workspaceCurrencyManualHint)).toBeInTheDocument();
    const editableInput = screen.getByDisplayValue("EGP");
    expect(editableInput).not.toHaveAttribute("readonly");
    expect(readCorePage).not.toHaveBeenCalledWith(
      CURRENCY_OPTIONS_PATH,
      expect.anything(),
      expect.anything(),
    );
    unmount();

    vi.clearAllMocks();
    state.permissions = ["workspace.read"];

    render(
      <TooltipProvider>
        <WorkspaceSettingsPage />
      </TooltipProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: t.coreSettings.workspaceRegionalTitle }),
    ).toBeInTheDocument();
    expect(screen.getByText(t.common.readOnly)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t.coreSettings.save })).not.toBeInTheDocument();
    expect(screen.queryByText(t.coreSettings.currencyLoadFailed)).not.toBeInTheDocument();
    expect(
      screen.queryByText(t.coreSettings.workspaceUi.manageCurrenciesCta),
    ).not.toBeInTheDocument();

    const currencyInput = screen.getByDisplayValue("EGP");
    expect(currencyInput).toHaveAttribute("readonly");
  });

  it("hides audit history without permission and loads human-readable history only on demand", async () => {
    state.lang = language;
    state.permissions = ["workspace.read", "workspace.manage", "currencies.currency.read"];
    const t = { en, ar }[language];

    const { unmount } = render(
      <TooltipProvider>
        <WorkspaceSettingsPage />
      </TooltipProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: t.coreSettings.workspaceRegionalTitle }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t.audit.historyTitle })).not.toBeInTheDocument();
    unmount();

    vi.clearAllMocks();
    state.permissions = [
      "workspace.read",
      "workspace.manage",
      "currencies.currency.read",
      "audit.read",
    ];

    render(
      <TooltipProvider>
        <WorkspaceSettingsPage />
      </TooltipProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: t.coreSettings.workspaceRegionalTitle }),
    ).toBeInTheDocument();
    expect(
      vi
        .mocked(readCorePage)
        .mock.calls.some(([path]) => path.startsWith("/api/tenant/core/v1/audit/entities/")),
    ).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: t.audit.historyTitle }));

    expect(await screen.findByText("Kamal Admin")).toBeInTheDocument();
    expect(readCorePage).toHaveBeenCalledWith(
      `/api/tenant/core/v1/audit/entities/WorkspaceSettingsEntity/${BASELINE.id}`,
      "limit=10",
      expect.any(Object),
    );
    expect(document.querySelector("pre")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: t.audit.expandAll }));
    expect(await screen.findByText("Africa/Cairo")).toBeInTheDocument();
    expect(screen.getAllByText(t.audit.fields.defaultLanguage).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(t.audit.fields.timezone).length).toBeGreaterThanOrEqual(1);
  });

  it("renders a clean not-ready empty state on 503 and inline field validation on 422", async () => {
    state.lang = language;
    const t = { en, ar }[language];

    vi.mocked(coreGet).mockRejectedValueOnce(
      new TenantApiClientError("Not seeded", {
        status: 503,
        statusText: "Service Unavailable",
        data: { code: TENANT_NOT_READY_CODE, message: "Not seeded" },
        headers: new Headers(),
      }),
    );

    const { unmount } = render(
      <TooltipProvider>
        <WorkspaceSettingsPage />
      </TooltipProvider>,
    );

    expect(await screen.findByText(t.coreSettings.workspaceNotReadyTitle)).toBeInTheDocument();
    expect(screen.queryByText(/HTTP 503/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/PATCH_IF_UNMODIFIED/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/TENANT_NOT_READY/i)).not.toBeInTheDocument();
    unmount();

    vi.mocked(corePut).mockRejectedValueOnce(
      new TenantApiClientError("Invalid timezone", {
        status: 422,
        statusText: "Unprocessable Entity",
        data: { code: TIMEZONE_INVALID_CODE, message: "Invalid timezone" },
        headers: new Headers(),
      }),
    );

    render(
      <TooltipProvider>
        <WorkspaceSettingsPage />
      </TooltipProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: t.coreSettings.workspaceRegionalTitle }),
    ).toBeInTheDocument();
    const timezoneInput = screen.getByDisplayValue("Africa/Cairo");
    fireEvent.change(timezoneInput, { target: { value: "Mars/Olympus" } });

    fireEvent.click(
      screen.getByRole("button", {
        name: t.coreSettings.workspaceUi.saveWithCount.replace("{count}", "1"),
      }),
    );

    expect(await screen.findByText(t.coreSettings.workspaceTimezoneInvalid)).toBeInTheDocument();
    expect(timezoneInput).toHaveAttribute("aria-invalid", "true");
  });

  it("replaces raw wire keys, null, and booleans in the conflict dialog and supports overwrite", async () => {
    state.lang = language;
    const t = { en, ar }[language];

    render(
      <TooltipProvider>
        <WorkspaceSettingsPage />
      </TooltipProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: t.coreSettings.workspaceRegionalTitle }),
    ).toBeInTheDocument();

    const timezoneInput = screen.getByDisplayValue("Africa/Cairo");
    fireEvent.change(timezoneInput, { target: { value: "UTC" } });

    vi.mocked(coreGet).mockResolvedValueOnce({
      data: {
        ...BASELINE,
        defaultLanguage: "ar",
        defaultCurrencyCode: null,
        timezone: "Asia/Riyadh",
        allowSupport: false,
        updatedAt: "2026-10-30T10:30:00.000Z",
      },
      headers: new Headers(),
      status: 200,
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: t.coreSettings.workspaceUi.saveWithCount.replace("{count}", "1"),
      }),
    );

    expect(
      await screen.findByText(t.coreSettings.workspaceUi.conflictModalTitle),
    ).toBeInTheDocument();

    expect(screen.getAllByText(t.coreSettings.workspaceLanguage).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(t.coreSettings.workspaceCurrency).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(t.coreSettings.workspaceTimezone).length).toBeGreaterThanOrEqual(2);
    expect(
      screen.getAllByText(t.coreSettings.workspaceAllowSupport).length,
    ).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(t.audit.valueEmpty)).toBeInTheDocument();
    expect(screen.getByText(t.crmShared.booleanNo)).toBeInTheDocument();

    expect(screen.queryByText("defaultLanguage")).not.toBeInTheDocument();
    expect(screen.queryByText("defaultCurrencyCode")).not.toBeInTheDocument();
    expect(screen.queryByText("allowSupport")).not.toBeInTheDocument();
    expect(screen.queryByText("null")).not.toBeInTheDocument();
    expect(screen.queryByText("true")).not.toBeInTheDocument();
    expect(screen.queryByText("false")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: t.coreSettings.workspaceUi.conflictOverwrite }),
    );

    await waitFor(() => {
      expect(corePut).toHaveBeenCalledWith(
        WORKSPACE_SETTINGS_PATH,
        {
          timezone: "UTC",
        },
        expect.any(Object),
      );
    });
    expect(screen.queryByText(t.common.discardTitle)).not.toBeInTheDocument();
  });

  it("guards dirty discard and reload with ConfirmActionModal, skips prompt when clean, and disables both while saving", async () => {
    state.lang = language;
    const t = { en, ar }[language];

    render(
      <TooltipProvider>
        <WorkspaceSettingsPage />
      </TooltipProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: t.coreSettings.workspaceRegionalTitle }),
    ).toBeInTheDocument();
    const initialReads = vi.mocked(coreGet).mock.calls.length;

    // 1. Clean reload triggers immediately without opening ConfirmActionModal.
    fireEvent.click(screen.getByRole("button", { name: t.coreSettings.reload }));
    expect(screen.queryByText(t.common.discardTitle)).not.toBeInTheDocument();
    await waitFor(() => {
      expect(vi.mocked(coreGet).mock.calls.length).toBe(initialReads + 1);
    });

    // 2. Dirty Discard -> Cancel (and Escape / onOpenChange(false)) keeps unsaved draft intact.
    const timezoneInput = screen.getByDisplayValue("Africa/Cairo");
    fireEvent.change(timezoneInput, { target: { value: "UTC" } });

    fireEvent.click(screen.getByRole("button", { name: t.coreSettings.workspaceUi.discard }));
    expect(await screen.findByText(t.common.discardTitle)).toBeInTheDocument();
    expect(screen.getByText(t.common.discardDescription)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: t.common.cancel }));
    await waitFor(() => {
      expect(screen.queryByText(t.common.discardTitle)).not.toBeInTheDocument();
    });
    expect(screen.getByDisplayValue("UTC")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: t.coreSettings.workspaceUi.discard }));
    expect(await screen.findByText(t.common.discardTitle)).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByText(t.common.discardTitle)).not.toBeInTheDocument();
    });
    expect(screen.getByDisplayValue("UTC")).toBeInTheDocument();

    // 3. Dirty Discard -> Confirm resets draft back to saved baseline.
    fireEvent.click(screen.getByRole("button", { name: t.coreSettings.workspaceUi.discard }));
    expect(await screen.findByText(t.common.discardTitle)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t.common.discardConfirm }));

    await waitFor(() => {
      expect(screen.queryByText(t.common.discardTitle)).not.toBeInTheDocument();
    });
    expect(screen.getByDisplayValue("Africa/Cairo")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: t.coreSettings.workspaceUi.discard }),
    ).not.toBeInTheDocument();

    // 4. Dirty Reload -> Cancel skips reload; Confirm reloads from server and resets draft.
    fireEvent.change(screen.getByDisplayValue("Africa/Cairo"), {
      target: { value: "Asia/Riyadh" },
    });
    const readsBeforeDirtyReload = vi.mocked(coreGet).mock.calls.length;
    vi.mocked(coreGet).mockResolvedValueOnce({
      data: {
        ...BASELINE,
        timezone: "Europe/London",
        updatedAt: "2026-10-30T12:00:00.000Z",
      },
      headers: new Headers(),
      status: 200,
    });

    fireEvent.click(screen.getByRole("button", { name: t.coreSettings.reload }));
    expect(await screen.findByText(t.common.discardTitle)).toBeInTheDocument();
    expect(vi.mocked(coreGet).mock.calls.length).toBe(readsBeforeDirtyReload);

    fireEvent.click(screen.getByRole("button", { name: t.common.cancel }));
    await waitFor(() => {
      expect(screen.queryByText(t.common.discardTitle)).not.toBeInTheDocument();
    });
    expect(vi.mocked(coreGet).mock.calls.length).toBe(readsBeforeDirtyReload);
    expect(screen.getByDisplayValue("Asia/Riyadh")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: t.coreSettings.reload }));
    expect(await screen.findByText(t.common.discardTitle)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t.common.discardConfirm }));

    expect(await screen.findByDisplayValue("Europe/London")).toBeInTheDocument();
    expect(vi.mocked(coreGet).mock.calls.length).toBe(readsBeforeDirtyReload + 1);
    expect(
      screen.queryByRole("button", { name: t.coreSettings.workspaceUi.discard }),
    ).not.toBeInTheDocument();

    // 5. While saving, both Discard and Reload are disabled and Save completes without discard prompt.
    fireEvent.change(screen.getByDisplayValue("Europe/London"), {
      target: { value: "Africa/Cairo" },
    });
    vi.mocked(coreGet).mockResolvedValueOnce({
      data: {
        ...BASELINE,
        timezone: "Europe/London",
        updatedAt: "2026-10-30T12:00:00.000Z",
      },
      headers: new Headers(),
      status: 200,
    });

    const deferredPut = createDeferred<CoreResult>();
    vi.mocked(corePut).mockImplementationOnce(() => deferredPut.promise);

    fireEvent.click(
      screen.getByRole("button", {
        name: t.coreSettings.workspaceUi.saveWithCount.replace("{count}", "1"),
      }),
    );

    await waitFor(() => {
      expect(corePut).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByRole("button", { name: t.coreSettings.reload })).toBeDisabled();
    expect(screen.getByRole("button", { name: t.coreSettings.workspaceUi.discard })).toBeDisabled();

    deferredPut.resolve({
      data: {
        ...BASELINE,
        timezone: "Africa/Cairo",
        updatedAt: "2026-10-30T12:05:00.000Z",
      },
      headers: new Headers(),
      status: 200,
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: t.coreSettings.reload })).not.toBeDisabled();
    });
    expect(screen.queryByText(t.common.discardTitle)).not.toBeInTheDocument();
  });
});
