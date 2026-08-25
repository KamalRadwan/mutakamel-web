import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}));

vi.mock("@/lib/api/axiosClient", () => ({
  axiosClient: { get: getMock, post: postMock },
}));

import {
  componentQuery,
  PROVISIONING_GOVERNANCE_ROOT,
  provisioningGovernanceApi,
  releaseQuery,
} from "./api";
import {
  COMPONENT_ID,
  CORRELATION_ID,
  RUN_ID,
  componentEnvelope,
  discoveryDetailEnvelope,
  discoveryRunEnvelope,
  releaseEnvelope,
} from "./test-fixtures";

describe("provisioning governance API", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
  });

  it("uses the canonical component and release paths with deterministic full queries", async () => {
    getMock
      .mockResolvedValueOnce({ data: componentEnvelope() })
      .mockResolvedValueOnce({ data: releaseEnvelope() });
    const signal = new AbortController().signal;

    await provisioningGovernanceApi.listComponents(
      {
        ownerApp: "core-app",
        sortDir: "DESC",
        limit: 50,
        page: 2,
        sortBy: "updatedAt",
        componentKey: "core.identity",
        kind: "FOUNDATION",
        search: "identity",
      },
      signal,
    );
    await provisioningGovernanceApi.listComponentReleases(
      COMPONENT_ID,
      {
        requiresMaintenance: false,
        requiresBackup: true,
        selfServiceAllowed: false,
        riskLevel: "HIGH",
        search: "1.2",
        sortDir: "ASC",
        sortBy: "riskLevel",
        limit: 100,
        page: 1,
      },
      signal,
    );

    expect(getMock).toHaveBeenNthCalledWith(
      1,
      `${PROVISIONING_GOVERNANCE_ROOT}/components?page=2&limit=50&sortBy=updatedAt&sortDir=DESC&search=identity&componentKey=core.identity&ownerApp=core-app&kind=FOUNDATION`,
      { cache: "no-store", signal },
    );
    expect(getMock).toHaveBeenNthCalledWith(
      2,
      `${PROVISIONING_GOVERNANCE_ROOT}/components/${COMPONENT_ID}/releases?page=1&limit=100&sortBy=riskLevel&sortDir=ASC&search=1.2&riskLevel=HIGH&selfServiceAllowed=false&requiresBackup=true&requiresMaintenance=false`,
      { cache: "no-store", signal },
    );
  });

  it("loads exact discovery detail and posts a caller-owned command identity", async () => {
    getMock.mockResolvedValue({ data: discoveryDetailEnvelope() });
    postMock.mockResolvedValue({ data: discoveryRunEnvelope() });
    const command = {
      mode: "DRY_RUN" as const,
      cutoffAt: "2020-01-01T00:00:00.000Z",
      maxTenants: 500,
    };

    const detail = await provisioningGovernanceApi.getDiscoveryRun(RUN_ID);
    const created = await provisioningGovernanceApi.createDiscoveryRun(
      command,
      CORRELATION_ID,
    );

    expect(detail.runId).toBe(RUN_ID);
    expect(created.runId).toBe(RUN_ID);
    expect(getMock).toHaveBeenCalledWith(
      `${PROVISIONING_GOVERNANCE_ROOT}/discovery-runs/${RUN_ID}`,
      { cache: "no-store" },
    );
    expect(postMock).toHaveBeenCalledWith(
      `${PROVISIONING_GOVERNANCE_ROOT}/discovery-runs`,
      command,
      {
        headers: { "x-idempotency-key": CORRELATION_ID },
        skipAutoIdempotency: true,
        replayAfterRefresh: true,
        cache: "no-store",
      },
    );
  });

  it.each([
    { page: 0, limit: 20, sortBy: "key", sortDir: "ASC" },
    { page: 1, limit: 101, sortBy: "key", sortDir: "ASC" },
    { page: 1, limit: 20, sortBy: "unknown", sortDir: "ASC" },
    {
      page: 1,
      limit: 20,
      sortBy: "key",
      sortDir: "ASC",
      ownerApp: "Core App",
    },
    {
      page: 1,
      limit: 20,
      sortBy: "key",
      sortDir: "ASC",
      unknown: "leak",
    },
  ])("rejects an out-of-contract component query: %o", (query) => {
    expect(() =>
      componentQuery(query as Parameters<typeof componentQuery>[0]),
    ).toThrow("INVALID_COMPONENT_QUERY");
  });

  it.each([
    { page: 1, limit: 20, sortBy: "publishedAt", sortDir: "SIDEWAYS" },
    {
      page: 1,
      limit: 20,
      sortBy: "publishedAt",
      sortDir: "DESC",
      requiresBackup: "true",
    },
  ])("rejects an out-of-contract release query: %o", (query) => {
    expect(() =>
      releaseQuery(query as Parameters<typeof releaseQuery>[0]),
    ).toThrow("INVALID_RELEASE_QUERY");
  });

  it("rejects malformed path IDs and expanded or future commands before transport", async () => {
    await expect(
      provisioningGovernanceApi.getDiscoveryRun(
        "00000000-0000-4000-8000-000000000000",
      ),
    ).rejects.toThrow("INVALID_DISCOVERY_RUN_ID");
    await expect(
      provisioningGovernanceApi.createDiscoveryRun(
        {
          mode: "MANUAL",
          cutoffAt: "2999-01-01T00:00:00.000Z",
          maxTenants: 1,
          leaked: true,
        } as Parameters<typeof provisioningGovernanceApi.createDiscoveryRun>[0],
        CORRELATION_ID,
      ),
    ).rejects.toThrow("INVALID_DISCOVERY_COMMAND");
    expect(getMock).not.toHaveBeenCalled();
    expect(postMock).not.toHaveBeenCalled();
  });
});
