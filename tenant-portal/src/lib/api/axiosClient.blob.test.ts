// @vitest-environment jsdom

import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { axiosClient } from "./axiosClient";

const PATH = "/api/tenant/crm/v1/attachments/file-id/download";

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("keeps structured HTTP errors when a blob was requested", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
    errorCode: "UNKNOWN_ERROR", message: "Missing file", correlationId: "request-id",
  }), { status: 404 })));

  await expect(axiosClient.get<Blob>(PATH, { responseType: "blob" }))
    .rejects.toMatchObject({ response: {
      status: 404,
      data: { errorCode: "UNKNOWN_ERROR", message: "Missing file", correlationId: "request-id" },
    } });
});

it("preserves JSON parsing by default", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response('{"items":[]}')));
  expect((await axiosClient.get(PATH)).data).toEqual({ items: [] });
});

it("enforces an explicit byte bound for binary bodies", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array([0, 255, 128]))));
  await expect(axiosClient.get<Blob>(PATH, { responseType: "blob", maxResponseBytes: 2 }))
    .rejects.toMatchObject({ response: { status: 502, data: { errorCode: "API_RESPONSE_TOO_LARGE" } } });
});

it("preserves cancellation while reading a binary body", async () => {
  const controller = new AbortController();
  const response = new Response("file");
  const started = vi.fn();
  vi.spyOn(response, "blob").mockImplementation(() => {
    started();
    return new Promise<Blob>(() => {});
  });
  vi.stubGlobal("fetch", vi.fn(async () => response));
  const pending = axiosClient.get<Blob>(PATH, {
    responseType: "blob", signal: controller.signal,
  }).catch((error: unknown) => error);
  await vi.waitFor(() => expect(started).toHaveBeenCalledOnce());
  controller.abort();
  expect(await pending).toMatchObject({ name: "AbortError" });
});

it.each([
  { contentType: "text/html", status: 200, encoding: null, bounded: false },
  { contentType: "application/pdf; profile=fixture, text/html", status: 200, encoding: null, bounded: true },
  { contentType: 'application/pdf; profile="a,b"', status: 200, encoding: null, bounded: false },
  { contentType: "application/pdf", status: 206, encoding: null, bounded: true },
  { contentType: "application/pdf", status: 200, encoding: "gzip", bounded: true },
])("rejects $status $contentType ($encoding) before reading an exact download", async ({
  contentType, status, encoding, bounded,
}) => {
  const headers = new Headers({ "content-type": contentType });
  if (encoding !== null) headers.set("content-encoding", encoding);
  const response = new Response("unexpected response body", { status, headers });
  const body = response.body;
  if (!body) throw new Error("Expected a response stream");
  const readStream = vi.spyOn(body, "getReader");
  const readBlob = vi.spyOn(response, "blob");
  const cancel = vi.spyOn(body, "cancel");
  vi.stubGlobal("fetch", vi.fn(async () => response));

  await expect(axiosClient.get<Blob>(PATH, {
    responseType: "blob",
    expectedBinaryContentType: "application/pdf",
    ...(bounded ? { maxResponseBytes: 100 } : {}),
  })).rejects.toMatchObject({ response: {
    status: 502, data: { errorCode: "API_RESPONSE_INVALID_BINARY_DOWNLOAD" },
  } });
  expect(readStream).not.toHaveBeenCalled();
  expect(readBlob).not.toHaveBeenCalled();
  expect(cancel).toHaveBeenCalledOnce();
});

it("reads an exact binary download with identity encoding", async () => {
  const response = new Response("synthetic", {
    headers: { "content-type": "Application/PDF", "content-encoding": "identity" },
  });
  vi.stubGlobal("fetch", vi.fn(async () => response));
  const { data } = await axiosClient.get<Blob>(PATH, {
    responseType: "blob", expectedBinaryContentType: "application/pdf",
  });

  expect(data.type).toBe("application/pdf");
  expect(data.size).toBe(9);
});

it("still exposes typed JSON errors for exact binary downloads", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({
    errorCode: "TRADE.QUOTE.PDF_ARTIFACT_UNAVAILABLE", correlationId: "artifact-ref",
  }, { status: 503 })));

  await expect(axiosClient.get<Blob>(PATH, {
    responseType: "blob", expectedBinaryContentType: "application/pdf",
  })).rejects.toMatchObject({ response: {
    status: 503, data: { errorCode: "TRADE.QUOTE.PDF_ARTIFACT_UNAVAILABLE", correlationId: "artifact-ref" },
  } });
});

it.each(["", "/wrong-artifact"])("rejects an unconfirmed binary response target %s before reading", async target => {
  const response = new Response("synthetic", { headers: { "content-type": "application/pdf" } });
  Object.defineProperty(response, "url", { value: target ? new URL(target, window.location.origin).href : "" });
  const body = response.body;
  if (!body) throw new Error("Expected a response stream");
  const readStream = vi.spyOn(body, "getReader");
  const readBlob = vi.spyOn(response, "blob");
  const cancel = vi.spyOn(body, "cancel");
  vi.stubGlobal("fetch", vi.fn(async () => response));

  await expect(axiosClient.get<Blob>(PATH, {
    responseType: "blob", expectedBinaryContentType: "application/pdf",
    requireExactResponseTarget: true, maxBinaryResponseBytes: 20,
  })).rejects.toMatchObject({ response: {
    status: 409, data: { errorCode: "RESPONSE_TARGET_UNCONFIRMED" },
  } });
  expect(readStream).not.toHaveBeenCalled();
  expect(readBlob).not.toHaveBeenCalled();
  expect(cancel).toHaveBeenCalledOnce();
});

it("stops an exact binary response at its incremental size bound", async () => {
  const response = new Response("synthetic", { headers: { "content-type": "application/pdf" } });
  Object.defineProperty(response, "url", { value: new URL(PATH, window.location.origin).href });
  const readBlob = vi.spyOn(response, "blob");
  vi.stubGlobal("fetch", vi.fn(async () => response));

  await expect(axiosClient.get<Blob>(PATH, {
    responseType: "blob", expectedBinaryContentType: "application/pdf",
    requireExactResponseTarget: true, maxBinaryResponseBytes: 8,
  })).rejects.toMatchObject({ response: {
    status: 502, data: { errorCode: "API_RESPONSE_TOO_LARGE" },
  } });
  expect(readBlob).not.toHaveBeenCalled();
});
