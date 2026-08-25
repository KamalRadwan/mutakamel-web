import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}));

vi.mock("@/lib/api/axiosClient", () => ({
  axiosClient: { get: getMock, post: postMock },
}));

import { tenantProvisioningApi } from "./tenant-provisioning.api";
import {
  COMMAND_ID,
  COMPONENT_ID,
  INSTALLATION_ID,
  META,
  OPERATION_ID,
  RELEASE_ID,
  SEED_ID,
  SHA_A,
  SHA_B,
  TARGET_RELEASE_ID,
  TENANT_ID,
  availableUpdate,
  componentInstallation,
  managedOperation,
  operationDetail,
  operationSummary,
  prerequisiteEvidenceRecord,
  prerequisiteRequest,
  seedResolution,
  seedState,
  timelineEvent,
} from "../test/fixtures";

const envelope = (data: unknown, meta?: unknown) => ({
  data: { success: true, data, ...(meta ? { meta } : {}) },
});

describe("tenant provisioning canonical API", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    getMock.mockImplementation((url: string) => {
      if (url.includes("/timeline")) return Promise.resolve(envelope([timelineEvent()], META));
      if (/\/operations\/[^/?]+$/u.test(url)) return Promise.resolve(envelope(operationDetail()));
      if (url.includes("/operations")) return Promise.resolve(envelope([operationSummary()], META));
      if (url.includes("/updates")) return Promise.resolve(envelope([availableUpdate()], META));
      if (url.includes("/prerequisite-evidence")) return Promise.resolve(envelope([prerequisiteEvidenceRecord()]));
      if (url.includes("/provisioning-state/components")) return Promise.resolve(envelope([componentInstallation()], META));
      if (url.includes("/provisioning-state/seeds")) return Promise.resolve(envelope([seedState()], META));
      throw new Error(`unexpected GET ${url}`);
    });
    postMock.mockImplementation((url: string) => {
      if (url.endsWith("/retry") || url.endsWith("/cancel") || url.endsWith("/updates/apply")) {
        return Promise.resolve(envelope({ replayed: false, operation: operationDetail() }));
      }
      if (url.endsWith("/prerequisite-requests")) return Promise.resolve(envelope(prerequisiteRequest()));
      if (url.endsWith("/operations/add-application")) return Promise.resolve(envelope(managedOperation({ type: "ADD_APPLICATION" })));
      if (url.endsWith("/operations/repair")) return Promise.resolve(envelope(managedOperation({ type: "REPAIR" })));
      if (url.endsWith("/operations/decommission")) return Promise.resolve(envelope(managedOperation({ type: "DECOMMISSION" })));
      if (url.includes("/seed-conflicts/")) return Promise.resolve(envelope(seedResolution()));
      throw new Error(`unexpected POST ${url}`);
    });
  });

  it("uses all seven actual no-store read routes with exact server query names", async () => {
    const signal = new AbortController().signal;
    await tenantProvisioningApi.listOperations(
      TENANT_ID,
      { page: 2, limit: 20, type: "UPDATE", status: "RUNNING", sortBy: "generation", sortDir: "DESC" },
      signal,
    );
    await tenantProvisioningApi.getOperation(TENANT_ID, OPERATION_ID, signal);
    await tenantProvisioningApi.listTimeline(
      TENANT_ID,
      OPERATION_ID,
      { page: 1, limit: 50, sortBy: "sequence", sortDir: "DESC" },
      signal,
    );
    await tenantProvisioningApi.listUpdates(
      TENANT_ID,
      { componentKey: "core.foundation", riskLevel: "MEDIUM", requiresBackup: true, requiresMaintenance: false },
      signal,
    );
    await tenantProvisioningApi.listPrerequisiteEvidence(TENANT_ID, signal);
    await tenantProvisioningApi.listComponents(
      TENANT_ID,
      { state: "READY", selectionSource: "FOUNDATION" },
      signal,
    );
    await tenantProvisioningApi.listSeeds(
      TENANT_ID,
      { componentKey: "core.foundation", seedKey: "countries.v1", policy: "MANUAL_CONFLICT", status: "CONFLICT" },
      signal,
    );

    const urls = getMock.mock.calls.map((call) => call[0] as string);
    expect(urls).toEqual([
      `/api/admin/core/v1/tenants/${TENANT_ID}/operations?page=2&limit=20&type=UPDATE&status=RUNNING&sortBy=generation&sortDir=DESC`,
      `/api/admin/core/v1/tenants/${TENANT_ID}/operations/${OPERATION_ID}`,
      `/api/admin/core/v1/tenants/${TENANT_ID}/operations/${OPERATION_ID}/timeline?page=1&limit=50&sortBy=sequence&sortDir=DESC`,
      `/api/admin/core/v1/tenants/${TENANT_ID}/provisioning/updates?componentKey=core.foundation&riskLevel=MEDIUM&requiresBackup=true&requiresMaintenance=false`,
      `/api/admin/core/v1/tenants/${TENANT_ID}/provisioning/prerequisite-evidence`,
      `/api/admin/core/v1/tenants/${TENANT_ID}/provisioning-state/components?state=READY&selectionSource=FOUNDATION`,
      `/api/admin/core/v1/tenants/${TENANT_ID}/provisioning-state/seeds?componentKey=core.foundation&seedKey=countries.v1&policy=MANUAL_CONFLICT&status=CONFLICT`,
    ]);
    expect(getMock.mock.calls.every((call) => call[1]?.signal === signal)).toBe(true);
  });

  it("uses all eight actual command routes with caller-owned UUIDv7 keys and exact bodies", async () => {
    const updateDto = {
      selections: [
        {
          componentKey: "core.foundation",
          targetReleaseId: TARGET_RELEASE_ID,
          targetReleaseVersion: "1.1.0",
          targetManifestChecksum: SHA_B,
          currentAppliedReleaseId: RELEASE_ID,
          currentAppliedManifestChecksum: SHA_A,
        },
      ],
    };
    const addDto = {
      applicationKey: "crm",
      expectedAccessPolicyRevision: 2,
      targetSelection: [
        {
          componentKey: "crm.main",
          componentId: COMPONENT_ID,
          targetReleaseId: TARGET_RELEASE_ID,
          targetReleaseVersion: "1.1.0",
          targetManifestChecksum: SHA_B,
        },
      ],
      reasonCode: "ADMIN.ADD_APPLICATION",
    };
    const repairDto = {
      componentKey: "core.foundation",
      currentDesiredReleaseId: RELEASE_ID,
      currentDesiredManifestChecksum: SHA_A,
      currentAppliedReleaseId: RELEASE_ID,
      currentAppliedManifestChecksum: SHA_A,
      targetReleaseId: RELEASE_ID,
      targetManifestChecksum: SHA_A,
      reasonCode: "ADMIN.REPAIR",
    };
    const decommissionDto = {
      componentKey: "core.foundation",
      currentDesiredReleaseId: RELEASE_ID,
      currentDesiredManifestChecksum: SHA_A,
      currentAppliedReleaseId: RELEASE_ID,
      currentAppliedManifestChecksum: SHA_A,
      retentionAcknowledged: true as const,
      reasonCode: "ADMIN.DECOMMISSION",
    };
    const conflictDto = {
      decision: "KEEP_TENANT_VALUE" as const,
      reasonCode: "ADMIN.SEED_CONFLICT",
      expectedConflictRevision: 3,
      expectedStatus: "CONFLICT" as const,
      expectedAppliedChecksum: SHA_A,
      expectedDesiredChecksum: SHA_B,
    };

    await tenantProvisioningApi.retryOperation(TENANT_ID, OPERATION_ID, COMMAND_ID);
    await tenantProvisioningApi.cancelOperation(TENANT_ID, OPERATION_ID, COMMAND_ID);
    await tenantProvisioningApi.applyUpdates(TENANT_ID, updateDto, COMMAND_ID);
    await tenantProvisioningApi.requestPrerequisites(
      TENANT_ID,
      { operationId: OPERATION_ID, expectedPlanDigest: SHA_A, reasonCode: "ADMIN.PREREQUISITE_REQUEST" },
      COMMAND_ID,
    );
    await tenantProvisioningApi.addApplication(TENANT_ID, addDto, COMMAND_ID);
    await tenantProvisioningApi.repair(TENANT_ID, repairDto, COMMAND_ID);
    await tenantProvisioningApi.decommission(TENANT_ID, decommissionDto, COMMAND_ID);
    await tenantProvisioningApi.resolveSeedConflict(TENANT_ID, SEED_ID, conflictDto, COMMAND_ID);

    expect(postMock).toHaveBeenCalledTimes(8);
    expect(postMock.mock.calls.map((call) => call[0])).toEqual([
      `/api/admin/core/v1/tenants/${TENANT_ID}/operations/${OPERATION_ID}/retry`,
      `/api/admin/core/v1/tenants/${TENANT_ID}/operations/${OPERATION_ID}/cancel`,
      `/api/admin/core/v1/tenants/${TENANT_ID}/provisioning/updates/apply`,
      `/api/admin/core/v1/tenants/${TENANT_ID}/provisioning/prerequisite-requests`,
      `/api/admin/core/v1/tenants/${TENANT_ID}/provisioning/operations/add-application`,
      `/api/admin/core/v1/tenants/${TENANT_ID}/provisioning/operations/repair`,
      `/api/admin/core/v1/tenants/${TENANT_ID}/provisioning/operations/decommission`,
      `/api/admin/core/v1/tenants/${TENANT_ID}/provisioning/seed-conflicts/${SEED_ID}/resolve`,
    ]);
    expect(postMock.mock.calls.every((call) => call[2]?.headers?.["x-idempotency-key"] === COMMAND_ID)).toBe(true);
    expect(postMock.mock.calls[2]?.[1]).toEqual(updateDto);
    expect(postMock.mock.calls[4]?.[1]).toEqual(addDto);
    expect(postMock.mock.calls[7]?.[1]).toEqual(conflictDto);
    expect(JSON.stringify(postMock.mock.calls)).not.toMatch(/reconcile|add-module/i);
    expect(JSON.stringify(addDto)).not.toMatch(/expectedCurrent/i);
  });

  it("maps the seed conflict route as HTTP POST/200 response data, never as an async operation receipt", async () => {
    const result = await tenantProvisioningApi.resolveSeedConflict(
      TENANT_ID,
      SEED_ID,
      {
        decision: "KEEP_TENANT_VALUE",
        reasonCode: "ADMIN.SEED_CONFLICT",
        expectedConflictRevision: 3,
        expectedStatus: "CONFLICT",
        expectedAppliedChecksum: SHA_A,
        expectedDesiredChecksum: SHA_B,
      },
      COMMAND_ID,
    );

    expect(result).toEqual(
      expect.objectContaining({ seedStateId: SEED_ID, expectedConflictRevision: 3 }),
    );
    expect(result).not.toHaveProperty("operationId");
    expect(INSTALLATION_ID).not.toBe(SEED_ID);
  });
});
