// @vitest-environment jsdom

import { cleanup, render, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { useCoreSettingsEntryRedirect } from "./hooks/useCoreSettingsEntryRedirect";
import CoreSettingsPage from "./page";

const replaceMock = vi.hoisted(() => vi.fn());

const state = vi.hoisted(() => ({
  isLoading: false,
  user: {
    isTenantOwner: false,
    permissions: [] as string[],
    featureEntitlements: {} as Record<string, boolean>,
  } as {
    isTenantOwner: boolean;
    permissions: string[];
    featureEntitlements: Record<string, boolean>;
  } | null,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({
    isLoading: state.isLoading,
    user: state.user,
  }),
}));

beforeEach(() => {
  state.isLoading = false;
  state.user = {
    isTenantOwner: false,
    permissions: [],
    featureEntitlements: { "crm.outbound_email": true },
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CoreSettingsPage redirect", () => {
  it("redirects to Workspace settings by default when workspace.read is available", async () => {
    state.user = {
      isTenantOwner: true,
      permissions: [
        "workspace.read",
        "currencies.currency.read",
        "taxes.tax.read",
        "numbering.read",
        "workspace.email.read",
        "branding.read",
      ],
      featureEntitlements: { "crm.outbound_email": true },
    };

    const { container } = render(<CoreSettingsPage />);
    expect(container.firstChild).toBeNull();

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith(TENANT_ROUTES.coreSettingsWorkspace);
    });
  });

  it.each([
    [
      ["currencies.currency.read", "branding.read"],
      TENANT_ROUTES.coreSettingsCurrencies,
    ],
    [
      ["taxes.tax.read", "numbering.read"],
      TENANT_ROUTES.coreSettingsTaxes,
    ],
    [
      ["numbering.read", "branding.read"],
      TENANT_ROUTES.coreSettingsNumbering,
    ],
    [
      ["branding.read"],
      TENANT_ROUTES.coreSettingsBranding,
    ],
  ] as const)(
    "redirects restricted permissions %j to first accessible settings entry %s",
    async (permissions, expectedHref) => {
      state.user = {
        isTenantOwner: false,
        permissions: [...permissions],
        featureEntitlements: { "crm.outbound_email": true },
      };

      render(<CoreSettingsPage />);

      await waitFor(() => {
        expect(replaceMock).toHaveBeenCalledWith(expectedHref);
      });
    },
  );

  it("redirects to Email settings only when both workspace.email.read and crm.outbound_email entitlement are present", async () => {
    state.user = {
      isTenantOwner: false,
      permissions: ["workspace.email.read"],
      featureEntitlements: { "crm.outbound_email": true },
    };

    render(<CoreSettingsPage />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith(TENANT_ROUTES.coreSettingsEmail);
    });
  });

  it("skips Email settings when crm.outbound_email entitlement is false even for a tenant owner", async () => {
    state.user = {
      isTenantOwner: true,
      permissions: ["workspace.email.read", "branding.read"],
      featureEntitlements: { "crm.outbound_email": false },
    };

    render(<CoreSettingsPage />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith(TENANT_ROUTES.coreSettingsBranding);
    });
  });

  it("redirects to /unavailable when workspace.email.read is held without crm.outbound_email entitlement and no fallback exists", async () => {
    state.user = {
      isTenantOwner: true,
      permissions: ["workspace.email.read"],
      featureEntitlements: { "crm.outbound_email": false },
    };

    render(<CoreSettingsPage />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/unavailable");
    });
  });

  it("redirects to /unavailable when crm.outbound_email entitlement is true without workspace.email.read", async () => {
    state.user = {
      isTenantOwner: true,
      permissions: [],
      featureEntitlements: { "crm.outbound_email": true },
    };

    render(<CoreSettingsPage />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/unavailable");
    });
  });

  it("redirects to Email settings for workspace.email.manage even when crm.outbound_email entitlement is false", async () => {
    state.user = {
      isTenantOwner: false,
      permissions: ["workspace.email.manage"],
      featureEntitlements: { "crm.outbound_email": false },
    };

    render(<CoreSettingsPage />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith(TENANT_ROUTES.coreSettingsEmail);
    });
  });

  it("redirects to /unavailable when no settings entries are accessible", async () => {
    state.user = {
      isTenantOwner: false,
      permissions: ["notifications.notification.read"],
      featureEntitlements: {},
    };

    render(<CoreSettingsPage />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/unavailable");
    });
  });

  it("waits until auth loading finishes before replacing the route", () => {
    state.isLoading = true;
    state.user = null;

    render(<CoreSettingsPage />);

    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("exposes redirect behavior directly through useCoreSettingsEntryRedirect", async () => {
    state.user = {
      isTenantOwner: false,
      permissions: ["taxes.tax.read", "branding.read"],
      featureEntitlements: { "crm.outbound_email": false },
    };

    renderHook(() => useCoreSettingsEntryRedirect());

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith(TENANT_ROUTES.coreSettingsTaxes);
    });
  });
});
