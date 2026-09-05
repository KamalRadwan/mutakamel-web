// @vitest-environment jsdom

import type { AnchorHTMLAttributes, ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { StorageServerStatus, StorageServerView } from "../types";

const SERVER_ID = "019f0000-0000-7000-8000-000000000010";

const { i18nMock, toastMock, routerMock, detailMock } = vi.hoisted(() => ({
  i18nMock: {
    lang: "en" as "ar" | "en",
    dir: "ltr" as "ltr" | "rtl",
    // StatusBadge and ConfirmActionModal read `lang`; the Dialog primitive
    // labels its close button from `t.common.close`.
    t: {
      common: { cancel: "Cancel", close: "Close" },
      storageServersList: { platformDefaultBadge: "Platform default" },
    },
  },
  toastMock: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
  routerMock: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() },
  detailMock: {
    server: null as StorageServerView | null,
    // Inlined: vi.hoisted runs before this module's own consts exist.
    loadedServerId: "019f0000-0000-7000-8000-000000000010" as string | null,
    lastProbe: null,
    currentRotation: null,
    isLoading: false,
    isMutating: false,
    error: null,
    isAuthLoading: false,
    canRead: true,
    canUpdate: true,
    canDelete: true,
    update: vi.fn(),
    activate: vi.fn(),
    probe: vi.fn(),
    offline: vi.fn(() => Promise.resolve()),
    drain: vi.fn(() => Promise.resolve()),
    rotateCredentials: vi.fn(),
    revokeCredentialRotation: vi.fn(),
    remove: vi.fn(),
    makePlatformDefault: vi.fn(),
    refresh: vi.fn(),
  },
}));

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => i18nMock,
  useOptionalI18n: () => i18nMock,
}));
vi.mock("@/components/ui/ToastContext", () => ({ useToast: () => toastMock }));
vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: { href: string; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("../hooks/useStorageServerDetail", () => ({
  useStorageServerDetail: () => detailMock,
}));

import { StorageServerDetailScreen } from "./StorageServerDetailScreen";

function makeServer(
  status: StorageServerStatus,
  overrides: Partial<StorageServerView> = {},
): StorageServerView {
  return {
    id: SERVER_ID,
    code: "garage-cairo-1",
    name: "Garage Cairo",
    endpoint: "https://s3.cairo.example.com",
    region: "eg-cairo-1",
    bucketName: "mutakamel-cairo",
    status,
    maxTenants: 100,
    isPlatformDefault: false,
    assignedTenants: 0,
    credentialsConfigured: true,
    configRevision: 4,
    credentialRotatedAt: "2026-08-01T09:00:00.000Z",
    credentialRotationDueAt: "2026-11-01T09:00:00.000Z",
    lastConnectionTestStatus: "PASSED",
    lastConnectionTestedAt: "2026-09-05T06:00:00.000Z",
    lastConnectionTestErrorCode: null,
    connectionEvidenceFresh: true,
    connectionEvidenceExpiresAt: "2026-09-06T06:00:00.000Z",
    nextAutomaticProbeDueAt: "2026-09-05T18:00:00.000Z",
    createdAt: "2026-07-01T09:00:00.000Z",
    updatedAt: "2026-09-05T06:00:00.000Z",
    ...overrides,
  };
}

/**
 * FE-SR02. Core's `takeOffline` puts no restriction on the source status: it
 * refuses only the platform default and a server that still holds tenants,
 * bytes or open storage operations. `activate` and `remove` both accept
 * `DRAFT`/`OFFLINE` alone, so `OFFLINE` is the single exit from `DRAINING`.
 * While the screen showed Take offline for `ACTIVE` only, an evacuated server
 * had no portal action left and stayed `DRAINING` permanently.
 */
describe("StorageServerDetailScreen draining lifecycle", () => {
  beforeEach(() => {
    i18nMock.lang = "en";
    i18nMock.dir = "ltr";
    detailMock.isMutating = false;
    detailMock.canUpdate = true;
    detailMock.canDelete = true;
    detailMock.offline.mockClear();
    detailMock.drain.mockClear();
    toastMock.success.mockClear();
  });

  it("offers Take offline for a fully drained server so decommissioning can finish", async () => {
    detailMock.server = makeServer("DRAINING", { assignedTenants: 0 });
    render(<StorageServerDetailScreen id={SERVER_ID} />);
    // The screen clears editor/confirmation state in a mount-time microtask.
    // Let it run before opening anything, or it closes what we just opened.
    await act(async () => {
      await Promise.resolve();
    });

    const takeOffline = screen.getByRole("button", { name: /Take offline/ });
    expect(takeOffline).toBeEnabled();

    fireEvent.click(takeOffline);
    const confirmation = await screen.findByRole("alertdialog", {
      name: "Take storage server offline",
    });
    expect(confirmation).toBeInTheDocument();
    // `requireNameTyping` is false for offline, so Confirm is live immediately.
    fireEvent.click(screen.getByRole("button", { name: "Confirm Action" }));

    await waitFor(() => expect(detailMock.offline).toHaveBeenCalledTimes(1));
  });

  it("leaves a draining server no other way out, which is why offline must be offered", () => {
    detailMock.server = makeServer("DRAINING", { assignedTenants: 0 });
    render(<StorageServerDetailScreen id={SERVER_ID} />);

    // Core's startDraining accepts ACTIVE only, activate accepts DRAFT/OFFLINE
    // only, and delete accepts an unassigned DRAFT/OFFLINE only.
    expect(screen.queryByRole("button", { name: /^Drain/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Test & activate/ })).toBeNull();
    expect(
      screen.getByRole("button", { name: /Delete storage server/ }),
    ).toBeDisabled();
  });

  it("still withholds Take offline from the platform default while it drains", () => {
    detailMock.server = makeServer("DRAINING", { isPlatformDefault: true });
    render(<StorageServerDetailScreen id={SERVER_ID} />);

    expect(screen.queryByRole("button", { name: /Take offline/ })).toBeNull();
  });

  it("keeps Take offline on an ACTIVE server", () => {
    detailMock.server = makeServer("ACTIVE");
    render(<StorageServerDetailScreen id={SERVER_ID} />);

    expect(
      screen.getByRole("button", { name: /Take offline/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Drain/ })).toBeInTheDocument();
  });

  it("shows no lifecycle command for a DRAFT server beyond activation", () => {
    detailMock.server = makeServer("DRAFT");
    render(<StorageServerDetailScreen id={SERVER_ID} />);

    expect(screen.queryByRole("button", { name: /Take offline/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Drain/ })).toBeNull();
    expect(
      screen.getByRole("button", { name: /Test & activate/ }),
    ).toBeInTheDocument();
  });
});
