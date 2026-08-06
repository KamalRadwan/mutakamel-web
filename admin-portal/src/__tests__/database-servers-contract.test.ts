import { describe, it, expect, vi, beforeEach } from "vitest";
import { databaseServersApi } from "@/features/admin/database-servers/api/database-servers.api";
import { axiosClient } from "@/lib/api/axiosClient";
import { generateUUIDv7 } from "@/lib/utils/uuid";
import type { CheckDatabaseServerConnectivityDto, CreateDatabaseServerDto } from "@/features/admin/database-servers/types";
import type { AxiosResponse } from "@/lib/api/axiosClient";

vi.mock("@/lib/api/axiosClient");

const asAxiosResponse = (value: unknown) => value as AxiosResponse<unknown>;

describe("Database Servers API Contract Tests (15 Routes)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("1. GET /api/admin/core/v1/database-servers - lists database servers", async () => {
    const mockData = {
      data: {
        success: true,
        data: [{ id: "db-1", name: "PG Main", host: "10.0.0.1", port: 5432, status: "ACTIVE" }],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrev: false }
      }
    };
    vi.mocked(axiosClient.get).mockResolvedValueOnce(asAxiosResponse(mockData));

    const result = await databaseServersApi.list({ page: 1, limit: 20 });
    expect(axiosClient.get).toHaveBeenCalledWith("/api/admin/core/v1/database-servers?page=1&limit=20");
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe("db-1");
  });

  it("2. POST /api/admin/core/v1/database-servers/check-connectivity - tests connection with idempotency key", async () => {
    const mockData = {
      data: {
        success: true,
        data: { connected: true, message: "OK" }
      }
    };
    vi.mocked(axiosClient.post).mockResolvedValueOnce(asAxiosResponse(mockData));

    const key = generateUUIDv7();
    const dto = {
      host: "10.0.0.1",
      port: 5432,
      securityAdminCredentials: { username: "mutakamel_security_admin", password: "secret" }
    };
    const result = await databaseServersApi.checkConnectivity(dto satisfies CheckDatabaseServerConnectivityDto, key);

    expect(axiosClient.post).toHaveBeenCalledWith(
      "/api/admin/core/v1/database-servers/check-connectivity",
      dto,
      { headers: { "x-idempotency-key": key } }
    );
    expect(result.connected).toBe(true);
  });

  it("3. POST /api/admin/core/v1/database-servers - creates server with idempotency key", async () => {
    const mockData = {
      data: {
        success: true,
        data: { id: "db-2", name: "PG Replica", host: "10.0.0.2", port: 5432, maxTenants: 100, status: "DRAFT" }
      }
    };
    vi.mocked(axiosClient.post).mockResolvedValueOnce(asAxiosResponse(mockData));

    const key = generateUUIDv7();
    const dto = {
      name: "PG Replica",
      host: "10.0.0.2",
      maxTenants: 100,
      securityAdminCredentials: { username: "mutakamel_security_admin", password: "secret" }
    };
    const result = await databaseServersApi.create(dto satisfies CreateDatabaseServerDto, key);

    expect(axiosClient.post).toHaveBeenCalledWith(
      "/api/admin/core/v1/database-servers",
      dto,
      { headers: { "x-idempotency-key": key } }
    );
    expect(result.id).toBe("db-2");
  });

  it("4. GET /api/admin/core/v1/database-servers/:id - detail response", async () => {
    const mockData = {
      data: {
        success: true,
        data: { id: "db-1", name: "PG Main", host: "10.0.0.1", port: 5432, status: "ACTIVE" }
      }
    };
    vi.mocked(axiosClient.get).mockResolvedValueOnce(asAxiosResponse(mockData));

    const result = await databaseServersApi.get("db-1");
    expect(axiosClient.get).toHaveBeenCalledWith("/api/admin/core/v1/database-servers/db-1");
    expect(result.id).toBe("db-1");
  });

  it("5. GET /api/admin/core/v1/database-servers/:id/history - history logs", async () => {
    const mockData = {
      data: {
        success: true,
        data: [{ id: "h-1", action: "ACTIVATE", createdAt: "2026-08-02T12:00:00Z" }]
      }
    };
    vi.mocked(axiosClient.get).mockResolvedValueOnce(asAxiosResponse(mockData));

    const result = await databaseServersApi.getHistory("db-1");
    expect(axiosClient.get).toHaveBeenCalledWith("/api/admin/core/v1/database-servers/db-1/history");
    expect(result[0].action).toBe("ACTIVATE");
  });

  it("6. DELETE /api/admin/core/v1/database-servers/:id - deletes server with idempotency header", async () => {
    vi.mocked(axiosClient.delete).mockResolvedValueOnce(asAxiosResponse({}));
    const key = generateUUIDv7();

    await databaseServersApi.delete("db-1", key);
    expect(axiosClient.delete).toHaveBeenCalledWith("/api/admin/core/v1/database-servers/db-1", {
      headers: { "x-idempotency-key": key }
    });
  });
});
