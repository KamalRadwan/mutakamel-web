// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import EmailConfigPage from "./page";

interface MockUser {
  permissions?: string[];
  permissionScopes?: Record<
    string,
    { tenantWide: boolean; companyIds: string[]; branchIds: string[] }
  >;
  featureEntitlements?: Record<string, boolean>;
}

const state = vi.hoisted(() => ({
  user: { featureEntitlements: { "crm.outbound_email": false } } as MockUser | null,
  language: "en" as "en" | "ar",
  passthroughGate: true,
  workspace: vi.fn(() => null),
  suppressions: vi.fn(() => null),
}));
vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({ user: state.user }),
}));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({
    lang: state.language,
    dir: ({ en: "ltr", ar: "rtl" } as const)[state.language],
    t: ({ en, ar })[state.language],
    setLang: vi.fn(),
    toggleLang: vi.fn(),
  }),
}));
vi.mock("@/i18n/useLanguage", () => ({ useDictionary: () => ({ en, ar })[state.language] }));
vi.mock("@/design-system", async () => {
  const actual = await vi.importActual<typeof import("@/design-system")>("@/design-system");
  return {
    ...actual,
    PermissionGate: (props: {
      require: string | string[];
      scoped?: boolean;
      denied?: boolean;
      children: ReactNode;
    }) => (state.passthroughGate ? <>{props.children}</> : <actual.PermissionGate {...props} />),
  };
});
vi.mock("./components/email-workspace", () => ({ EmailConfigWorkspace: state.workspace }));
vi.mock("./components/EmailSuppressionSection", () => ({ EmailSuppressionSection: state.suppressions }));

beforeEach(() => {
  vi.clearAllMocks();
  state.passthroughGate = true;
  state.user = { permissions: [], featureEntitlements: { "crm.outbound_email": false } };
});
afterEach(cleanup);

describe.each(["en", "ar"] as const)("email page entitlement in %s", (language) => {
  it("shows plan guidance without mounting either email section", () => {
    state.language = language;
    render(<EmailConfigPage />);
    const t = { en, ar }[language];
    expect(screen.getByText(t.coreSettings.emailNotEntitledTitle)).toBeInTheDocument();
    expect(screen.getByText(t.coreSettings.emailNotEntitledDescription)).toBeInTheDocument();
    expect(screen.queryByText(t.coreSettings.emailNotReadyTitle)).not.toBeInTheDocument();
    expect(state.workspace).not.toHaveBeenCalled();
    expect(state.suppressions).not.toHaveBeenCalled();
  });

  it("renders plan guidance safely when featureEntitlements is omitted", () => {
    state.language = language;
    state.user = { permissions: [] };
    render(<EmailConfigPage />);
    expect(screen.getByText(({ en, ar })[language].coreSettings.emailNotEntitledTitle)).toBeInTheDocument();
    expect(state.workspace).not.toHaveBeenCalled();
    expect(state.suppressions).not.toHaveBeenCalled();
  });

  it("mounts the existing email sections when entitled", () => {
    state.language = language;
    state.user = { permissions: [], featureEntitlements: { "crm.outbound_email": true } };
    render(<EmailConfigPage />);
    expect(state.workspace).toHaveBeenCalledTimes(1);
    expect(state.suppressions).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(({ en, ar })[language].coreSettings.emailNotEntitledTitle)).not.toBeInTheDocument();
  });

  it("admits tenant-wide suppression managers without outbound entitlement or config read, while denying branch-scoped managers", () => {
    state.language = language;
    state.passthroughGate = false;
    const t = { en, ar }[language];

    // 1. Tenant-wide workspace.email.manage only, crm.outbound_email: false -> mounts suppression alone.
    state.user = {
      permissions: ["workspace.email.manage"],
      permissionScopes: {
        "workspace.email.manage": { tenantWide: true, companyIds: [], branchIds: [] },
      },
      featureEntitlements: { "crm.outbound_email": false },
    };
    const { rerender } = render(<EmailConfigPage />);
    expect(state.workspace).not.toHaveBeenCalled();
    expect(state.suppressions).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(t.permissionGate.title)).not.toBeInTheDocument();
    expect(screen.queryByText(t.coreSettings.emailNotEntitledTitle)).not.toBeInTheDocument();

    // 2. Tenant-wide workspace.email.manage only, crm.outbound_email: true -> still omits config workspace without read grant.
    vi.clearAllMocks();
    state.user = {
      permissions: ["workspace.email.manage"],
      permissionScopes: {
        "workspace.email.manage": { tenantWide: true, companyIds: [], branchIds: [] },
      },
      featureEntitlements: { "crm.outbound_email": true },
    };
    rerender(<EmailConfigPage />);
    expect(state.workspace).not.toHaveBeenCalled();
    expect(state.suppressions).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(t.permissionGate.title)).not.toBeInTheDocument();

    // 3. Branch-only workspace.email.manage without workspace.email.read and unentitled -> denied via PermissionGate.
    vi.clearAllMocks();
    state.user = {
      permissions: ["workspace.email.manage"],
      permissionScopes: {
        "workspace.email.manage": { tenantWide: false, companyIds: [], branchIds: ["branch-1"] },
      },
      featureEntitlements: { "crm.outbound_email": false },
    };
    rerender(<EmailConfigPage />);
    expect(screen.getByText(t.permissionGate.title)).toBeInTheDocument();
    expect(state.workspace).not.toHaveBeenCalled();
    expect(state.suppressions).not.toHaveBeenCalled();
  });
});
