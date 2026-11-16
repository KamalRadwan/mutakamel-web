// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, detailHookMock } = vi.hoisted(() => ({
  authMock: {
    user: { isSuperAdmin: false, permissions: [] as string[] },
    isLoading: false,
  },
  detailHookMock: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => authMock }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({
    lang: "en",
    dir: "ltr",
    t: {
      databaseServerDetail: {
        checkingAccess: "Checking database-server access...",
        forbiddenTitle: "You do not have permission to view this database server.",
        drainConnections: "Drain connections",
        drainConnectionsDescription: "Disconnect tenant traffic from this server.",
        takeOffline: "Take offline",
        takeOfflineDescription: "Take this server offline.",
        activateServer: "Activate server",
        activateServerDescription: "Activate this server.",
      },
    },
  }),
}));
vi.mock(
  "@/features/admin/database-servers/hooks/useDatabaseServerDetailPage",
  () => ({ useDatabaseServerDetailPage: detailHookMock }),
);
vi.mock("@/features/admin/database-servers/components/EditDatabaseServerModal", () => ({
  EditDatabaseServerModal: () => null,
}));
vi.mock("@/features/admin/database-servers/components/DatabaseCredentialActionDialog", () => ({
  DatabaseCredentialActionDialog: () => null,
}));
vi.mock("@/features/admin/database-servers/components/AddDatabaseApplicationDialog", () => ({
  AddDatabaseApplicationDialog: () => null,
}));
vi.mock("@/features/admin/database-servers/components/DatabaseServerHeaderHero", () => ({
  DatabaseServerHeaderHero: () => null,
}));
vi.mock("@/features/admin/database-servers/components/DatabaseServerTabsNav", () => ({
  DatabaseServerTabsNav: () => null,
}));

import DatabaseServerDetailPage from "./page";

const RESOLVED_PARAMS = Object.assign(
  Promise.resolve({ id: "019f0000-0000-7000-8000-000000000001" }),
  {
    status: "fulfilled" as const,
    value: { id: "019f0000-0000-7000-8000-000000000001" },
  },
);

describe("DatabaseServerDetailPage read preflight", () => {
  beforeEach(() => {
    authMock.user = { isSuperAdmin: false, permissions: [] };
    authMock.isLoading = false;
    detailHookMock.mockReset();
  });

  it("does not mount any detail API hooks without read permission", () => {
    render(<DatabaseServerDetailPage params={RESOLVED_PARAMS} />);

    expect(
      screen.getByRole("heading", {
        name: "You do not have permission to view this database server.",
      }),
    ).toBeInTheDocument();
    expect(detailHookMock).not.toHaveBeenCalled();
  });

  it("does not mount detail hooks while authorization is unresolved", () => {
    authMock.isLoading = true;
    render(<DatabaseServerDetailPage params={RESOLVED_PARAMS} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Checking database-server access",
    );
    expect(detailHookMock).not.toHaveBeenCalled();
  });

  function renderLifecycle(action: "drain" | "offline" | "activate") {
    authMock.user.permissions = ["admin.database_servers.read"];
    const handleLifecycleConfirm = vi.fn();
    detailHookMock.mockReturnValue({
      server: {
        id: RESOLVED_PARAMS.value.id,
        name: "Shared database server",
        credentialBootstrap: { status: "READY" },
      },
      loadedServerId: RESOLVED_PARAMS.value.id,
      lifecycleAction: action,
      handleLifecycleConfirm,
      credentialAction: null,
      isDeleteModalOpen: false,
      bindings: [],
      history: [],
    });
    render(<DatabaseServerDetailPage params={RESOLVED_PARAMS} />);
    return handleLifecycleConfirm;
  }

  it.each(["drain", "offline"] as const)(
    "requires the exact server name before confirming %s",
    async (action) => {
      const confirm = renderLifecycle(action);
      const button = screen.getByRole("button", { name: "Confirm Action" });
      const input = screen.getByRole("textbox", { name: "Type the exact name to confirm" });
      // Let the modal's open effect clear any previous confirmation first.
      await waitFor(() => expect(input).toHaveValue(""));
      expect(button).toBeDisabled();
      fireEvent.click(button);
      expect(confirm).not.toHaveBeenCalled();

      fireEvent.change(input, { target: { value: "Shared database" } });
      expect(button).toBeDisabled();
      fireEvent.change(input, { target: { value: "Shared database server" } });
      expect(button).toBeEnabled();
      fireEvent.click(button);
      expect(confirm).toHaveBeenCalledTimes(1);
    },
  );

  it("keeps activation available without typing a server name", () => {
    const confirm = renderLifecycle("activate");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Confirm Action" });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(confirm).toHaveBeenCalledTimes(1);
  });
});
