// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError, axiosClient } from "@/lib/api/axiosClient";
import {
  MAX_OPERATION_MODAL_POLLS,
  OPERATION_MODAL_POLL_INTERVAL_MS,
} from "./hooks/useOperationModalPolling";
import WorkspaceComponentUpdatesPage from "./page";
import {
  PROVISIONING_UPDATES_APPLY_PATH,
  PROVISIONING_UPDATES_PAGE_SIZE,
  PROVISIONING_UPDATES_PATH,
  provisioningOperationPath,
  type TenantOperationStatus,
} from "./provisioning-updates-contract";
import { formatOperationGuidance } from "./updates-labels";

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

const { toastMock, state } = vi.hoisted(() => ({
  toastMock: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    outcomeFromApi: vi.fn(() => false),
    errorFromApi: vi.fn(),
  },
  state: {
    lang: "en" as "en" | "ar",
    userId: "01900000-0000-7000-8000-000000000001",
    tenantWide: true,
    permissions: ["workspace.read", "workspace.manage"] as string[],
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/core/settings/updates",
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
    user: {
      id: state.userId,
      isTenantOwner: false,
      permissions: state.permissions,
      permissionScopes: Object.fromEntries(
        state.permissions.map((perm) => [
          perm,
          {
            tenantWide: state.tenantWide,
            companyIds: state.tenantWide ? [] : ["01900000-0000-7000-8000-000000000050"],
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
vi.mock("@/lib/api/axiosClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/axiosClient")>();
  return {
    ...actual,
    axiosClient: {
      ...actual.axiosClient,
      get: vi.fn(),
      post: vi.fn(),
    },
  };
});

const CHECKSUM_CURRENT = "1".repeat(64);
const CHECKSUM_TARGET = "2".repeat(64);
const OPERATION_ID = "01902001-3000-7000-8000-000000000888";

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function makeUpdateItem(
  index: number,
  overrides?: {
    componentKey?: string;
    releaseVersion?: string;
    riskLevel?: "LOW" | "MEDIUM" | "HIGH";
    requiresBackup?: boolean;
    requiresMaintenance?: boolean;
    updateAlreadyPlanned?: boolean;
    selfServiceAllowed?: boolean;
    currentManifestChecksum?: string | null;
  },
) {
  const suffix = String(index).padStart(12, "0");
  const currentSuffix = String(index + 1000).padStart(12, "0");
  const targetSuffix = String(index + 2000).padStart(12, "0");
  return {
    lastOperationId: null,
    componentId: `01902001-3000-7000-8000-${suffix}`,
    componentKey: overrides?.componentKey ?? `comp.item${String(index).padStart(2, "0")}`,
    ownerApp: "core",
    installationState: "OUTDATED",
    current: {
      releaseId: `01902001-3000-7000-8000-${currentSuffix}`,
      releaseVersion: "1.14.0",
      schemaVersion: "2026.08",
      manifestChecksum:
        overrides && "currentManifestChecksum" in overrides
          ? overrides.currentManifestChecksum
          : CHECKSUM_CURRENT,
    },
    desiredReleaseId: null,
    updateAlreadyPlanned: overrides?.updateAlreadyPlanned ?? false,
    availableRelease: {
      id: `01902001-3000-7000-8000-${targetSuffix}`,
      releaseVersion: overrides?.releaseVersion ?? "1.15.0",
      manifestVersion: 2,
      schemaTarget: "2026.09",
      manifestChecksum: CHECKSUM_TARGET,
      schemaChecksum: null,
      riskLevel: overrides?.riskLevel ?? "LOW",
      selfServiceAllowed: overrides?.selfServiceAllowed ?? true,
      requiresBackup: overrides?.requiresBackup ?? false,
      requiresMaintenance: overrides?.requiresMaintenance ?? false,
      publishedAt: "2026-10-30T10:00:00.000Z",
      compatibilityContractVersion: 1,
    },
  };
}

function makeEnvelopePage<T>(
  items: T[],
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  },
) {
  return {
    data: {
      success: true,
      status: "SUCCESS",
      statusCode: 200,
      data: items,
      meta,
      correlationId: "01902001-3000-7000-8000-000000000777",
    },
    headers: new Headers(),
    status: 200,
    statusText: "OK",
  };
}

const PRIMARY_ITEM = makeUpdateItem(10, {
  componentKey: "core.workspace",
  riskLevel: "MEDIUM",
  requiresBackup: true,
});

beforeEach(() => {
  state.lang = "en";
  state.userId = "01900000-0000-7000-8000-000000000001";
  state.tenantWide = true;
  state.permissions = ["workspace.read", "workspace.manage"];

  vi.mocked(axiosClient.get).mockImplementation(async (url: string) => {
    if (url.startsWith(`${PROVISIONING_UPDATES_PATH}?`)) {
      return makeEnvelopePage([PRIMARY_ITEM], {
        page: 1,
        limit: PROVISIONING_UPDATES_PAGE_SIZE,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });
    }
    if (url === provisioningOperationPath(OPERATION_ID)) {
      return {
        data: {
          success: true,
          data: {
            id: OPERATION_ID,
            status: "SUCCEEDED",
            type: "TENANT_COMPONENT_UPDATE",
            currentPhase: "FINALIZING",
            safeError: null,
            updatedAt: "2026-10-30T12:10:00.000Z",
          },
        },
        headers: new Headers(),
        status: 200,
        statusText: "OK",
      };
    }
    throw new Error(`Unexpected GET URL: ${url}`);
  });

  vi.mocked(axiosClient.post).mockResolvedValue({
    data: {
      success: true,
      data: {
        replayed: false,
        operation: {
          id: OPERATION_ID,
          status: "QUEUED",
          type: "TENANT_COMPONENT_UPDATE",
          currentPhase: "PRECHECK",
          safeError: null,
          updatedAt: "2026-10-30T12:05:00.000Z",
        },
      },
    },
    headers: new Headers(),
    status: 202,
    statusText: "Accepted",
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe.each(["en", "ar"] as const)("WorkspaceComponentUpdatesPage in %s", (language) => {
  it("loads canonical { data, meta } envelope, renders truthful eligibility/requirements without zero-downtime claims, enforces consent before apply, and treats 202 as accepted only", async () => {
    state.lang = language;
    const t = { en, ar }[language];
    const noReqEligible = makeUpdateItem(11, {
      componentKey: "crm.contacts",
      requiresBackup: false,
      requiresMaintenance: false,
    });
    const plannedItem = makeUpdateItem(12, {
      componentKey: "crm.deals",
      updateAlreadyPlanned: true,
    });
    const adminManagedItem = makeUpdateItem(13, {
      componentKey: "trade.settlement",
      selfServiceAllowed: false,
    });
    const incompleteItem = makeUpdateItem(14, {
      componentKey: "core.legacy",
      currentManifestChecksum: null,
    });

    vi.mocked(axiosClient.get).mockImplementation(async (url: string) => {
      if (url.startsWith(`${PROVISIONING_UPDATES_PATH}?`)) {
        return makeEnvelopePage(
          [PRIMARY_ITEM, noReqEligible, plannedItem, adminManagedItem, incompleteItem],
          {
            page: 1,
            limit: PROVISIONING_UPDATES_PAGE_SIZE,
            total: 5,
            totalPages: 1,
            hasNext: false,
            hasPrev: false,
          },
        );
      }
      if (url === provisioningOperationPath(OPERATION_ID)) {
        return {
          data: {
            success: true,
            data: {
              id: OPERATION_ID,
              status: "SUCCEEDED",
              type: "TENANT_COMPONENT_UPDATE",
              currentPhase: "FINALIZING",
              safeError: null,
              updatedAt: "2026-10-30T12:10:00.000Z",
            },
          },
          headers: new Headers(),
          status: 200,
          statusText: "OK",
        };
      }
      throw new Error(`Unexpected GET URL: ${url}`);
    });

    render(<WorkspaceComponentUpdatesPage />);

    expect(await screen.findByText("core.workspace")).toBeInTheDocument();
    expect(axiosClient.get).toHaveBeenCalledWith(
      `${PROVISIONING_UPDATES_PATH}?page=1&limit=25&sortBy=publishedAt&sortDir=DESC`,
      expect.objectContaining({ cache: "no-store", suppressForbiddenToast: true }),
    );

    const titleMatches = screen.getAllByText(t.coreSettings.updatesUi.title);
    expect(titleMatches).toHaveLength(1);
    expect(titleMatches[0]?.closest(".sr-only")).not.toBeNull();

    // Neutral requirements label (never zero-downtime guarantee) and derived non-selectable reasons.
    expect(screen.getAllByText(t.coreSettings.updatesUi.requirementsNone).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Zero downtime/iu)).not.toBeInTheDocument();
    expect(screen.getByText(t.coreSettings.updatesUi.statusPlanned)).toBeInTheDocument();
    expect(screen.getByText(t.coreSettings.updatesUi.reasonPlanned)).toBeInTheDocument();
    expect(screen.getByText(t.coreSettings.updatesUi.statusAdminManaged)).toBeInTheDocument();
    expect(screen.getByText(t.coreSettings.updatesUi.reasonAdminManaged)).toBeInTheDocument();
    expect(screen.getByText(t.coreSettings.updatesUi.statusIncompleteEvidence)).toBeInTheDocument();
    expect(screen.getByText(t.coreSettings.updatesUi.reasonIncompleteEvidence)).toBeInTheDocument();
    expect(screen.queryByText(t.common.readOnly)).not.toBeInTheDocument();

    expect(screen.getByRole("checkbox", { name: "core.workspace" })).not.toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "crm.deals" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "trade.settlement" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "core.legacy" })).toBeDisabled();

    // Select all selects only the 2 eligible rows.
    fireEvent.click(screen.getByRole("checkbox", { name: t.views.selectAll }));
    expect(
      screen.getByText(`2 · ${t.coreSettings.updatesUi.statusSelected}`),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "crm.contacts" }));

    const openModalBtn = screen.getByRole("button", {
      name: t.coreSettings.updatesUi.applySelected.replace("{count}", "1"),
    });
    fireEvent.click(openModalBtn);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(t.coreSettings.updatesUi.modalTitle)).toBeInTheDocument();
    expect(
      within(dialog).getByText(t.coreSettings.updatesUi.modalRequirementsWarning),
    ).toBeInTheDocument();
    // Background PageHeader primary action is hidden while modal is open.
    expect(
      screen.queryByRole("button", {
        name: t.coreSettings.updatesUi.applySelected.replace("{count}", "1"),
      }),
    ).not.toBeInTheDocument();

    expect(within(dialog).queryByText(/202 Accepted/iu)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/x-idempotency-key/iu)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/\/api\/tenant\/core\/v1/u)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/targetManifestChecksum/u)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/11111111/u)).not.toBeInTheDocument();

    const confirmBtn = within(dialog).getByRole("button", {
      name: t.coreSettings.updatesUi.modalConfirmCta.replace("{count}", "1"),
    });
    expect(confirmBtn).toBeDisabled();

    const consentCheckbox = within(dialog).getByRole("checkbox");
    fireEvent.click(consentCheckbox);
    expect(confirmBtn).not.toBeDisabled();

    fireEvent.click(confirmBtn);
    await waitFor(() => {
      expect(axiosClient.post).toHaveBeenCalledTimes(1);
    });

    const [path, body, config] = vi.mocked(axiosClient.post).mock.calls[0]!;
    expect(path).toBe(PROVISIONING_UPDATES_APPLY_PATH);
    expect(body).toEqual({
      selections: [
        {
          componentKey: "core.workspace",
          targetReleaseId: PRIMARY_ITEM.availableRelease.id,
          targetReleaseVersion: "1.15.0",
          targetManifestChecksum: CHECKSUM_TARGET,
          currentAppliedReleaseId: PRIMARY_ITEM.current.releaseId,
          currentAppliedManifestChecksum: CHECKSUM_CURRENT,
        },
      ],
    });
    const sentKey = (config?.headers as Record<string, string>)["x-idempotency-key"];
    expect(sentKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
    );

    const expectedQueuedLabel = t.coreSettings.updatesUi.operationStripLabel.replace(
      "{status}",
      t.coreSettings.updatesUi.operationStatus.QUEUED,
    );
    expect(await screen.findByText(expectedQueuedLabel)).toBeInTheDocument();
    expect(screen.queryByText(/PRECHECK/u)).not.toBeInTheDocument();
    expect(screen.queryByText(new RegExp(OPERATION_ID, "u"))).not.toBeInTheDocument();
    expect(toastMock.success).toHaveBeenCalledWith(t.coreSettings.updatesUi.applySuccessTitle);

    fireEvent.click(
      screen.getByRole("button", { name: t.coreSettings.updatesUi.operationRefresh }),
    );
    const expectedSucceededLabel = t.coreSettings.updatesUi.operationStripLabel.replace(
      "{status}",
      t.coreSettings.updatesUi.operationStatus.SUCCEEDED,
    );
    expect(await screen.findByText(expectedSucceededLabel)).toBeInTheDocument();
  });

  it("distinguishes unfiltered empty discovery from filtered no-match without claiming components are up to date", async () => {
    state.lang = language;
    const t = { en, ar }[language];

    vi.mocked(axiosClient.get).mockResolvedValue(
      makeEnvelopePage([], {
        page: 1,
        limit: 25,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      }),
    );

    render(<WorkspaceComponentUpdatesPage />);

    expect(await screen.findByText(t.coreSettings.updatesUi.emptyTitle)).toBeInTheDocument();
    expect(
      screen.getByText(t.coreSettings.updatesUi.emptyUnfilteredDescription),
    ).toBeInTheDocument();
    expect(screen.queryByText(/up to date/iu)).not.toBeInTheDocument();

    fireEvent.change(
      screen.getByPlaceholderText(t.coreSettings.updatesUi.filterComponentPlaceholder),
      { target: { value: "crm.core" } },
    );

    expect(
      await screen.findByText(t.coreSettings.updatesUi.emptyFilteredTitle),
    ).toBeInTheDocument();
    expect(screen.getByText(t.coreSettings.updatesUi.emptyDescription)).toBeInTheDocument();

    fireEvent.click(
      screen.getAllByRole("button", { name: t.coreSettings.clearFilters })[0]!,
    );
    expect(await screen.findByText(t.coreSettings.updatesUi.emptyTitle)).toBeInTheDocument();
  });

  it("keeps the confirmation modal open and busy during pending apply, blocks dismissal and same-tick double submit, and protects submitted snapshot across active discovery", async () => {
    state.lang = language;
    const t = { en, ar }[language];

    const pendingPost = createDeferred<Awaited<ReturnType<typeof axiosClient.post>>>();
    const backgroundGet = createDeferred<ReturnType<typeof makeEnvelopePage>>();
    let getCount = 0;

    vi.mocked(axiosClient.get).mockImplementation(async () => {
      getCount += 1;
      if (getCount === 2) return backgroundGet.promise;
      return makeEnvelopePage([PRIMARY_ITEM], {
        page: 1,
        limit: 25,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });
    });
    vi.mocked(axiosClient.post).mockImplementationOnce(() => pendingPost.promise);

    render(<WorkspaceComponentUpdatesPage />);
    expect(await screen.findByText("core.workspace")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "core.workspace" }));

    // Trigger a background discovery refresh right before opening? Wait: let's open modal, start background refresh? No, Refresh is disabled when isApplying, so let's test synchronous double-click + pending modal visibility + Escape/Cancel blocked!
    fireEvent.click(
      screen.getByRole("button", {
        name: t.coreSettings.updatesUi.applySelected.replace("{count}", "1"),
      }),
    );

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("checkbox"));

    const confirmBtn = within(dialog).getByRole("button", {
      name: t.coreSettings.updatesUi.modalConfirmCta.replace("{count}", "1"),
    });

    // Same-tick double click must only fire 1 POST (`inFlightRef` synchronous fence).
    fireEvent.click(confirmBtn);
    fireEvent.click(confirmBtn);

    expect(axiosClient.post).toHaveBeenCalledTimes(1);

    // Modal MUST remain visible with aria-busy=true while pending (fixes D1).
    const busyDialog = screen.getByRole("dialog");
    expect(busyDialog).toHaveAttribute("aria-busy", "true");
    expect(
      within(busyDialog).getByText(t.coreSettings.updatesUi.modalSubmittingHint),
    ).toBeInTheDocument();
    expect(within(busyDialog).getByRole("button", { name: t.common.cancel })).toBeDisabled();

    // Escape and Cancel clicks cannot dismiss the busy modal.
    fireEvent.keyDown(busyDialog, { key: "Escape" });
    fireEvent.click(within(busyDialog).getByRole("button", { name: t.common.cancel }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    pendingPost.resolve({
      data: {
        success: true,
        data: {
          replayed: false,
          operation: {
            id: OPERATION_ID,
            status: "QUEUED",
            type: "TENANT_COMPONENT_UPDATE",
            currentPhase: "PRECHECK",
            safeError: null,
            updatedAt: "2026-10-30T12:05:00.000Z",
          },
        },
      },
      headers: new Headers(),
      status: 202,
      statusText: "Accepted",
    });

    // Resolve post-apply discovery refresh with changed version while verifying modal closed only after 202 settled.
    backgroundGet.resolve(
      makeEnvelopePage([makeUpdateItem(10, { componentKey: "core.workspace", releaseVersion: "1.16.0" })], {
        page: 1,
        limit: 25,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      }),
    );

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(axiosClient.post).toHaveBeenCalledTimes(1);
    expect(toastMock.success).toHaveBeenCalledWith(t.coreSettings.updatesUi.applySuccessTitle);
  });

  it("transitions to Stale Updates Review without auto-applying on live requirement/version drift or 409 stale conflict", async () => {
    state.lang = language;
    const t = { en, ar }[language];

    let liveItem = PRIMARY_ITEM;

    vi.mocked(axiosClient.get).mockImplementation(async () =>
      makeEnvelopePage([liveItem], {
        page: 1,
        limit: 25,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      }),
    );

    render(<WorkspaceComponentUpdatesPage />);
    expect(await screen.findByText("core.workspace")).toBeInTheDocument();

    // 1. Live requirement/risk drift completing while modal is open clears consent and transitions to Stale Review.
    fireEvent.click(screen.getByRole("checkbox", { name: "core.workspace" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: t.coreSettings.updatesUi.applySelected.replace("{count}", "1"),
      }),
    );

    const firstDialog = await screen.findByRole("dialog");
    fireEvent.click(within(firstDialog).getByRole("checkbox"));

    liveItem = makeUpdateItem(10, {
      componentKey: "core.workspace",
      releaseVersion: "1.15.0",
      riskLevel: "HIGH",
      requiresBackup: true,
      requiresMaintenance: true,
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: t.coreSettings.updatesUi.refreshDiscovery,
        hidden: true,
      }),
    );

    expect(
      await within(screen.getByRole("dialog")).findByText(
        t.coreSettings.updatesUi.staleModalTitle,
      ),
    ).toBeInTheDocument();
    expect(axiosClient.post).not.toHaveBeenCalled();

    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: t.coreSettings.updatesUi.staleModalReloadCta,
      }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByRole("checkbox", { name: "core.workspace" })).not.toBeDisabled();
    });

    // 2. Server 409 TENANT_PROVISIONING_UPDATE_SELECTION_STALE transitions modal to Stale Review without auto-apply.
    vi.mocked(axiosClient.post).mockRejectedValueOnce(
      new TenantApiClientError("Stale selection", {
        status: 409,
        statusText: "Conflict",
        headers: new Headers(),
        data: {
          errorCode: "TENANT_PROVISIONING_UPDATE_SELECTION_STALE",
          message: "Available release changed.",
          correlationId: "01902001-3000-7000-8000-000000000409",
        },
      }),
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "core.workspace" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: t.coreSettings.updatesUi.applySelected.replace("{count}", "1"),
      }),
    );

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("checkbox"));
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: t.coreSettings.updatesUi.modalConfirmCta.replace("{count}", "1"),
      }),
    );

    expect(
      await within(screen.getByRole("dialog")).findByText(
        t.coreSettings.updatesUi.staleModalTitle,
      ),
    ).toBeInTheDocument();
    expect(axiosClient.post).toHaveBeenCalledTimes(1);

    liveItem = makeUpdateItem(10, {
      componentKey: "core.workspace",
      releaseVersion: "1.16.0",
      riskLevel: "HIGH",
      requiresBackup: true,
      requiresMaintenance: true,
    });

    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: t.coreSettings.updatesUi.staleModalReloadCta,
      }),
    );

    expect(await screen.findByText("1.16.0")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // Reload list never auto-applies; user must explicitly select and consent again.
    expect(axiosClient.post).toHaveBeenCalledTimes(1);
  });

  it("preserves unresolved ambiguous attempt body and key across modal close, filters, pagination, and discovery refresh without leaking raw headers or keys", async () => {
    state.lang = language;
    const t = { en, ar }[language];

    const page1Items = Array.from({ length: 25 }, (_, idx) =>
      idx === 0 ? PRIMARY_ITEM : makeUpdateItem(idx + 1),
    );
    const page2Items = [makeUpdateItem(26)];

    vi.mocked(axiosClient.get).mockImplementation(async (url: string) => {
      const parsedUrl = new URL(url, "http://mersany.mutakamel.ai:5002");
      const requestedPage = Number(parsedUrl.searchParams.get("page") ?? "1");
      const componentFilter = parsedUrl.searchParams.get("componentKey");

      if (componentFilter === "crm.core") {
        return makeEnvelopePage([makeUpdateItem(99, { componentKey: "crm.core" })], {
          page: 1,
          limit: 25,
          total: 1,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        });
      }
      if (requestedPage === 2) {
        return makeEnvelopePage(page2Items, {
          page: 2,
          limit: 25,
          total: 26,
          totalPages: 2,
          hasNext: false,
          hasPrev: true,
        });
      }
      return makeEnvelopePage(page1Items, {
        page: 1,
        limit: 25,
        total: 26,
        totalPages: 2,
        hasNext: true,
        hasPrev: false,
      });
    });

    const timeoutError = Object.assign(new Error("Request timed out"), {
      code: "CLIENT_REQUEST_TIMEOUT",
    });
    vi.mocked(axiosClient.post).mockRejectedValueOnce(timeoutError);

    render(<WorkspaceComponentUpdatesPage />);
    expect(await screen.findByText("core.workspace")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "core.workspace" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: t.coreSettings.updatesUi.applySelected.replace("{count}", "1"),
      }),
    );

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("checkbox"));
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: t.coreSettings.updatesUi.modalConfirmCta.replace("{count}", "1"),
      }),
    );

    expect(
      await within(screen.getByRole("dialog")).findByText(t.coreSettings.updatesUi.ambiguousTitle),
    ).toBeInTheDocument();

    const [firstPath, firstBody, firstConfig] = vi.mocked(axiosClient.post).mock.calls[0]!;
    const firstKey = (firstConfig?.headers as Record<string, string>)["x-idempotency-key"]!;
    expect(firstKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
    );

    const bodyText = document.body.textContent ?? "";
    expect(bodyText).not.toContain(firstKey);
    expect(bodyText.toLowerCase()).not.toContain("x-idempotency-key");
    expect(bodyText.toLowerCase()).not.toContain("idempotency-key");
    expect(bodyText).not.toContain(t.coreSettings.updatesUi.modalIdempotencyLabel);
    expect(bodyText).not.toContain("/api/tenant/core/v1");
    expect(bodyText).not.toContain(CHECKSUM_CURRENT);
    expect(bodyText).not.toContain(CHECKSUM_TARGET);
    expect(bodyText).not.toContain("targetManifestChecksum");

    // Closing the ambiguous modal hides modal presentation ONLY; unresolved notice stays active without dismiss!
    fireEvent.click(
      within(screen.getByRole("dialog")).getAllByRole("button", { name: t.common.close })[0]!,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const uncertainBanner = screen.getByRole("status");
    expect(within(uncertainBanner).getByText(t.coreSettings.updatesUi.ambiguousTitle)).toBeInTheDocument();
    expect(
      within(uncertainBanner).queryByRole("button", { name: t.common.dismiss }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "core.workspace" })).toBeDisabled();

    // Navigate page 2, filter crm.core, clear filter, refresh discovery -> ambiguous attempt MUST survive intact!
    fireEvent.click(screen.getByRole("button", { name: t.common.nextPage }));
    expect(await screen.findByText("comp.item26")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "comp.item26" })).toBeDisabled();

    fireEvent.change(
      screen.getByPlaceholderText(t.coreSettings.updatesUi.filterComponentPlaceholder),
      { target: { value: "crm.core" } },
    );
    expect(await screen.findByText("crm.core")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "crm.core" })).toBeDisabled();

    fireEvent.click(
      within(screen.getByRole("status")).getByRole("button", {
        name: t.coreSettings.updatesUi.refreshDiscovery,
      }),
    );
    expect(await screen.findByText("crm.core")).toBeInTheDocument();

    // Re-confirm request replays the exact original body and x-idempotency-key!
    fireEvent.click(
      within(screen.getByRole("status")).getByRole("button", {
        name: t.coreSettings.updatesUi.ambiguousRetryCta,
      }),
    );

    await waitFor(() => {
      expect(axiosClient.post).toHaveBeenCalledTimes(2);
    });

    const [secondPath, secondBody, secondConfig] = vi.mocked(axiosClient.post).mock.calls[1]!;
    const secondKey = (secondConfig?.headers as Record<string, string>)["x-idempotency-key"];
    expect(secondPath).toBe(firstPath);
    expect(secondBody).toEqual(firstBody);
    expect(secondKey).toBe(firstKey);
  });

  it("paginates at 25 rows and clears selection on page change and filter change", async () => {
    state.lang = language;
    const t = { en, ar }[language];

    const page1Items = Array.from({ length: 25 }, (_, idx) => makeUpdateItem(idx + 1));
    const page2Items = [makeUpdateItem(26)];

    vi.mocked(axiosClient.get).mockImplementation(async (url: string) => {
      const parsedUrl = new URL(url, "http://mersany.mutakamel.ai:5002");
      const currentPage = Number(parsedUrl.searchParams.get("page") ?? "1");
      const componentFilter = parsedUrl.searchParams.get("componentKey");

      if (componentFilter === "crm.core") {
        return makeEnvelopePage([makeUpdateItem(99, { componentKey: "crm.core" })], {
          page: 1,
          limit: 25,
          total: 1,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        });
      }

      if (currentPage === 2) {
        return makeEnvelopePage(page2Items, {
          page: 2,
          limit: 25,
          total: 26,
          totalPages: 2,
          hasNext: false,
          hasPrev: true,
        });
      }

      return makeEnvelopePage(page1Items, {
        page: 1,
        limit: 25,
        total: 26,
        totalPages: 2,
        hasNext: true,
        hasPrev: false,
      });
    });

    render(<WorkspaceComponentUpdatesPage />);

    expect(await screen.findByText("comp.item01")).toBeInTheDocument();
    expect(screen.getByText("comp.item25")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "comp.item01" }));
    expect(
      screen.getByRole("button", {
        name: t.coreSettings.updatesUi.applySelected.replace("{count}", "1"),
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: t.common.nextPage }));

    expect(await screen.findByText("comp.item26")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: t.coreSettings.updatesUi.applySelected.replace("{count}", "1"),
      }),
    ).not.toBeInTheDocument();
    expect(axiosClient.get).toHaveBeenCalledWith(
      `${PROVISIONING_UPDATES_PATH}?page=2&limit=25&sortBy=publishedAt&sortDir=DESC`,
      expect.objectContaining({ cache: "no-store", suppressForbiddenToast: true }),
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "comp.item26" }));
    expect(
      screen.getByRole("button", {
        name: t.coreSettings.updatesUi.applySelected.replace("{count}", "1"),
      }),
    ).toBeInTheDocument();

    fireEvent.change(
      screen.getByPlaceholderText(t.coreSettings.updatesUi.filterComponentPlaceholder),
      { target: { value: "crm.core" } },
    );

    expect(await screen.findByText("crm.core")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: t.coreSettings.updatesUi.applySelected.replace("{count}", "1"),
      }),
    ).not.toBeInTheDocument();
    expect(axiosClient.get).toHaveBeenCalledWith(
      `${PROVISIONING_UPDATES_PATH}?page=1&limit=25&sortBy=publishedAt&sortDir=DESC&componentKey=crm.core`,
      expect.objectContaining({ cache: "no-store", suppressForbiddenToast: true }),
    );
  });

  it("fences aborted and stale list reads across effect loads and manual reloads so stale responses never overwrite rows or clear loading", async () => {
    state.lang = language;
    const t = { en, ar }[language];

    const firstUnfiltered = createDeferred<ReturnType<typeof makeEnvelopePage>>();
    const secondFiltered = createDeferred<ReturnType<typeof makeEnvelopePage>>();
    const thirdManualReload = createDeferred<ReturnType<typeof makeEnvelopePage>>();
    const fourthClearedFilter = createDeferred<ReturnType<typeof makeEnvelopePage>>();

    let callIndex = 0;
    vi.mocked(axiosClient.get).mockImplementation(() => {
      callIndex += 1;
      if (callIndex === 1) return firstUnfiltered.promise;
      if (callIndex === 2) return secondFiltered.promise;
      if (callIndex === 3) return thirdManualReload.promise;
      return fourthClearedFilter.promise;
    });

    render(<WorkspaceComponentUpdatesPage />);

    await waitFor(() => {
      expect(axiosClient.get).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(
      screen.getByPlaceholderText(t.coreSettings.updatesUi.filterComponentPlaceholder),
      { target: { value: "crm.core" } },
    );

    await waitFor(() => {
      expect(axiosClient.get).toHaveBeenCalledTimes(2);
    });

    firstUnfiltered.resolve(
      makeEnvelopePage([makeUpdateItem(1, { componentKey: "stale.initial" })], {
        page: 1,
        limit: 25,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      }),
    );
    await Promise.resolve();

    expect(screen.queryByText("stale.initial")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: t.coreSettings.updatesUi.refreshDiscovery }),
    ).toBeDisabled();

    secondFiltered.resolve(
      makeEnvelopePage([makeUpdateItem(2, { componentKey: "crm.core" })], {
        page: 1,
        limit: 25,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      }),
    );

    expect(await screen.findByText("crm.core")).toBeInTheDocument();
    expect(screen.queryByText("stale.initial")).not.toBeInTheDocument();

    const refreshBtn = screen.getByRole("button", {
      name: t.coreSettings.updatesUi.refreshDiscovery,
    });
    expect(refreshBtn).not.toBeDisabled();

    fireEvent.click(refreshBtn);
    await waitFor(() => {
      expect(axiosClient.get).toHaveBeenCalledTimes(3);
    });

    fireEvent.change(
      screen.getByPlaceholderText(t.coreSettings.updatesUi.filterComponentPlaceholder),
      { target: { value: "" } },
    );
    await waitFor(() => {
      expect(axiosClient.get).toHaveBeenCalledTimes(4);
    });

    thirdManualReload.reject(new Error("Stale reload failure"));
    await Promise.resolve();

    expect(screen.queryByText(t.coreSettings.updatesUi.loadFailed)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: t.coreSettings.updatesUi.refreshDiscovery }),
    ).toBeDisabled();

    fourthClearedFilter.resolve(
      makeEnvelopePage([PRIMARY_ITEM], {
        page: 1,
        limit: 25,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      }),
    );

    expect(await screen.findByText("core.workspace")).toBeInTheDocument();
  });

  it("recovers out-of-range pages to max(1, totalPages) when refresh shrinks totalPages to 1 or 0", async () => {
    state.lang = language;
    const t = { en, ar }[language];

    const page1Items = Array.from({ length: 25 }, (_, idx) => makeUpdateItem(idx + 1));
    const page2Items = [makeUpdateItem(26)];
    let datasetMode: "twoPages" | "onePage" | "empty" = "twoPages";

    vi.mocked(axiosClient.get).mockImplementation(async (url: string) => {
      const parsedUrl = new URL(url, "http://mersany.mutakamel.ai:5002");
      const requestedPage = Number(parsedUrl.searchParams.get("page") ?? "1");

      if (datasetMode === "onePage") {
        return makeEnvelopePage(requestedPage === 1 ? page1Items : [], {
          page: requestedPage,
          limit: 25,
          total: 25,
          totalPages: 1,
          hasNext: false,
          hasPrev: requestedPage > 1,
        });
      }

      if (datasetMode === "empty") {
        return makeEnvelopePage([], {
          page: requestedPage,
          limit: 25,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: requestedPage > 1,
        });
      }

      if (requestedPage === 2) {
        return makeEnvelopePage(page2Items, {
          page: 2,
          limit: 25,
          total: 26,
          totalPages: 2,
          hasNext: false,
          hasPrev: true,
        });
      }

      return makeEnvelopePage(page1Items, {
        page: 1,
        limit: 25,
        total: 26,
        totalPages: 2,
        hasNext: true,
        hasPrev: false,
      });
    });

    render(<WorkspaceComponentUpdatesPage />);
    expect(await screen.findByText("comp.item01")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: t.common.nextPage }));
    expect(await screen.findByText("comp.item26")).toBeInTheDocument();

    datasetMode = "onePage";
    fireEvent.click(
      screen.getByRole("button", { name: t.coreSettings.updatesUi.refreshDiscovery }),
    );
    expect(await screen.findByText("comp.item01")).toBeInTheDocument();

    datasetMode = "twoPages";
    fireEvent.click(
      screen.getByRole("button", { name: t.coreSettings.updatesUi.refreshDiscovery }),
    );
    await waitFor(() => {
      expect(screen.getByRole("button", { name: t.common.nextPage })).not.toBeDisabled();
    });
    fireEvent.click(screen.getByRole("button", { name: t.common.nextPage }));
    expect(await screen.findByText("comp.item26")).toBeInTheDocument();

    datasetMode = "empty";
    fireEvent.click(
      screen.getByRole("button", { name: t.coreSettings.updatesUi.refreshDiscovery }),
    );

    expect(await screen.findByText(t.coreSettings.updatesUi.emptyTitle)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t.common.previousPage })).not.toBeInTheDocument();
  });

  it("keeps operation refresh failures explicit and retryable, distinguishing malformed 200 from offline without claiming completion", async () => {
    state.lang = language;
    const t = { en, ar }[language];

    let operationMode: "offline" | "malformed" | "succeeded" = "offline";

    vi.mocked(axiosClient.get).mockImplementation(async (url: string) => {
      if (url.startsWith(`${PROVISIONING_UPDATES_PATH}?`)) {
        return makeEnvelopePage([PRIMARY_ITEM], {
          page: 1,
          limit: PROVISIONING_UPDATES_PAGE_SIZE,
          total: 1,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        });
      }
      if (url === provisioningOperationPath(OPERATION_ID)) {
        if (operationMode === "offline") {
          throw new TypeError("Failed to fetch");
        }
        if (operationMode === "malformed") {
          return {
            data: { success: true, data: { unexpectedShape: true } },
            headers: new Headers(),
            status: 200,
            statusText: "OK",
          };
        }
        return {
          data: {
            success: true,
            data: {
              id: OPERATION_ID,
              status: "SUCCEEDED",
              type: "TENANT_COMPONENT_UPDATE",
              currentPhase: "FINALIZING",
              safeError: null,
              updatedAt: "2026-10-30T12:10:00.000Z",
            },
          },
          headers: new Headers(),
          status: 200,
          statusText: "OK",
        };
      }
      throw new Error(`Unexpected GET URL: ${url}`);
    });

    render(<WorkspaceComponentUpdatesPage />);
    expect(await screen.findByText("core.workspace")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "core.workspace" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: t.coreSettings.updatesUi.applySelected.replace("{count}", "1"),
      }),
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("checkbox"));
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: t.coreSettings.updatesUi.modalConfirmCta.replace("{count}", "1"),
      }),
    );

    const queuedLabel = t.coreSettings.updatesUi.operationStripLabel.replace(
      "{status}",
      t.coreSettings.updatesUi.operationStatus.QUEUED,
    );
    const succeededLabel = t.coreSettings.updatesUi.operationStripLabel.replace(
      "{status}",
      t.coreSettings.updatesUi.operationStatus.SUCCEEDED,
    );
    expect(await screen.findByText(queuedLabel)).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: t.coreSettings.updatesUi.operationRefresh }),
    );
    expect(
      await screen.findByText(
        `${t.commercialOperation.loadFailed} — ${t.coreIdentity.errors.OFFLINE}`,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(queuedLabel)).toBeInTheDocument();
    expect(screen.queryByText(succeededLabel)).not.toBeInTheDocument();

    operationMode = "malformed";
    fireEvent.click(
      screen.getByRole("button", { name: t.coreSettings.updatesUi.operationRefresh }),
    );
    expect(
      await screen.findByText(
        `${t.commercialOperation.loadFailed} — ${t.coreSettings.invalidResponseDescription}`,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(queuedLabel)).toBeInTheDocument();

    operationMode = "succeeded";
    fireEvent.click(
      screen.getByRole("button", { name: t.coreSettings.updatesUi.operationRefresh }),
    );
    expect(await screen.findByText(succeededLabel)).toBeInTheDocument();
    expect(
      screen.queryByText(new RegExp(t.commercialOperation.loadFailed, "u")),
    ).not.toBeInTheDocument();
  });

  it("distinguishes malformed HTTP 200 list responses from offline errors and hides formerly loaded data on HTTP 403", async () => {
    state.lang = language;
    const t = { en, ar }[language];

    let listMode: "malformed" | "offline" | "valid" | "forbidden" = "malformed";

    vi.mocked(axiosClient.get).mockImplementation(async () => {
      if (listMode === "malformed") {
        return {
          data: {
            success: true,
            data: { items: [PRIMARY_ITEM], total: 1, page: 1, limit: 25 },
          },
          headers: new Headers(),
          status: 200,
          statusText: "OK",
        };
      }
      if (listMode === "offline") {
        throw new TypeError("Failed to fetch");
      }
      if (listMode === "forbidden") {
        throw new TenantApiClientError("Forbidden", {
          status: 403,
          statusText: "Forbidden",
          headers: new Headers(),
          data: {
            errorCode: "FORBIDDEN",
            message: "Forbidden",
            correlationId: "01902001-3000-7000-8000-000000000403",
          },
        });
      }
      return makeEnvelopePage([PRIMARY_ITEM], {
        page: 1,
        limit: PROVISIONING_UPDATES_PAGE_SIZE,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });
    });

    render(<WorkspaceComponentUpdatesPage />);

    expect(
      await screen.findByText(t.coreSettings.invalidResponseDescription),
    ).toBeInTheDocument();
    expect(screen.queryByText(t.coreIdentity.errors.OFFLINE)).not.toBeInTheDocument();

    listMode = "offline";
    fireEvent.click(screen.getByRole("button", { name: t.common.retry }));
    expect(await screen.findByText(t.coreIdentity.errors.OFFLINE)).toBeInTheDocument();

    listMode = "valid";
    fireEvent.click(screen.getByRole("button", { name: t.common.retry }));
    expect(await screen.findByText("core.workspace")).toBeInTheDocument();

    listMode = "malformed";
    fireEvent.click(
      screen.getByRole("button", { name: t.coreSettings.updatesUi.refreshDiscovery }),
    );
    expect(
      await screen.findByText(t.coreSettings.invalidResponseDescription),
    ).toBeInTheDocument();
    expect(screen.getByText("core.workspace")).toBeInTheDocument();

    listMode = "offline";
    fireEvent.click(screen.getByRole("button", { name: t.common.retry }));
    expect(await screen.findByText(t.coreIdentity.errors.OFFLINE)).toBeInTheDocument();
    expect(screen.getByText("core.workspace")).toBeInTheDocument();

    listMode = "forbidden";
    fireEvent.click(screen.getByRole("button", { name: t.common.retry }));
    expect(await screen.findByText(t.permissionGate.title)).toBeInTheDocument();
    expect(screen.queryByText("core.workspace")).not.toBeInTheDocument();
  });

  it("keeps accepted-unreadable 202 locked after failed, empty, and unchanged-component discovery reads", async () => {
    state.lang = language;
    const t = { en, ar }[language];

    const pendingRefresh = createDeferred<ReturnType<typeof makeEnvelopePage>>();
    const emptyRefresh = createDeferred<ReturnType<typeof makeEnvelopePage>>();
    const recoveryRefresh = createDeferred<ReturnType<typeof makeEnvelopePage>>();
    let getCallCount = 0;

    vi.mocked(axiosClient.get).mockImplementation(async () => {
      getCallCount += 1;
      if (getCallCount === 2) return pendingRefresh.promise;
      if (getCallCount === 3) return emptyRefresh.promise;
      if (getCallCount === 4) return recoveryRefresh.promise;
      return makeEnvelopePage([PRIMARY_ITEM], {
        page: 1,
        limit: PROVISIONING_UPDATES_PAGE_SIZE,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });
    });

    vi.mocked(axiosClient.post).mockResolvedValueOnce({
      data: {
        success: true,
        data: { unexpectedAcknowledgement: true },
      },
      headers: new Headers(),
      status: 202,
      statusText: "Accepted",
    });

    render(<WorkspaceComponentUpdatesPage />);
    expect(await screen.findByText("core.workspace")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "core.workspace" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: t.coreSettings.updatesUi.applySelected.replace("{count}", "1"),
      }),
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("checkbox"));
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: t.coreSettings.updatesUi.modalConfirmCta.replace("{count}", "1"),
      }),
    );

    await waitFor(() => {
      expect(axiosClient.post).toHaveBeenCalledTimes(1);
      expect(axiosClient.get).toHaveBeenCalledTimes(2);
    });

    const firstSentKey = (
      vi.mocked(axiosClient.post).mock.calls[0]![2]?.headers as Record<string, string>
    )["x-idempotency-key"]!;
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // 1. Pending discovery refresh after unreadable 202: reconciliation notice shown, no raw key, rows locked.
    const pendingNotice = await screen.findByRole("status");
    expect(
      within(pendingNotice).getByText(t.coreSettings.updatesUi.unreadableAcceptedTitle),
    ).toBeInTheDocument();
    expect(
      within(pendingNotice).getByText(t.coreSettings.updatesUi.unreadableAcceptedDescription),
    ).toBeInTheDocument();
    expect(
      within(pendingNotice).queryByRole("button", { name: t.common.dismiss }),
    ).not.toBeInTheDocument();
    expect(document.body.textContent ?? "").not.toContain(firstSentKey);
    expect(screen.getByRole("checkbox", { name: "core.workspace" })).toBeDisabled();

    // 2. Reconciliation refresh fails offline: stays locked, no second POST.
    await act(async () => {
      pendingRefresh.reject(new TypeError("Failed to fetch"));
    });
    expect(
      await within(screen.getByRole("status")).findByText(t.coreIdentity.errors.OFFLINE),
    ).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "core.workspace" })).toBeDisabled();
    expect(axiosClient.post).toHaveBeenCalledTimes(1);

    // 3. Plain successful empty GET (`data: []`) alone CANNOT prove what happened — keeps reconciliation notice active!
    fireEvent.click(
      within(screen.getByRole("status")).getByRole("button", {
        name: t.coreSettings.updatesUi.refreshDiscovery,
      }),
    );
    await waitFor(() => {
      expect(axiosClient.get).toHaveBeenCalledTimes(3);
    });
    await act(async () => {
      emptyRefresh.resolve(
        makeEnvelopePage([], {
          page: 1,
          limit: 25,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        }),
      );
    });
    await waitFor(() => {
      expect(screen.getByText(t.coreSettings.updatesUi.emptyTitle)).toBeInTheDocument();
    });
    expect(
      within(screen.getByRole("status")).getByText(
        t.coreSettings.updatesUi.unreadableAcceptedTitle,
      ),
    ).toBeInTheDocument();
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(axiosClient.post).toHaveBeenCalledTimes(1);

    // The same old eligible row proves neither acceptance nor the operation outcome.
    fireEvent.click(
      within(screen.getByRole("status")).getByRole("button", {
        name: t.coreSettings.updatesUi.refreshDiscovery,
      }),
    );
    await waitFor(() => {
      expect(axiosClient.get).toHaveBeenCalledTimes(4);
    });
    await act(async () => {
      recoveryRefresh.resolve(
        makeEnvelopePage([PRIMARY_ITEM], {
          page: 1,
          limit: PROVISIONING_UPDATES_PAGE_SIZE,
          total: 1,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        }),
      );
    });
    await waitFor(() => {
      expect(
        within(screen.getByRole("status")).getByText(t.coreSettings.updatesUi.unreadableAcceptedTitle),
      ).toBeInTheDocument();
      expect(screen.getByRole("checkbox", { name: "core.workspace" })).toBeDisabled();
    });
    expect(axiosClient.post).toHaveBeenCalledTimes(1);
    expect(toastMock.success).not.toHaveBeenCalled();

    // Invalid componentKey filter disables selection and displays clean localized inline error.
    await act(async () => {
      fireEvent.change(
        screen.getByPlaceholderText(t.coreSettings.updatesUi.filterComponentPlaceholder),
        { target: { value: "123-invalid" } },
      );
    });
    expect(screen.getByText(t.coreSettings.updatesUi.filterComponentInvalid)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "core.workspace" })).toBeDisabled();
  });

  it("keeps accepted-unreadable 202 locked across sort, filter, refresh, unrelated active operation and unrelated operation GET until genuine correlated target/operation evidence arrives", async () => {
    state.lang = language;
    const t = { en, ar }[language];

    const UNRELATED_OP_ID = "01902001-3000-7000-8000-000000000801";
    const CORRELATED_OP_ID = "01902001-3000-7000-8000-000000000802";
    const unrelatedPlannedItem = {
      ...makeUpdateItem(2, { componentKey: "trade.pricing", updateAlreadyPlanned: true }),
      desiredReleaseId: "01902001-3000-7000-8000-000000002002",
      lastOperationId: UNRELATED_OP_ID,
    };
    const secondaryEligibleItem = makeUpdateItem(3, { componentKey: "crm.core" });

    let discoveryMode: "unchanged" | "correlatedPlanned" = "unchanged";
    let unrelatedOpStatus: "RUNNING" | "SUCCEEDED" = "RUNNING";

    vi.mocked(axiosClient.get).mockImplementation(async (url: string) => {
      if (url === provisioningOperationPath(UNRELATED_OP_ID)) {
        return {
          data: {
            success: true,
            data: {
              id: UNRELATED_OP_ID,
              status: unrelatedOpStatus,
              type: "TENANT_COMPONENT_UPDATE",
              currentPhase: "APPLYING",
              safeError: null,
              updatedAt: "2026-10-30T12:01:00.000Z",
            },
          },
          headers: new Headers(),
          status: 200,
          statusText: "OK",
        };
      }
      if (url === provisioningOperationPath(CORRELATED_OP_ID)) {
        return {
          data: {
            success: true,
            data: {
              id: CORRELATED_OP_ID,
              status: "QUEUED",
              type: "TENANT_COMPONENT_UPDATE",
              currentPhase: "PRECHECK",
              safeError: null,
              updatedAt: "2026-10-30T12:06:00.000Z",
            },
          },
          headers: new Headers(),
          status: 200,
          statusText: "OK",
        };
      }
      if (url.startsWith(`${PROVISIONING_UPDATES_PATH}?`)) {
        const parsedUrl = new URL(url, "http://mersany.mutakamel.ai:5002");
        const filterKey = parsedUrl.searchParams.get("componentKey");
        const primaryRow =
          discoveryMode === "correlatedPlanned"
            ? {
                ...PRIMARY_ITEM,
                desiredReleaseId: PRIMARY_ITEM.availableRelease.id,
                updateAlreadyPlanned: true,
                lastOperationId: CORRELATED_OP_ID,
              }
            : PRIMARY_ITEM;
        const allRows = [primaryRow, unrelatedPlannedItem, secondaryEligibleItem];
        const filteredRows = filterKey
          ? allRows.filter((row) => row.componentKey === filterKey)
          : allRows;
        return makeEnvelopePage(filteredRows, {
          page: 1,
          limit: PROVISIONING_UPDATES_PAGE_SIZE,
          total: filteredRows.length,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        });
      }
      throw new Error(`Unexpected GET URL: ${url}`);
    });

    vi.mocked(axiosClient.post).mockResolvedValueOnce({
      data: {
        success: true,
        data: { unexpectedAcknowledgement: true },
      },
      headers: new Headers(),
      status: 202,
      statusText: "Accepted",
    });

    render(<WorkspaceComponentUpdatesPage />);
    expect(await screen.findByText("core.workspace")).toBeInTheDocument();

    const runningLabel = t.coreSettings.updatesUi.operationStripLabel.replace(
      "{status}",
      t.coreSettings.updatesUi.operationStatus.RUNNING,
    );
    expect(await screen.findByText(runningLabel)).toBeInTheDocument();

    // Select core.workspace and submit -> receives accepted-unreadable 202.
    fireEvent.click(screen.getByRole("checkbox", { name: "core.workspace" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: t.coreSettings.updatesUi.applySelected.replace("{count}", "1"),
      }),
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("checkbox"));
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: t.coreSettings.updatesUi.modalConfirmCta.replace("{count}", "1"),
      }),
    );

    const notice = await screen.findByRole("status");
    expect(
      within(notice).getByText(t.coreSettings.updatesUi.unreadableAcceptedTitle),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "core.workspace" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "crm.core" })).toBeDisabled();
    expect(axiosClient.post).toHaveBeenCalledTimes(1);
    expect(toastMock.success).not.toHaveBeenCalled();

    // Unrelated active operation refresh succeeding MUST NOT clear the unreadable-accepted lock.
    unrelatedOpStatus = "SUCCEEDED";
    fireEvent.click(
      screen.getByRole("button", { name: t.coreSettings.updatesUi.operationRefresh }),
    );
    const succeededLabel = t.coreSettings.updatesUi.operationStripLabel.replace(
      "{status}",
      t.coreSettings.updatesUi.operationStatus.SUCCEEDED,
    );
    expect(await screen.findByText(succeededLabel)).toBeInTheDocument();
    expect(
      within(screen.getByRole("status")).getByText(t.coreSettings.updatesUi.unreadableAcceptedTitle),
    ).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "core.workspace" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "crm.core" })).toBeDisabled();

    // Sort, filter, clear filter, and manual refresh with unchanged PRIMARY_ITEM MUST stay locked.
    fireEvent.click(screen.getByRole("combobox", { name: t.views.sortBy }));
    fireEvent.click(
      await screen.findByRole("option", {
        name: `${t.coreSettings.updatesUi.colComponent} · ${t.views.sortAscending}`,
      }),
    );
    await waitFor(() => {
      expect(axiosClient.get).toHaveBeenCalledWith(
        `${PROVISIONING_UPDATES_PATH}?page=1&limit=25&sortBy=componentKey&sortDir=ASC`,
        expect.objectContaining({ cache: "no-store" }),
      );
    });
    expect(
      within(screen.getByRole("status")).getByText(t.coreSettings.updatesUi.unreadableAcceptedTitle),
    ).toBeInTheDocument();

    fireEvent.change(
      screen.getByPlaceholderText(t.coreSettings.updatesUi.filterComponentPlaceholder),
      { target: { value: "core.workspace" } },
    );
    await waitFor(() => {
      expect(axiosClient.get).toHaveBeenCalledWith(
        `${PROVISIONING_UPDATES_PATH}?page=1&limit=25&sortBy=componentKey&sortDir=ASC&componentKey=core.workspace`,
        expect.objectContaining({ cache: "no-store" }),
      );
    });
    expect(screen.getByRole("checkbox", { name: "core.workspace" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: t.coreSettings.clearFilters }));
    expect(await screen.findByText("crm.core")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "crm.core" })).toBeDisabled();
    expect(axiosClient.post).toHaveBeenCalledTimes(1);

    // Genuine correlated target/operation evidence on discovery resolves the lock and tracks the correlated operation.
    discoveryMode = "correlatedPlanned";
    fireEvent.click(
      within(screen.getByRole("status")).getByRole("button", {
        name: t.coreSettings.updatesUi.refreshDiscovery,
      }),
    );

    const queuedLabel = t.coreSettings.updatesUi.operationStripLabel.replace(
      "{status}",
      t.coreSettings.updatesUi.operationStatus.QUEUED,
    );
    expect(await screen.findByText(queuedLabel)).toBeInTheDocument();
    expect(
      screen.queryByText(t.coreSettings.updatesUi.unreadableAcceptedTitle),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "core.workspace" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "crm.core" })).not.toBeDisabled();
    expect(axiosClient.post).toHaveBeenCalledTimes(1);
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it("keeps accepted-unreadable 202 locked when 202 carries a valid operation id until that exact operation id reconciles", async () => {
    state.lang = language;
    const t = { en, ar }[language];

    const ACCEPTED_OP_ID = "01902001-3000-7000-8000-000000000809";
    let listPhase: "initial" | "empty" = "initial";
    let opPhase: "offline" | "valid" = "offline";

    vi.mocked(axiosClient.get).mockImplementation(async (url: string) => {
      if (url === provisioningOperationPath(ACCEPTED_OP_ID)) {
        if (opPhase === "offline") {
          throw new TypeError("Failed to fetch");
        }
        return {
          data: {
            success: true,
            data: {
              id: ACCEPTED_OP_ID,
              status: "SUCCEEDED",
              type: "TENANT_COMPONENT_UPDATE",
              currentPhase: "FINALIZING",
              safeError: null,
              updatedAt: "2026-10-30T12:12:00.000Z",
            },
          },
          headers: new Headers(),
          status: 200,
          statusText: "OK",
        };
      }
      if (url.startsWith(`${PROVISIONING_UPDATES_PATH}?`)) {
        const rows = listPhase === "initial" ? [PRIMARY_ITEM] : [];
        return makeEnvelopePage(rows, {
          page: 1,
          limit: PROVISIONING_UPDATES_PAGE_SIZE,
          total: rows.length,
          totalPages: rows.length > 0 ? 1 : 0,
          hasNext: false,
          hasPrev: false,
        });
      }
      throw new Error(`Unexpected GET URL: ${url}`);
    });

    // 202 response has a valid UUIDv7 operation.id from its own envelope, while status is non-canonical.
    vi.mocked(axiosClient.post).mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          replayed: false,
          operation: {
            id: ACCEPTED_OP_ID,
            status: "FUTURE_UNRECOGNIZED_STATUS",
          },
        },
      },
      headers: new Headers(),
      status: 202,
      statusText: "Accepted",
    });

    render(<WorkspaceComponentUpdatesPage />);
    expect(await screen.findByText("core.workspace")).toBeInTheDocument();

    listPhase = "empty";
    fireEvent.click(screen.getByRole("checkbox", { name: "core.workspace" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: t.coreSettings.updatesUi.applySelected.replace("{count}", "1"),
      }),
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("checkbox"));
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: t.coreSettings.updatesUi.modalConfirmCta.replace("{count}", "1"),
      }),
    );

    const notice = await screen.findByRole("status");
    expect(
      within(notice).getByText(t.coreSettings.updatesUi.unreadableAcceptedTitle),
    ).toBeInTheDocument();
    expect(
      await within(notice).findByText(t.coreIdentity.errors.OFFLINE),
    ).toBeInTheDocument();
    expect(axiosClient.post).toHaveBeenCalledTimes(1);
    expect(toastMock.success).not.toHaveBeenCalled();

    // Refresh reconciles via GET /provisioning/operations/:id for that exact accepted operation ID.
    opPhase = "valid";
    fireEvent.click(
      within(screen.getByRole("status")).getByRole("button", {
        name: t.coreSettings.updatesUi.refreshDiscovery,
      }),
    );

    const succeededLabel = t.coreSettings.updatesUi.operationStripLabel.replace(
      "{status}",
      t.coreSettings.updatesUi.operationStatus.SUCCEEDED,
    );
    expect(await screen.findByText(succeededLabel)).toBeInTheDocument();
    expect(
      screen.queryByText(t.coreSettings.updatesUi.unreadableAcceptedTitle),
    ).not.toBeInTheDocument();
    expect(axiosClient.post).toHaveBeenCalledTimes(1);
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it("renders ReadOnlyGate notice without selection checkboxes for viewers lacking workspace.manage, and fences stale completions across permission changes", async () => {
    state.lang = language;
    const t = { en, ar }[language];

    const pendingPost = createDeferred<Awaited<ReturnType<typeof axiosClient.post>>>();
    vi.mocked(axiosClient.post).mockImplementationOnce(() => pendingPost.promise);

    const { rerender } = render(<WorkspaceComponentUpdatesPage />);
    expect(await screen.findByText("core.workspace")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "core.workspace" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: t.coreSettings.updatesUi.applySelected.replace("{count}", "1"),
      }),
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("checkbox"));
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: t.coreSettings.updatesUi.modalConfirmCta.replace("{count}", "1"),
      }),
    );

    expect(axiosClient.post).toHaveBeenCalledTimes(1);

    // Revoke `workspace.manage` while POST is in flight -> closes modal, hides checkboxes, shows readOnlyNotice, and fences late 202 completion!
    state.permissions = ["workspace.read"];
    rerender(<WorkspaceComponentUpdatesPage />);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(screen.getByText(t.coreSettings.updatesUi.readOnlyNotice)).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "core.workspace" })).not.toBeInTheDocument();

    pendingPost.resolve({
      data: {
        success: true,
        data: {
          replayed: false,
          operation: {
            id: OPERATION_ID,
            status: "QUEUED",
            type: "TENANT_COMPONENT_UPDATE",
            currentPhase: "PRECHECK",
            safeError: null,
            updatedAt: "2026-10-30T12:05:00.000Z",
          },
        },
      },
      headers: new Headers(),
      status: 202,
      statusText: "Accepted",
    });
    await Promise.resolve();

    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it("renders tenant-wide scope guidance without firing GET when workspace.read is company-scoped only", async () => {
    state.lang = language;
    state.tenantWide = false;
    const t = { en, ar }[language];

    render(<WorkspaceComponentUpdatesPage />);

    expect(
      await screen.findByText(t.coreSettings.updatesUi.tenantWideRequiredTitle),
    ).toBeInTheDocument();
    expect(axiosClient.get).not.toHaveBeenCalled();
  });

  it("reaches centered UpdateOperationModal from status row, covers all 10 statuses with sanitized phases/guidance, enforces single modal & primary CTA, and shows succeeded items only for correlated attempts", async () => {
    state.lang = language;
    const t = { en, ar }[language];

    const SEEDED_OP_ID = "01902001-3000-7000-8000-000000000851";
    const basePlanned = makeUpdateItem(21, {
      componentKey: "crm.pipeline",
      updateAlreadyPlanned: true,
    });
    const plannedSeededRow = {
      ...basePlanned,
      desiredReleaseId: basePlanned.availableRelease.id,
      lastOperationId: SEEDED_OP_ID,
    };
    const unselectedEligible = makeUpdateItem(22, { componentKey: "crm.contacts" });

    let listMode: "initial" | "empty" = "initial";
    let seededPayload: {
      status: TenantOperationStatus;
      currentPhase: string | null;
      safeErrorCode?: string | null;
      safeErrorMessage?: string | null;
    } = {
      status: "REQUESTED",
      currentPhase: "AWAITING_PREREQUISITES",
      safeErrorCode: "INTERNAL_PRECHECK_CODE",
      safeErrorMessage: "Raw English server diagnostic that must never appear",
    };
    let appliedOpStatus: TenantOperationStatus = "RUNNING";

    vi.mocked(axiosClient.get).mockImplementation(async (url: string) => {
      if (url.startsWith(`${PROVISIONING_UPDATES_PATH}?`)) {
        const rows =
          listMode === "initial" ? [PRIMARY_ITEM, unselectedEligible, plannedSeededRow] : [];
        return makeEnvelopePage(rows, {
          page: 1,
          limit: PROVISIONING_UPDATES_PAGE_SIZE,
          total: rows.length,
          totalPages: rows.length > 0 ? 1 : 0,
          hasNext: false,
          hasPrev: false,
        });
      }
      if (url === provisioningOperationPath(SEEDED_OP_ID)) {
        return {
          data: {
            success: true,
            data: {
              id: SEEDED_OP_ID,
              status: seededPayload.status,
              type: "PROVISIONING_UPDATE",
              currentPhase: seededPayload.currentPhase,
              safeErrorCode: seededPayload.safeErrorCode ?? null,
              safeErrorMessage: seededPayload.safeErrorMessage ?? null,
              updatedAt: "2026-10-30T12:15:00.000Z",
            },
          },
          headers: new Headers(),
          status: 200,
          statusText: "OK",
        };
      }
      if (url === provisioningOperationPath(OPERATION_ID)) {
        return {
          data: {
            success: true,
            data: {
              id: OPERATION_ID,
              status: appliedOpStatus,
              type: "PROVISIONING_UPDATE",
              currentPhase: appliedOpStatus === "SUCCEEDED" ? "CLOSED" : "crm.schema",
              safeErrorMessage: "Internal Worker SQL lock message",
              updatedAt: "2026-10-30T12:20:00.000Z",
            },
          },
          headers: new Headers(),
          status: 200,
          statusText: "OK",
        };
      }
      throw new Error(`Unexpected GET URL: ${url}`);
    });

    render(<WorkspaceComponentUpdatesPage />);
    expect(await screen.findByText("core.workspace")).toBeInTheDocument();

    const requestedStrip = t.coreSettings.updatesUi.operationStripLabel.replace(
      "{status}",
      t.coreSettings.updatesUi.operationStatus.REQUESTED,
    );
    expect(await screen.findByText(requestedStrip)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Raw English server diagnostic/u),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/INTERNAL_PRECHECK_CODE/u)).not.toBeInTheDocument();
    expect(screen.queryByText(/AWAITING_PREREQUISITES/u)).not.toBeInTheDocument();

    // Select an eligible row so PageHeader owns the primary CTA before opening the status modal.
    fireEvent.click(screen.getByRole("checkbox", { name: "core.workspace" }));
    expect(
      screen.getByRole("button", {
        name: t.coreSettings.updatesUi.applySelected.replace("{count}", "1"),
      }),
    ).toBeInTheDocument();

    // Open centered UpdateOperationModal via short in-page status row -> PageHeader primary CTA yields.
    fireEvent.click(
      screen.getByRole("button", { name: t.coreSettings.updatesUi.operationViewDetails }),
    );
    const statusDialog = await screen.findByRole("dialog");
    expect(
      within(statusDialog).getByText(t.coreSettings.updatesUi.operationModalTitle),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: t.coreSettings.updatesUi.applySelected.replace("{count}", "1"),
      }),
    ).not.toBeInTheDocument();
    expect(
      within(statusDialog).getByText(t.coreSettings.updatesUi.operationStatus.REQUESTED),
    ).toBeInTheDocument();
    expect(
      within(statusDialog).getByText(
        t.coreSettings.updatesUi.operationPhaseAwaitingPrerequisites,
      ),
    ).toBeInTheDocument();

    const lifecycleSteps: Array<{
      status: TenantOperationStatus;
      currentPhase: string | null;
      expectedPhase: string | null;
      suppressedRaw?: RegExp;
    }> = [
      {
        status: "PLANNING",
        currentPhase: "crm.schema",
        expectedPhase: null,
        suppressedRaw: /crm\.schema/u,
      },
      {
        status: "QUEUED",
        currentPhase: "QUEUED",
        expectedPhase: null,
      },
      {
        status: "RUNNING",
        currentPhase: "core.foundation.seed.core.organization",
        expectedPhase: null,
        suppressedRaw: /core\.foundation\.seed/u,
      },
      {
        status: "WAITING_RETRY",
        currentPhase: "PREREQUISITE_EXPIRED",
        expectedPhase: t.coreSettings.updatesUi.operationPhasePrerequisiteExpired,
      },
      {
        status: "CANCEL_REQUESTED",
        currentPhase: "CANCEL_REQUESTED",
        expectedPhase: null,
      },
      {
        status: "FAILED_RETRYABLE",
        currentPhase: "PREREQUISITE_FAILED",
        expectedPhase: t.coreSettings.updatesUi.operationPhasePrerequisiteFailed,
      },
      {
        status: "MANUAL_RECOVERY_REQUIRED",
        currentPhase: "FAILED",
        expectedPhase: null,
      },
      {
        status: "CANCELLED",
        currentPhase: "CANCELLED",
        expectedPhase: null,
      },
      {
        status: "SUCCEEDED",
        currentPhase: "CLOSED",
        expectedPhase: null,
      },
    ];

    for (const step of lifecycleSteps) {
      seededPayload = {
        status: step.status,
        currentPhase: step.currentPhase,
        safeErrorCode: "INTERNAL_STEP_ERR",
        safeErrorMessage: "Untranslated backend exception detail",
      };
      fireEvent.click(
        within(statusDialog).getByRole("button", {
          name: t.coreSettings.updatesUi.operationRefresh,
        }),
      );
      expect(
        await within(statusDialog).findByText(
          t.coreSettings.updatesUi.operationStatus[step.status],
        ),
      ).toBeInTheDocument();
      expect(
        within(statusDialog).getByText(formatOperationGuidance(step.status, t)),
      ).toBeInTheDocument();
      expect(within(statusDialog).queryByText(/%/u)).not.toBeInTheDocument();
      expect(within(statusDialog).queryByText(/ETA/iu)).not.toBeInTheDocument();
      expect(
        within(statusDialog).queryByText(/Untranslated backend exception detail/u),
      ).not.toBeInTheDocument();
      expect(within(statusDialog).queryByText(/INTERNAL_STEP_ERR/u)).not.toBeInTheDocument();
      if (step.suppressedRaw) {
        expect(within(statusDialog).queryByText(step.suppressedRaw)).not.toBeInTheDocument();
      }
      if (step.expectedPhase) {
        expect(within(statusDialog).getByText(step.expectedPhase)).toBeInTheDocument();
      }
      if (step.status === "MANUAL_RECOVERY_REQUIRED") {
        expect(
          within(statusDialog).getByText(
            t.coreSettings.updatesUi.operationManualRecoveryBannerTitle,
          ),
        ).toBeInTheDocument();
      }
      // Absent tenant cancel / retry-execution / rollback buttons must never be rendered.
      expect(
        within(statusDialog).queryByRole("button", { name: /rollback|re-execute/iu }),
      ).not.toBeInTheDocument();
      const footerAndCloseButtons = within(statusDialog).getAllByRole("button");
      expect(footerAndCloseButtons).toHaveLength(3); // Dialog X close, Close outline, Refresh status primary
    }

    // Seeded SUCCEEDED operation has no session-correlated apply snapshot -> omits component list.
    expect(within(statusDialog).queryByText("crm.pipeline")).not.toBeInTheDocument();
    expect(within(statusDialog).queryByText("core.workspace")).not.toBeInTheDocument();

    // Close UpdateOperationModal -> PageHeader Apply CTA returns; opening Apply modal disables View status.
    fireEvent.click(within(statusDialog).getAllByRole("button", { name: t.common.close })[0]!);
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: t.coreSettings.updatesUi.applySelected.replace("{count}", "1"),
      }),
    );
    const applyDialog = await screen.findByRole("dialog");
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    const backgroundViewStatusBtn = screen.getByRole("button", {
      name: t.coreSettings.updatesUi.operationViewDetails,
      hidden: true,
    });
    expect(backgroundViewStatusBtn).toBeDisabled();
    fireEvent.click(backgroundViewStatusBtn);
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(within(applyDialog).getByText(t.coreSettings.updatesUi.modalTitle)).toBeInTheDocument();

    // Submit accepted attempt for core.workspace; subsequent discovery returns empty list.
    listMode = "empty";
    vi.mocked(axiosClient.post).mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          replayed: false,
          operation: {
            id: OPERATION_ID,
            status: "RUNNING",
            type: "PROVISIONING_UPDATE",
            currentPhase: "crm.schema",
            updatedAt: "2026-10-30T12:18:00.000Z",
          },
        },
      },
      headers: new Headers(),
      status: 202,
      statusText: "Accepted",
    });

    fireEvent.click(within(applyDialog).getByRole("checkbox"));
    fireEvent.click(
      within(applyDialog).getByRole("button", {
        name: t.coreSettings.updatesUi.modalConfirmCta.replace("{count}", "1"),
      }),
    );

    // 202 is acceptance only and does not auto-open UpdateOperationModal.
    const runningStrip = t.coreSettings.updatesUi.operationStripLabel.replace(
      "{status}",
      t.coreSettings.updatesUi.operationStatus.RUNNING,
    );
    expect(await screen.findByText(runningStrip)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Open UpdateOperationModal and refresh correlated OPERATION_ID to SUCCEEDED -> shows exact snapshot item only.
    fireEvent.click(
      screen.getByRole("button", { name: t.coreSettings.updatesUi.operationViewDetails }),
    );
    const correlatedDialog = await screen.findByRole("dialog");
    expect(within(correlatedDialog).queryByText("core.workspace")).not.toBeInTheDocument();

    appliedOpStatus = "SUCCEEDED";
    fireEvent.click(
      within(correlatedDialog).getByRole("button", {
        name: t.coreSettings.updatesUi.operationRefresh,
      }),
    );
    expect(
      await within(correlatedDialog).findByText(
        t.coreSettings.updatesUi.operationStatus.SUCCEEDED,
      ),
    ).toBeInTheDocument();
    expect(within(correlatedDialog).getByText("core.workspace")).toBeInTheDocument();
    expect(within(correlatedDialog).getByText("1.14.0")).toBeInTheDocument();
    expect(within(correlatedDialog).getByText("1.15.0")).toBeInTheDocument();
    expect(within(correlatedDialog).queryByText("crm.contacts")).not.toBeInTheDocument();
  });

  it("rejects mismatched operation.id responses on refresh while retaining last-known status and original tracked operationId", async () => {
    state.lang = language;
    const t = { en, ar }[language];

    const MISMATCHED_OP_ID = "01902001-3000-7000-8000-000000000991";
    let opResponseMode: "mismatched" | "matchedSucceeded" = "mismatched";
    const requestedOpUrls: string[] = [];

    vi.mocked(axiosClient.get).mockImplementation(async (url: string) => {
      if (url.startsWith(`${PROVISIONING_UPDATES_PATH}?`)) {
        return makeEnvelopePage([PRIMARY_ITEM], {
          page: 1,
          limit: PROVISIONING_UPDATES_PAGE_SIZE,
          total: 1,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        });
      }
      if (url === provisioningOperationPath(OPERATION_ID)) {
        requestedOpUrls.push(url);
        return {
          data: {
            success: true,
            data: {
              id: opResponseMode === "mismatched" ? MISMATCHED_OP_ID : OPERATION_ID,
              status: "SUCCEEDED",
              type: "PROVISIONING_UPDATE",
              currentPhase: "CLOSED",
              updatedAt: "2026-10-30T12:25:00.000Z",
            },
          },
          headers: new Headers(),
          status: 200,
          statusText: "OK",
        };
      }
      throw new Error(`Unexpected GET URL: ${url}`);
    });

    render(<WorkspaceComponentUpdatesPage />);
    expect(await screen.findByText("core.workspace")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "core.workspace" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: t.coreSettings.updatesUi.applySelected.replace("{count}", "1"),
      }),
    );
    const applyDialog = await screen.findByRole("dialog");
    fireEvent.click(within(applyDialog).getByRole("checkbox"));
    fireEvent.click(
      within(applyDialog).getByRole("button", {
        name: t.coreSettings.updatesUi.modalConfirmCta.replace("{count}", "1"),
      }),
    );

    const queuedStrip = t.coreSettings.updatesUi.operationStripLabel.replace(
      "{status}",
      t.coreSettings.updatesUi.operationStatus.QUEUED,
    );
    expect(await screen.findByText(queuedStrip)).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: t.coreSettings.updatesUi.operationViewDetails }),
    );
    const modal = await screen.findByRole("dialog");
    fireEvent.click(
      within(modal).getByRole("button", { name: t.coreSettings.updatesUi.operationRefresh }),
    );

    expect(
      await within(modal).findByText(
        `${t.commercialOperation.loadFailed} — ${t.coreSettings.invalidResponseDescription}`,
      ),
    ).toBeInTheDocument();
    expect(
      within(modal).getByText(t.coreSettings.updatesUi.operationRetainedStatusHint),
    ).toBeInTheDocument();
    expect(
      within(modal).getByText(t.coreSettings.updatesUi.operationStatus.QUEUED),
    ).toBeInTheDocument();
    expect(
      within(modal).queryByText(t.coreSettings.updatesUi.operationStatus.SUCCEEDED),
    ).not.toBeInTheDocument();

    // Subsequent manual refresh still targets the original OPERATION_ID (never MISMATCHED_OP_ID).
    opResponseMode = "matchedSucceeded";
    fireEvent.click(
      within(modal).getByRole("button", { name: t.coreSettings.updatesUi.operationRefresh }),
    );
    expect(
      await within(modal).findByText(t.coreSettings.updatesUi.operationStatus.SUCCEEDED),
    ).toBeInTheDocument();
    expect(requestedOpUrls).toEqual([
      provisioningOperationPath(OPERATION_ID),
      provisioningOperationPath(OPERATION_ID),
    ]);
  });

  it("bounds foreground status polling to visible open nonterminal sessions without overlap, pauses on failure, and aborts in-flight polls on hide or close", async () => {
    state.lang = language;
    const t = { en, ar }[language];

    type GetResponse = Awaited<ReturnType<typeof axiosClient.get>>;
    let pollBehavior: "deferred" | "offline" | "running" | "succeeded" = "deferred";
    let activeDeferred: Deferred<GetResponse> | null = null;
    let lastSignal: AbortSignal | undefined;
    let opPollCalls = 0;

    const makeOpResponse = (status: TenantOperationStatus, minute: number): GetResponse => ({
      data: {
        success: true,
        data: {
          id: OPERATION_ID,
          status,
          type: "PROVISIONING_UPDATE",
          currentPhase: status === "SUCCEEDED" ? "CLOSED" : "QUEUED",
          updatedAt: `2026-10-30T12:${String(minute).padStart(2, "0")}:00.000Z`,
        },
      },
      headers: new Headers(),
      status: 200,
      statusText: "OK",
    });

    vi.mocked(axiosClient.get).mockImplementation(async (url: string, config) => {
      if (url.startsWith(`${PROVISIONING_UPDATES_PATH}?`)) {
        return makeEnvelopePage([PRIMARY_ITEM], {
          page: 1,
          limit: PROVISIONING_UPDATES_PAGE_SIZE,
          total: 1,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        });
      }
      if (url === provisioningOperationPath(OPERATION_ID)) {
        opPollCalls += 1;
        lastSignal = config?.signal as AbortSignal | undefined;
        if (pollBehavior === "deferred") {
          activeDeferred = createDeferred<GetResponse>();
          return activeDeferred.promise;
        }
        if (pollBehavior === "offline") {
          throw new TypeError("Failed to fetch");
        }
        if (pollBehavior === "succeeded") {
          return makeOpResponse("SUCCEEDED", 55);
        }
        return makeOpResponse("RUNNING", 10 + (opPollCalls % 40));
      }
      throw new Error(`Unexpected GET URL: ${url}`);
    });

    const originalVisibilityDescriptor = Object.getOwnPropertyDescriptor(
      document,
      "visibilityState",
    );
    const setVisibility = (next: DocumentVisibilityState) => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => next,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    };

    render(<WorkspaceComponentUpdatesPage />);
    expect(await screen.findByText("core.workspace")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "core.workspace" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: t.coreSettings.updatesUi.applySelected.replace("{count}", "1"),
      }),
    );
    const applyDialog = await screen.findByRole("dialog");
    fireEvent.click(within(applyDialog).getByRole("checkbox"));
    fireEvent.click(
      within(applyDialog).getByRole("button", {
        name: t.coreSettings.updatesUi.modalConfirmCta.replace("{count}", "1"),
      }),
    );

    const queuedStrip = t.coreSettings.updatesUi.operationStripLabel.replace(
      "{status}",
      t.coreSettings.updatesUi.operationStatus.QUEUED,
    );
    expect(await screen.findByText(queuedStrip)).toBeInTheDocument();

    setVisibility("visible");
    vi.useFakeTimers();
    try {
      // Closed modal never polls in the background.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(OPERATION_MODAL_POLL_INTERVAL_MS * 4);
      });
      expect(opPollCalls).toBe(0);

      // Opening modal arms bounded foreground polling at 5s intervals without overlap.
      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: t.coreSettings.updatesUi.operationViewDetails }),
        );
      });
      const modal = screen.getByRole("dialog");

      await act(async () => {
        await vi.advanceTimersByTimeAsync(OPERATION_MODAL_POLL_INTERVAL_MS - 1);
      });
      expect(opPollCalls).toBe(0);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(opPollCalls).toBe(1);

      // Slow in-flight poll must never overlap even across multiple intervals.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(OPERATION_MODAL_POLL_INTERVAL_MS * 5);
      });
      expect(opPollCalls).toBe(1);

      await act(async () => {
        activeDeferred!.resolve(makeOpResponse("RUNNING", 11));
        await Promise.resolve();
      });
      expect(
        within(modal).getByText(t.coreSettings.updatesUi.operationStatus.RUNNING),
      ).toBeInTheDocument();

      // Hidden document stops scheduled polling and aborts an in-flight automatic poll while keeping last-known status.
      await act(async () => {
        setVisibility("hidden");
        await vi.advanceTimersByTimeAsync(OPERATION_MODAL_POLL_INTERVAL_MS * 4);
      });
      expect(opPollCalls).toBe(1);

      await act(async () => {
        setVisibility("visible");
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(OPERATION_MODAL_POLL_INTERVAL_MS);
      });
      expect(opPollCalls).toBe(2);
      expect(lastSignal?.aborted).toBe(false);

      await act(async () => {
        setVisibility("hidden");
      });
      expect(lastSignal?.aborted).toBe(true);
      expect(
        within(modal).getByText(t.coreSettings.updatesUi.operationStatus.RUNNING),
      ).toBeInTheDocument();

      // Transient tracking failure retains last-known status and pauses automatic polling until manual refresh.
      pollBehavior = "offline";
      await act(async () => {
        setVisibility("visible");
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(OPERATION_MODAL_POLL_INTERVAL_MS);
      });
      expect(opPollCalls).toBe(3);
      expect(
        within(modal).getByText(t.coreSettings.updatesUi.operationRetainedStatusHint),
      ).toBeInTheDocument();
      expect(
        within(modal).getByText(t.coreSettings.updatesUi.operationStatus.RUNNING),
      ).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(OPERATION_MODAL_POLL_INTERVAL_MS * 4);
      });
      expect(opPollCalls).toBe(3);

      // Reopen a clean modal session, manually refresh to clear failure, and verify the 12-poll session cap.
      await act(async () => {
        fireEvent.click(within(modal).getAllByRole("button", { name: t.common.close })[0]!);
      });
      pollBehavior = "running";
      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: t.coreSettings.updatesUi.operationViewDetails }),
        );
      });
      const cappedModal = screen.getByRole("dialog");
      await act(async () => {
        fireEvent.click(
          within(cappedModal).getByRole("button", {
            name: t.coreSettings.updatesUi.operationRefresh,
          }),
        );
        await Promise.resolve();
      });
      const callsBeforeBoundedSession = opPollCalls;

      for (let i = 0; i < MAX_OPERATION_MODAL_POLLS + 4; i += 1) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(OPERATION_MODAL_POLL_INTERVAL_MS);
        });
      }
      expect(opPollCalls - callsBeforeBoundedSession).toBe(MAX_OPERATION_MODAL_POLLS);

      // Manual refresh remains available after automatic polling reaches its bounded cap.
      await act(async () => {
        fireEvent.click(
          within(cappedModal).getByRole("button", {
            name: t.coreSettings.updatesUi.operationRefresh,
          }),
        );
        await Promise.resolve();
      });
      expect(opPollCalls - callsBeforeBoundedSession).toBe(MAX_OPERATION_MODAL_POLLS + 1);

      // Closing modal while an automatic poll is in flight aborts the request and stops polling.
      await act(async () => {
        fireEvent.click(within(cappedModal).getAllByRole("button", { name: t.common.close })[0]!);
      });
      pollBehavior = "deferred";
      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: t.coreSettings.updatesUi.operationViewDetails }),
        );
      });
      const abortOnCloseModal = screen.getByRole("dialog");
      await act(async () => {
        await vi.advanceTimersByTimeAsync(OPERATION_MODAL_POLL_INTERVAL_MS);
      });
      expect(lastSignal?.aborted).toBe(false);
      await act(async () => {
        fireEvent.click(
          within(abortOnCloseModal).getAllByRole("button", { name: t.common.close })[0]!,
        );
      });
      expect(lastSignal?.aborted).toBe(true);
      const callsAtClose = opPollCalls;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(OPERATION_MODAL_POLL_INTERVAL_MS * 4);
      });
      expect(opPollCalls).toBe(callsAtClose);

      // Terminal status stops automatic polling immediately.
      pollBehavior = "succeeded";
      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: t.coreSettings.updatesUi.operationViewDetails }),
        );
      });
      const terminalModal = screen.getByRole("dialog");
      await act(async () => {
        await vi.advanceTimersByTimeAsync(OPERATION_MODAL_POLL_INTERVAL_MS);
      });
      expect(
        within(terminalModal).getByText(t.coreSettings.updatesUi.operationStatus.SUCCEEDED),
      ).toBeInTheDocument();
      const callsAtTerminal = opPollCalls;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(OPERATION_MODAL_POLL_INTERVAL_MS * 4);
      });
      expect(opPollCalls).toBe(callsAtTerminal);
    } finally {
      if (originalVisibilityDescriptor) {
        Object.defineProperty(document, "visibilityState", originalVisibilityDescriptor);
      } else {
        Reflect.deleteProperty(document, "visibilityState");
      }
      vi.useRealTimers();
    }
  });
});
