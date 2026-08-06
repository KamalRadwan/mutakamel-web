import { beforeEach, describe, expect, it, vi } from "vitest";

const { deleteMock, getMock, patchMock, postMock } = vi.hoisted(() => ({
  deleteMock: vi.fn(),
  getMock: vi.fn(),
  patchMock: vi.fn(),
  postMock: vi.fn(),
}));

vi.mock("@/lib/api/axiosClient", () => ({
  axiosClient: {
    delete: deleteMock,
    get: getMock,
    patch: patchMock,
    post: postMock,
  },
}));

import { storageServersApi } from "./storage-servers.api";

const SERVER_ID = "019f0000-0000-7000-8000-000000000010";
const COMMAND_ID = "019f0000-0000-7000-8000-000000000020";
const envelope = (data: unknown) => ({ data: { success: true, data } });

describe("storage servers API", () => {
  beforeEach(() => {
    deleteMock.mockReset();
    getMock.mockReset();
    patchMock.mockReset();
    postMock.mockReset();
  });

  it("serializes server-backed list controls and forwards cancellation", async () => {
    const controller = new AbortController();
    getMock.mockResolvedValue(envelope({ items: [], total: 0, page: 2, limit: 20, totalPages: 0 }));

    await storageServersApi.list(
      {
        page: 2,
        limit: 20,
        search: "garage primary",
        status: "ACTIVE",
        sortBy: "lastConnectionTestedAt",
        sortDir: "DESC",
      },
      controller.signal,
    );

    expect(getMock).toHaveBeenCalledWith(
      "/api/admin/core/v1/storage-servers?page=2&limit=20&search=garage+primary&status=ACTIVE&sortBy=lastConnectionTestedAt&sortDir=DESC",
      { signal: controller.signal },
    );
  });

  it("runs a revision-fenced probe with a caller-owned command key", async () => {
    const result = {
      contractVersion: 1,
      commandId: COMMAND_ID,
      storageServerId: SERVER_ID,
      configRevision: 4,
      lifecycleStatus: "ACTIVE",
      outcome: "FAILED",
      testedAt: "2026-08-05T12:00:00.000Z",
      errorCode: "STORAGE_PROBE_AUTHORIZATION_FAILED",
    };
    postMock.mockResolvedValue(envelope(result));

    await expect(
      storageServersApi.probe(
        SERVER_ID,
        { expectedConfigRevision: 4 },
        COMMAND_ID,
      ),
    ).resolves.toEqual(result);

    expect(postMock).toHaveBeenCalledWith(
      `/api/admin/core/v1/storage-servers/${SERVER_ID}/probe`,
      { expectedConfigRevision: 4 },
      { headers: { "x-idempotency-key": COMMAND_ID } },
    );
    expect(JSON.stringify(result)).not.toMatch(/accessKey|secret|credentials/i);
  });

  it("uses idempotency headers for every storage write", async () => {
    const server = { id: SERVER_ID };
    postMock.mockResolvedValue(envelope(server));
    patchMock.mockResolvedValue(envelope(server));
    deleteMock.mockResolvedValue({ status: 204 });

    await storageServersApi.update(SERVER_ID, { name: "Garage 1" }, COMMAND_ID);
    await storageServersApi.activate(SERVER_ID, COMMAND_ID);
    await storageServersApi.offline(SERVER_ID, COMMAND_ID);
    await storageServersApi.delete(SERVER_ID, COMMAND_ID);

    const expected = { headers: { "x-idempotency-key": COMMAND_ID } };
    expect(patchMock.mock.calls[0]?.[2]).toEqual(expected);
    expect(postMock.mock.calls[0]?.[2]).toEqual(expected);
    expect(postMock.mock.calls[1]?.[2]).toEqual(expected);
    expect(deleteMock.mock.calls[0]?.[1]).toEqual(expected);
  });
});
