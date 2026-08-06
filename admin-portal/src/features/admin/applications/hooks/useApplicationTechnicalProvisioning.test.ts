// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApplicationTechnicalReadinessView } from "../types";

const { api, getKeyMock, resetKeyMock, toastMock } = vi.hoisted(() => ({
  api: {
    getTechnicalProvisioning: vi.fn(),
    adoptTechnicalPackage: vi.fn(),
    createPrimaryProvisioningComponent: vi.fn(),
  },
  getKeyMock: vi.fn(() => "019f0000-0000-7000-8000-000000000001"),
  resetKeyMock: vi.fn(),
  toastMock: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));

vi.mock("../api/applications.api", () => ({ applicationsApi: api }));
vi.mock("@/shared/hooks/useIdempotency", () => ({
  useIdempotency: () => ({
    getIdempotencyKey: getKeyMock,
    resetKey: resetKeyMock,
  }),
}));
vi.mock("@/components/ui/ToastContext", () => ({
  useToast: () => toastMock,
}));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({
    t: {
      applications: {
        technicalProvisioning: {
          adoptionSuccessTitle: "Adopted",
          adoptionSuccessMessage: "Adopted",
          toastSuccessTitle: "Linked",
          toastSuccessMessage: "Linked",
          reconciledSuccess: "Reconciled",
          processingTitle: "Processing",
          processingMessage: "Processing",
          adoptionErrorTitle: "Adoption failed",
          toastErrorTitle: "Link failed",
        },
      },
    },
  }),
}));

import { useApplicationTechnicalProvisioning } from "./useApplicationTechnicalProvisioning";

