// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublishApplicationDto } from "../types";

const { getMock, getManifestsMock, mutateMock, publishMock, toastMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  getManifestsMock: vi.fn(),
  mutateMock: vi.fn(),
  publishMock: vi.fn(),
  toastMock: { error: vi.fn() },
}));

vi.mock("../api/applications.api", () => ({
  applicationsApi: {
    get: getMock,
    getManifests: getManifestsMock,
    publish: publishMock,
  },
}));

vi.mock("@/shared/hooks/useActionMutation", () => ({
  useActionMutation: () => ({ mutate: mutateMock, isMutating: false }),
}));

vi.mock("@/components/ui/ToastContext", () => ({
  useToast: () => toastMock,
}));

vi.mock("@/shared/api/normalized-api-error", () => ({
  normalizeApiError: (error: unknown) => error,
}));

import { useApplication } from "./useApplication";

describe("useApplication publication intent", () => {
  beforeEach(() => {
    getMock.mockReset();
    getManifestsMock.mockReset();
    mutateMock.mockReset();
    publishMock.mockReset();
    toastMock.error.mockReset();
    getMock.mockResolvedValue(null);
    getManifestsMock.mockResolvedValue([]);
    mutateMock.mockResolvedValue(undefined);
  });

  it("binds one idempotency intent to the publish operation, path identity, and exact DTO", async () => {
    const dto: PublishApplicationDto = {
      expectedCatalogueRevision: "7",
      expectedPublicationRevision: "3",
      reason: "Approve the reviewed catalogue revision",
    };
    const { result } = renderHook(() => useApplication("crm"));
    await waitFor(() =>
      expect(result.current.loadedApplicationKey).toBe("crm"),
    );

    await act(async () => {
      await result.current.publishApplication(dto);
    });

    expect(mutateMock).toHaveBeenCalledOnce();
    const [intent, action] = mutateMock.mock.calls[0] as [
      unknown,
      (idempotencyKey: string) => Promise<unknown>,
    ];
    expect(intent).toEqual({ operation: "PUBLISH", applicationKey: "crm", dto });

    publishMock.mockResolvedValue({ operation: "PUBLISH" });
    await action("019f0000-0000-7000-8000-000000000099");
    expect(publishMock).toHaveBeenCalledWith(
      "crm",
      dto,
      "019f0000-0000-7000-8000-000000000099",
    );
  });

  it("ignores an A response that resolves after route identity B", async () => {
    let resolveA!: (value: unknown) => void;
    let resolveB!: (value: unknown) => void;
    getMock
      .mockReturnValueOnce(new Promise((resolve) => { resolveA = resolve; }))
      .mockReturnValueOnce(new Promise((resolve) => { resolveB = resolve; }));
    getManifestsMock.mockResolvedValue([]);

    const { result, rerender } = renderHook(
      ({ applicationKey }) => useApplication(applicationKey),
      { initialProps: { applicationKey: "crm" } },
    );
    await waitFor(() => expect(getMock).toHaveBeenCalledWith("crm", expect.any(AbortSignal)));
    rerender({ applicationKey: "trade" });
    await waitFor(() => expect(getMock).toHaveBeenCalledWith("trade", expect.any(AbortSignal)));

    await act(async () => resolveB({ key: "trade", name: "Trade" }));
    await waitFor(() => expect(result.current.application).toMatchObject({ key: "trade" }));
    await act(async () => resolveA({ key: "crm", name: "CRM" }));
    expect(result.current.application).toMatchObject({ key: "trade" });
    expect(result.current.loadedApplicationKey).toBe("trade");
  });

  it("does not let an A mutation reconciliation abort the B detail request", async () => {
    let resolveB!: (value: unknown) => void;
    getMock
      .mockResolvedValueOnce({ key: "crm", name: "CRM" })
      .mockReturnValueOnce(new Promise((resolve) => { resolveB = resolve; }));

    const { result, rerender } = renderHook(
      ({ applicationKey }) => useApplication(applicationKey),
      { initialProps: { applicationKey: "crm" } },
    );
    await waitFor(() =>
      expect(result.current.loadedApplicationKey).toBe("crm"),
    );

    const dto: PublishApplicationDto = {
      expectedCatalogueRevision: "7",
      expectedPublicationRevision: "3",
      reason: "Approve the reviewed catalogue revision",
    };
    await act(async () => {
      await result.current.publishApplication(dto);
    });
    const options = mutateMock.mock.calls.at(-1)?.[2] as {
      onSuccess?: (result: unknown) => void | Promise<void>;
    };

    rerender({ applicationKey: "trade" });
    await waitFor(() =>
      expect(getMock).toHaveBeenCalledWith("trade", expect.any(AbortSignal)),
    );
    const bSignal = getMock.mock.calls.at(-1)?.[1] as AbortSignal;

    await act(async () => {
      await options.onSuccess?.(undefined);
    });

    expect(getMock).toHaveBeenCalledTimes(2);
    expect(bSignal.aborted).toBe(false);
    await act(async () => resolveB({ key: "trade", name: "Trade" }));
    await waitFor(() =>
      expect(result.current.application).toMatchObject({ key: "trade" }),
    );
  });
});
