// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { EditDatabaseServerModal } from "./EditDatabaseServerModal";
import type { DatabaseServerView } from "../types";

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  toastSuccess: vi.fn(),
  resetKey: vi.fn(),
  onClose: vi.fn(),
  onSuccess: vi.fn(),
}));

vi.mock("../api/database-servers.api", () => ({
  databaseServersApi: { update: mocks.update },
}));
vi.mock("@/components/ui/ToastContext", () => ({
  useToast: () => ({ success: mocks.toastSuccess }),
}));
vi.mock("@/shared/hooks/useIdempotency", () => ({
  useIdempotency: () => ({
    getIdempotencyKey: () => "019f0000-0000-7000-8000-000000000002",
    resetKey: mocks.resetKey,
  }),
}));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
  useOptionalI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));

const copy = en.databaseServerDetail.editModal;
const server: DatabaseServerView = {
  id: "019f0000-0000-7000-8000-000000000001",
  deletedAt: null,
  name: "Local Tenants Database 1",
  host: "postgres-tenants",
  port: 5432,
  sslMode: "disable",
  sslRejectUnauthorized: true,
  hasSslConfig: false,
  maintenanceDatabase: "postgres",
  poolMin: 0,
  poolMax: 5,
  connectTimeoutMs: 5000,
  statementTimeoutMs: 30000,
  idleTimeoutMs: 30000,
  hasSecurityAdminCredentials: true,
  hasBackupCredentials: true,
  hasProvisioningCredentials: true,
  credentialBootstrap: { status: "READY", totalPrincipals: 2, readyPrincipals: 2 },
  systemPrincipals: [],
  maxTenants: 100,
  currentTenants: 1,
  status: "ACTIVE",
  createdAt: "2026-11-17T08:00:00.000Z",
  updatedAt: "2026-11-17T08:00:00.000Z",
};

function modal(isOpen = true, currentServer = server) {
  return (
    <EditDatabaseServerModal
      isOpen={isOpen}
      server={currentServer}
      onClose={mocks.onClose}
      onSuccess={mocks.onSuccess}
    />
  );
}

function credentialInputs() {
  return {
    username: screen.getByLabelText(copy.securityAdminUsername) as HTMLInputElement,
    password: screen.getByLabelText(copy.securityAdminPassword) as HTMLInputElement,
  };
}

function enterCredentials(username: string, password: string) {
  const inputs = credentialInputs();
  fireEvent.change(inputs.username, { target: { value: username } });
  fireEvent.change(inputs.password, { target: { value: password } });
}

function submitForm() {
  const form = screen.getByRole("button", { name: copy.save }).closest("form");
  if (!form) throw new Error("Edit Database form was not rendered.");
  fireEvent.submit(form);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.update.mockReset();
  mocks.update.mockResolvedValue(server);
});

afterEach(() => cleanup());

describe("EditDatabaseServerModal Security Admin credentials", () => {
  it("keeps existing credentials when saving metadata with both inputs untouched", async () => {
    render(modal());
    const { username, password } = credentialInputs();
    expect(username.value).toBe("");
    expect(password.value).toBe("");
    expect(password.type).toBe("password");
    expect(username.maxLength).toBe(63);
    expect(password.maxLength).toBe(1024);
    fireEvent.change(screen.getByLabelText(copy.displayName), {
      target: { value: "Renamed tenant server" },
    });

    fireEvent.click(screen.getByRole("button", { name: copy.save }));

    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    const [id, payload] = mocks.update.mock.calls[0];
    expect(id).toBe(server.id);
    expect(payload.name).toBe("Renamed tenant server");
    expect(payload).not.toHaveProperty("securityAdminCredentials");
    await waitFor(() => expect(mocks.onSuccess).toHaveBeenCalledOnce());
    expect(mocks.onClose).toHaveBeenCalledOnce();
  });

  it("omits credentials after both replacement fields are cleared", async () => {
    render(modal());
    enterCredentials("replacement_admin", "temporary-value");
    enterCredentials("", "");

    submitForm();

    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    expect(mocks.update.mock.calls[0][1]).not.toHaveProperty("securityAdminCredentials");
  });

  it("trims the submitted username while preserving every password character", async () => {
    render(modal());
    const password = "  exact password +!*  ";
    enterCredentials("  replacement_admin  ", password);

    submitForm();

    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    expect(mocks.update.mock.calls[0][1].securityAdminCredentials).toEqual({
      username: "replacement_admin",
      password,
    });
  });

  it.each([
    ["username only", "replacement_admin", ""],
    ["password only", "", "replacement-password"],
    ["whitespace username", "   ", "replacement-password"],
    ["reserved username", "pg_admin", "replacement-password"],
    ["uppercase username", "ReplacementAdmin", "replacement-password"],
    ["invalid username characters", "replacement-admin", "replacement-password"],
    ["oversized username", "a".repeat(64), "replacement-password"],
    ["oversized password", "replacement_admin", "a".repeat(1025)],
  ])("rejects %s without calling the update API", async (_name, username, password) => {
    render(modal());
    enterCredentials(username, password);

    submitForm();

    await waitFor(() => expect(screen.getAllByText(copy.credentialsError).length).toBeGreaterThan(0));
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.onClose).not.toHaveBeenCalled();
    expect(mocks.onSuccess).not.toHaveBeenCalled();
  });

  it("discards entered credentials when the modal closes and reopens", () => {
    const { rerender } = render(modal());
    enterCredentials("replacement_admin", "do-not-retain");
    fireEvent.click(screen.getByRole("button", { name: copy.cancel }));
    expect(mocks.onClose).toHaveBeenCalledOnce();

    rerender(modal(false));
    expect(screen.queryByLabelText(copy.securityAdminPassword)).toBeNull();
    rerender(modal());

    expect(credentialInputs().username.value).toBe("");
    expect(credentialInputs().password.value).toBe("");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("does not carry replacement credentials into another server's edit form", () => {
    const { rerender } = render(modal());
    enterCredentials("replacement_admin", "do-not-retain");

    rerender(modal(true, { ...server, id: "019f0000-0000-7000-8000-000000000003" }));

    expect(credentialInputs().username.value).toBe("");
    expect(credentialInputs().password.value).toBe("");
  });

  it("shows a backend credential rejection without reporting success or closing", async () => {
    const message = "Security administrator does not have the required PostgreSQL permissions.";
    mocks.update.mockRejectedValue({
      response: {
        status: 422,
        data: { success: false, errorCode: "DB_SERVER_CONNECTIVITY_FAILED", message },
      },
    });
    render(modal());
    enterCredentials("replacement_admin", "replacement-password");

    submitForm();

    expect(await screen.findByRole("alert")).toHaveTextContent(`${copy.failureTitle}: ${message}`);
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(mocks.onClose).not.toHaveBeenCalled();
    expect(mocks.onSuccess).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.resetKey).not.toHaveBeenCalled();
  });
});
