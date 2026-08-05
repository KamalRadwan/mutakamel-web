// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
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
});