function readiness(
  applicationKey: string,
  runtimeTarget: string | null,
  technicalDefinitionRevision: string,
): ApplicationTechnicalReadinessView {
  return {
    contractVersion: 1,
    applicationId: `${applicationKey}-id`,
    applicationKey,
    runtimeTarget,
    commercialMode: "SUBSCRIPTION",
    catalogueVisibility: "PUBLIC",
    lifecycleStatus: "DRAFT",
    publicationStatus: "UNPUBLISHED",
    technicalDefinitionRevision,
    status: runtimeTarget ? "READY" : "BLOCKED",
    activationAllowed: false,
    selectionAllowed: false,
    selectionBlockers: [],
    reasons: runtimeTarget ? [] : ["RUNTIME_TARGET_REQUIRED"],
    checks: {
      runtimeTarget: Boolean(runtimeTarget),
      componentBinding: false,
      activeComponents: false,
      publishedReleases: false,
      minimumReleases: false,
      databasePermissionManifest: false,
    },
    components: [],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

describe("useApplicationTechnicalProvisioning ownership", () => {
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    getKeyMock.mockClear();
    resetKeyMock.mockClear();
    Object.values(toastMock).forEach((mock) => mock.mockReset());
    api.createPrimaryProvisioningComponent.mockResolvedValue({});
  });

  it("does not refetch or commit Application A after its command resolves on B", async () => {
    const adoption = deferred<unknown>();
    api.getTechnicalProvisioning.mockImplementation((applicationKey: string) =>
      Promise.resolve(
        applicationKey === "crm"
          ? readiness("crm", null, "1")
          : readiness("trade", "trade-app", "9"),
      ),
    );
    api.adoptTechnicalPackage.mockReturnValue(adoption.promise);

    const { result, rerender } = renderHook(
      ({ applicationKey }) =>
        useApplicationTechnicalProvisioning(applicationKey),
      { initialProps: { applicationKey: "crm" } },
    );
    await waitFor(() =>
      expect(result.current.readiness?.applicationKey).toBe("crm"),
    );

    let command!: Promise<boolean>;
    act(() => {
      command = result.current.adoptTechnicalPackage(
        "Adopt the reviewed CRM package",
      );
    });
    await waitFor(() =>
      expect(api.adoptTechnicalPackage).toHaveBeenCalledWith(
        "crm",
        expect.objectContaining({ expectedTechnicalDefinitionRevision: "1" }),
        expect.any(String),
      ),
    );

    rerender({ applicationKey: "trade" });
    await waitFor(() =>
      expect(result.current.readiness?.applicationKey).toBe("trade"),
    );

    await act(async () => {
      adoption.resolve({});
      await command;
    });

    expect(
      api.getTechnicalProvisioning.mock.calls.filter(
        ([applicationKey]) => applicationKey === "crm",
      ),
    ).toHaveLength(1);
    expect(result.current.readiness?.applicationKey).toBe("trade");
    expect(result.current.readiness?.technicalDefinitionRevision).toBe("9");
  });

  it("does not let an old A command own a later A route instance", async () => {
    const adoption = deferred<unknown>();
    api.getTechnicalProvisioning
      .mockResolvedValueOnce(readiness("crm", null, "1"))
      .mockResolvedValueOnce(readiness("trade", "trade-app", "5"))
      .mockResolvedValueOnce(readiness("crm", null, "8"));
    api.adoptTechnicalPackage.mockReturnValue(adoption.promise);

    const { result, rerender } = renderHook(
      ({ applicationKey }) =>
        useApplicationTechnicalProvisioning(applicationKey),
      { initialProps: { applicationKey: "crm" } },
    );
    await waitFor(() =>
      expect(result.current.readiness?.technicalDefinitionRevision).toBe("1"),
    );

    let command!: Promise<boolean>;
    act(() => {
      command = result.current.adoptTechnicalPackage(
        "Adopt the reviewed CRM package",
      );
    });
    await waitFor(() => expect(api.adoptTechnicalPackage).toHaveBeenCalledOnce());

    rerender({ applicationKey: "trade" });
    await waitFor(() =>
      expect(result.current.readiness?.applicationKey).toBe("trade"),
    );
    rerender({ applicationKey: "crm" });
    await waitFor(() =>
      expect(result.current.readiness?.technicalDefinitionRevision).toBe("8"),
    );

    await act(async () => {
      adoption.resolve({});
      await command;
    });

    expect(api.getTechnicalProvisioning).toHaveBeenCalledTimes(3);
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(result.current.readiness?.technicalDefinitionRevision).toBe("8");
  });

  it("submits a primary component only when Core reports it as required", async () => {
    const tenant: ApplicationTechnicalReadinessView = {
      ...readiness("hr", "hr-app", "2"),
      status: "BLOCKED",
      reasons: [
        "COMPONENT_BINDING_REQUIRED",
        "ACTIVE_COMPONENT_REQUIRED",
        "PUBLISHED_RELEASE_REQUIRED",
      ],
      checks: {
        ...readiness("hr", "hr-app", "2").checks,
        componentBinding: false,
        activeComponents: false,
      },
    };
    api.getTechnicalProvisioning.mockResolvedValue(tenant);

    const { result } = renderHook(() =>
      useApplicationTechnicalProvisioning("hr"),
    );
    await waitFor(() =>
      expect(result.current.readiness?.applicationKey).toBe("hr"),
    );

    let linked = false;
    await act(async () => {
      linked = await result.current.linkPrimaryComponent(
        "Link the reviewed HR component",
      );
    });

    expect(linked).toBe(true);
    expect(api.createPrimaryProvisioningComponent).toHaveBeenCalledWith(
      "hr",
      {
        expectedTechnicalDefinitionRevision: "2",
        reason: "Link the reviewed HR component",
      },
      expect.any(String),
    );
  });

  it("does not submit a component for an unbound ready SYSTEM Application", async () => {
    const worker: ApplicationTechnicalReadinessView = {
      ...readiness("worker", "worker-app", "2"),
      status: "READY",
      reasons: [],
      checks: {
        runtimeTarget: true,
        componentBinding: true,
        activeComponents: true,
        publishedReleases: true,
        minimumReleases: true,
        databasePermissionManifest: true,
      },
    };
    api.getTechnicalProvisioning.mockResolvedValue(worker);

    const { result } = renderHook(() =>
      useApplicationTechnicalProvisioning("worker"),
    );
    await waitFor(() =>
      expect(result.current.readiness?.applicationKey).toBe("worker"),
    );

    let linked = true;
    await act(async () => {
      linked = await result.current.linkPrimaryComponent(
        "Do not invent a Worker component",
      );
    });

    expect(linked).toBe(false);
    expect(api.createPrimaryProvisioningComponent).not.toHaveBeenCalled();
  });
});
