// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDatabaseServerDetailPage } from "./useDatabaseServerDetailPage";

// Mock dependencies
const mockReplace = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: vi.fn() }),
  usePathname: () => "/database-servers/db-1",
  useSearchParams: () => mockSearchParams,
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { permissions: ["admin.database_servers.update", "admin.database_servers.delete", "admin.database_servers.update.critical", "admin.database_servers.delete.critical"], isSuperAdmin: true } }),
}));

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({
    lang: "en",
    dir: "ltr",
    t: {
      databaseServerDetail: {
        tabs: {
          overview: "Overview & Metrics",
          readiness: "Access Readiness & System Principals",
          bindings: "Application Bindings",
          security: "Security & SSL",
          history: "Audit & History",
        },
      },
    },
  }),
}));

vi.mock("./useDatabaseServerDetail", () => ({
  useDatabaseServerDetail: (id: string) => ({
    server: {
      id,
      name: "PG Test Host",
      host: "10.0.0.1",
      port: 5432,
      maxTenants: 100,
      currentTenants: 12,
      status: "ACTIVE",
      sslMode: "require",
      connectTimeoutMs: 5000,
      credentialBootstrap: { status: "READY", readyPrincipals: 2, totalPrincipals: 2 },
      systemPrincipals: [],
      hasBackupCredentials: true,
      createdAt: "2026-08-01T00:00:00Z",
    },
    bindings: [
      { applicationId: "app-1", applicationName: "CRM", applicationKey: "crm", databasePrincipal: "crm_user", status: "READY", credentialRevision: 1, rotationEnabled: false },
      { applicationId: "app-2", applicationName: "Billing", applicationKey: "billing", databasePrincipal: "billing_user", status: "READY", credentialRevision: 2, rotationEnabled: true, rotationIntervalHours: 24 },
    ],
    history: [],
    isLoading: false,
    error: null,
    fetchServer: vi.fn(),
    fetchBindings: vi.fn(),
    fetchHistory: vi.fn(),
    isBindingsLoading: false,
    bindingsError: null,
    isHistoryLoading: false,
    historyError: null,
    activateServer: vi.fn(),
    drainServer: vi.fn(),
    offlineServer: vi.fn(),
    deleteServer: vi.fn(),
    lastCredentialReceipt: null,
    credentialActionPending: null,
    credentialAction: null,
    credentialReason: "",
    credentialActionError: null,
    openRetryBootstrap: vi.fn(),
    openCredentialMutation: vi.fn(),
    openSystemCredentialMutation: vi.fn(),
    closeCredentialAction: vi.fn(),
    setCredentialReason: vi.fn(),
    submitCredentialAction: vi.fn(),
    bootstrapApplication: vi.fn(),
    updateProvisioningRotationPolicy: vi.fn(),
  }),
}));

describe("useDatabaseServerDetailPage presentation hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes with overview tab by default and provides filtered bindings", () => {
    const { result } = renderHook(() => useDatabaseServerDetailPage("db-1"));

    expect(result.current.activeTab).toBe("overview");
    expect(result.current.bindings).toHaveLength(2);
    expect(result.current.filteredBindings).toHaveLength(2);
    expect(result.current.canUpdate).toBe(true);
    expect(result.current.canDelete).toBe(true);
  });

  it("filters application bindings when search query is typed", () => {
    const { result } = renderHook(() => useDatabaseServerDetailPage("db-1"));

    act(() => {
      result.current.setBindingsSearch("crm");
    });

    expect(result.current.filteredBindings).toHaveLength(1);
    expect(result.current.filteredBindings[0].applicationName).toBe("CRM");
  });

  it("switches active tab and updates search params", () => {
    const { result } = renderHook(() => useDatabaseServerDetailPage("db-1"));

    act(() => {
      result.current.setActiveTab("bindings");
    });

    expect(mockReplace).toHaveBeenCalledWith("/database-servers/db-1?tab=bindings", { scroll: false });
  });
});
