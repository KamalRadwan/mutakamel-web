import { describe, expect, it } from "vitest";
import {
  readComponentPage,
  readDiscoveryRunDetail,
  readDiscoveryRuns,
  readReleasePage,
} from "./readers";
import {
  COMPONENT_ID,
  RUN,
  componentEnvelope,
  discoveryDetailEnvelope,
  discoveryRunsEnvelope,
  releaseEnvelope,
} from "./test-fixtures";

describe("provisioning governance readers", () => {
  it("reads the exact component and release catalogue contracts", () => {
    const components = readComponentPage(componentEnvelope());
    const releases = readReleasePage(releaseEnvelope());

    expect(components).toMatchObject({ total: 1, page: 1, limit: 20 });
    expect(components.items[0]).toMatchObject({
      id: COMPONENT_ID,
      key: "core.identity",
      latestPublishedRelease: { releaseVersion: "1.2.3" },
    });
    expect(releases.items[0].compatibility).toEqual({
      supportedForSelfService: true,
      contractVersion: 1,
      requiredComponents: [],
    });
  });

  it("reads bounded discovery lists and secret-free result detail", () => {
    expect(readDiscoveryRuns(discoveryRunsEnvelope()).items).toEqual([RUN]);
    expect(readDiscoveryRunDetail(discoveryDetailEnvelope())).toMatchObject({
      runId: RUN.runId,
      resultsTruncated: false,
      results: [
        {
          tenantId: "019f0000-0000-7000-8000-000000000006",
          discoveredState: "DRIFTED",
        },
      ],
    });
  });

  it("accepts an in-flight reservation before the eligible count is known", () => {
    const payload = discoveryRunsEnvelope() as {
      data: Array<Record<string, unknown>>;
    };
    payload.data[0] = {
      ...payload.data[0],
      status: "RUNNING",
      eligibleTenantCount: 0,
      scannedCount: 0,
      remainingTenantCount: 0,
      driftedCount: 0,
      sweepComplete: false,
      completedAt: null,
    };

    expect(readDiscoveryRuns(payload).items[0]).toMatchObject({
      status: "RUNNING",
      sweepComplete: false,
    });
  });

  it.each([
    (payload: Record<string, unknown>) => ({ ...payload, leakedSecret: "x" }),
    (payload: Record<string, unknown>) => ({
      ...payload,
      meta: { ...(payload.meta as object), totalPages: 9 },
    }),
    (payload: Record<string, unknown>) => ({
      ...payload,
      data: [
        {
          ...((payload.data as Array<Record<string, unknown>>)[0] ?? {}),
          latestPublishedRelease: {
            ...(((payload.data as Array<Record<string, unknown>>)[0]
              ?.latestPublishedRelease as object) ?? {}),
            componentId: "019f0000-0000-7000-8000-000000000099",
          },
        },
      ],
    }),
  ])("rejects an invalid or expanded catalogue envelope", (mutate) => {
    expect(() =>
      readComponentPage(mutate(componentEnvelope() as Record<string, unknown>)),
    ).toThrow("INVALID_PROVISIONING_GOVERNANCE_RESPONSE");
  });

  it("rejects impossible discovery counters", () => {
    const payload = discoveryRunsEnvelope() as {
      data: Array<Record<string, unknown>>;
    };
    payload.data[0] = { ...payload.data[0], scannedCount: 11 };

    expect(() => readDiscoveryRuns(payload)).toThrow(
      "INVALID_PROVISIONING_GOVERNANCE_RESPONSE",
    );
  });
});
