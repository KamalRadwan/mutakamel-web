// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CreateDatabaseServerWizard } from "./CreateDatabaseServerWizard";

const mocks = vi.hoisted(() => ({
  checkConnectivity: vi.fn(),
  createServer: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock("../hooks/useDatabaseServers", () => ({
  useDatabaseServers: () => ({
    createServer: mocks.createServer,
    checkConnectivity: mocks.checkConnectivity,
  }),
}));

beforeEach(() => {
  mocks.checkConnectivity.mockReset();
  mocks.createServer.mockReset();
  mocks.push.mockReset();
  mocks.checkConnectivity.mockResolvedValue({
    connected: true,
    message: "connected",
    checks: [
      { principal: "securityAdmin", connected: true, message: "connected" },
    ],
  });
});

afterEach(() => {
  cleanup();
});

function enterValidConnectionAndCredentials(password = "secret") {
  fireEvent.change(screen.getByLabelText("Server Name"), {
    target: { value: "Local PostgreSQL" },
  });
  fireEvent.change(screen.getByLabelText("Host"), {
    target: { value: "postgres" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Next: Credentials" }));
  fireEvent.change(screen.getByLabelText("Security Admin Username"), {
    target: { value: "mutakamel_security_admin" },
  });
  fireEvent.change(screen.getByLabelText("Security Admin Password"), {
    target: { value: password },
  });
}

describe("CreateDatabaseServerWizard", () => {
  it("wires Core DTO bounds into the create inputs and eligibility flow", async () => {
    render(<CreateDatabaseServerWizard />);

    const name = screen.getByLabelText("Server Name") as HTMLInputElement;
    const host = screen.getByLabelText("Host") as HTMLInputElement;
    const port = screen.getByLabelText("Port") as HTMLInputElement;
    const maxTenants = screen.getByLabelText(
      "Max Tenants Capacity",
    ) as HTMLInputElement;

    expect(name.required).toBe(true);
    expect(name.minLength).toBe(1);
    expect(name.maxLength).toBe(120);
    expect(host.required).toBe(true);
    expect(host.minLength).toBe(1);
    expect(host.maxLength).toBe(255);
    expect(port.min).toBe("1");
    expect(port.max).toBe("65535");
    expect(port.step).toBe("1");
    expect(maxTenants.min).toBe("1");
    expect(maxTenants.max).toBe("100000");

    const next = screen.getByRole("button", { name: "Next: Credentials" }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    fireEvent.change(name, { target: { value: "Local PostgreSQL" } });
    fireEvent.change(host, { target: { value: "postgres" } });
    expect(next.disabled).toBe(false);
    fireEvent.click(next);

    const username = screen.getByLabelText(
      "Security Admin Username",
    ) as HTMLInputElement;
    const password = screen.getByLabelText(
      "Security Admin Password",
    ) as HTMLInputElement;
    expect(username.minLength).toBe(1);
    expect(username.maxLength).toBe(63);
    expect(username.pattern).toBe("^(?!pg_)[a-z_][a-z0-9_]{0,62}$");
    expect(password.minLength).toBe(1);
    expect(password.maxLength).toBe(1024);
    expect(document.body.textContent).toContain("must not start with pg_");

    fireEvent.change(username, {
      target: { value: "mutakamel_security_admin" },
    });
    fireEvent.change(password, { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Test Connectivity" }));

    expect(await screen.findByText("Connectivity Verified")).not.toBeNull();
    expect(document.body.textContent).toContain("ACTIVE + PUBLISHED");
    expect(mocks.checkConnectivity).toHaveBeenCalledTimes(1);
  });

  it("renders safe Gateway Problem Details diagnostics for connectivity failures", async () => {
    const secret = "gateway-test-secret";
    mocks.checkConnectivity.mockRejectedValueOnce({
      response: {
        status: 503,
        data: {
          type: "https://errors.mutakamel.ai/gw/upstream/unavailable",
          title: "Database registration unavailable",
          status: 503,
          code: "GW.UPSTREAM.UNAVAILABLE",
          detail: "The registration dependency is temporarily unavailable.",
          instance: "/api/admin/core/v1/database-servers/check-connectivity",
          correlationId: "019fdb00-0000-7000-8000-000000000001",
        },
      },
    });

    render(<CreateDatabaseServerWizard />);
    enterValidConnectionAndCredentials(secret);
    fireEvent.click(screen.getByRole("button", { name: "Test Connectivity" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(
      "Database registration unavailable: The registration dependency is temporarily unavailable.",
    );
    expect(alert.textContent).toContain("GW.UPSTREAM.UNAVAILABLE");
    expect(alert.textContent).toContain(
      "Correlation ID: 019fdb00-0000-7000-8000-000000000001",
    );
    expect(alert.textContent).not.toContain(secret);
    expect(alert.textContent).not.toContain("check-connectivity");
  });

  it("renders safe Core envelope diagnostics when registration loses its lease", async () => {
    const secret = "core-test-secret";
    mocks.createServer.mockRejectedValueOnce({
      response: {
        status: 503,
        data: {
          success: false,
          statusCode: 503,
          errorCode: "DB_SERVER_REGISTRATION_LEASE_LOST",
          errorCategory: "SERVER_ERROR",
          message: "Database Server registration lease was lost.",
          correlationId: "019fdb00-0000-7000-8000-000000000002",
          timestamp: "2026-08-06T00:00:00.000Z",
          path: "/api/v1/admin/database-servers",
        },
      },
    });

    render(<CreateDatabaseServerWizard />);
    enterValidConnectionAndCredentials(secret);
    fireEvent.click(screen.getByRole("button", { name: "Test Connectivity" }));
    expect(await screen.findByText("Connectivity Verified")).not.toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Create & Generate Access" }),
    );

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(
      "Database Server registration lease was lost.",
    );
    expect(alert.textContent).toContain("DB_SERVER_REGISTRATION_LEASE_LOST");
    expect(alert.textContent).toContain(
      "Correlation ID: 019fdb00-0000-7000-8000-000000000002",
    );
    expect(alert.textContent).not.toContain(secret);
    expect(alert.textContent).not.toContain("/api/v1/admin/database-servers");
  });
});
