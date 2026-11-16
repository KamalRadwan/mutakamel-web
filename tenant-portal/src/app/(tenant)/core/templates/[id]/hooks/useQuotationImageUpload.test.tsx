// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { TemplateAsset } from "../../template-assets-contract";
import { useQuotationImageUpload, type QuotationImageUploadPort } from "./useQuotationImageUpload";

const io = vi.hoisted(() => ({ create: vi.fn(), read: vi.fn(), hash: vi.fn() }));
vi.mock("../../template-assets-contract", async importOriginal => ({
  ...await importOriginal<typeof import("../../template-assets-contract")>(),
  uploadTemplateAsset: io.create, fetchUploadedTemplateAsset: io.read, sha256Hex: io.hash,
}));

const definitionId = "01902001-3000-7000-8000-000000000001";
const hash = "c".repeat(64);
const png = new File(["png"], "sales-stamp.png", { type: "image/png" });

function asset(id: string): TemplateAsset {
  return { id, definitionId, assetType: "IMAGE", originalFileName: png.name, mimeType: png.type, sizeBytes: 3,
    deliveryClass: "PRIVATE_ONLY", status: "ACTIVE", revision: 1, etag: `"asset:${id}:1"`, createdAt: "2026-11-13T08:00:00Z" };
}

function Fixture({ port }: { port: QuotationImageUploadPort | null }) {
  const upload = useQuotationImageUpload(port);
  if (!upload) return null;
  return <div key={upload.key}>
    <input aria-label="File" type="file" onChange={upload.select} disabled={upload.pending} />
    <button onClick={upload.submit} disabled={upload.busy || (!upload.file && !upload.pending)}>Upload</button>
    <output>{upload.pending ? "pending" : upload.feedback}</output>
  </div>;
}

function setup() {
  const port = { ownerKey: "session:company:draft", definitionId, draftRevision: 4, disabled: false, isCurrent: vi.fn(() => true), accept: vi.fn(() => true) };
  const view = render(<Fixture port={port} />);
  const select = (file = png) => fireEvent.change(screen.getByLabelText("File"), { target: { files: [file] } });
  const submit = () => fireEvent.click(screen.getByRole("button", { name: "Upload" }));
  return { port, view, select, submit };
}

beforeEach(() => {
  io.create.mockReset().mockImplementation(async (_, __, intent) => {
    intent.assertCurrent();
    return asset(intent.mutationId);
  });
  io.read.mockReset();
  io.hash.mockReset().mockResolvedValue(hash);
});
afterEach(cleanup);

it("uploads private PNG metadata against the definition and adopts only the matching receipt", async () => {
  const { port, select, submit } = setup();
  select(); submit();
  await screen.findByText("assetUploaded");
  expect(io.create).toHaveBeenCalledExactlyOnceWith({ definitionId, assetType: "IMAGE", deliveryClass: "PRIVATE_ONLY",
    fileName: png.name, declaredMimeType: png.type, expectedRawSha256: hash }, png,
  { mutationId: expect.stringMatching(/^[0-9a-f-]{36}$/u), assertCurrent: expect.any(Function) });
  expect(port.accept).toHaveBeenCalledExactlyOnceWith(asset(io.create.mock.calls[0][2].mutationId));
});

it("rejects a file with an unsupported MIME or size before hashing", async () => {
  const { select, submit } = setup();
  select(new File(["svg"], "sales-stamp.svg", { type: "image/svg+xml" })); submit();
  await screen.findByText("assetUploadInvalid");
  const huge = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.png", { type: "image/png" });
  select(huge); submit();
  await screen.findByText("assetTooLarge");
  expect(io.hash).not.toHaveBeenCalled();
  expect(io.create).not.toHaveBeenCalled();
});

it("fences dispatch if the draft changes while hashing the selection", async () => {
  let finishHash!: (value: string) => void;
  io.hash.mockReturnValueOnce(new Promise<string>(resolve => { finishHash = resolve; }));
  const { port, view, select, submit } = setup();
  select(); submit();
  view.rerender(<Fixture port={{ ...port, draftRevision: 5 }} />);
  await act(async () => finishHash(hash));
  expect(io.create).not.toHaveBeenCalled();
  expect(port.accept).not.toHaveBeenCalled();
});

it("drops a successful reply from a different owner without merging it", async () => {
  let finish!: (value: TemplateAsset) => void;
  io.create.mockReturnValueOnce(new Promise<TemplateAsset>(resolve => { finish = resolve; }));
  const { port, view, select, submit } = setup();
  select(); submit();
  await waitFor(() => expect(io.create).toHaveBeenCalledOnce());
  view.rerender(<Fixture port={{ ...port, ownerKey: "other owner" }} />);
  await act(async () => finish(asset(io.create.mock.calls[0][2].mutationId)));
  expect(port.accept).not.toHaveBeenCalled();
  expect(screen.queryByText("assetUploaded")).toBeNull();
});

it("recovers an uncertain write by reading its exact asset key", async () => {
  io.create.mockRejectedValueOnce(new Error("network closed"));
  io.read.mockImplementationOnce(async (id, assertCurrent) => { assertCurrent(); return asset(id); });
  const { port, select, submit } = setup();
  select(); submit();
  await screen.findByText("pending");
  submit();
  await screen.findByText("assetUploaded");
  const mutationId = io.create.mock.calls[0][2].mutationId;
  expect(io.read).toHaveBeenCalledExactlyOnceWith(mutationId, expect.any(Function));
  expect(io.create).toHaveBeenCalledOnce();
  expect(port.accept).toHaveBeenCalledExactlyOnceWith(asset(mutationId));
});

it("reuses the original file, metadata and key after recovery read returns not found", async () => {
  io.create.mockRejectedValueOnce(new Error("network closed"));
  io.read.mockResolvedValueOnce(null);
  const { select, submit } = setup();
  select(); submit();
  await screen.findByText("pending");
  submit();
  await screen.findByText("assetUploaded");
  expect(io.create).toHaveBeenCalledTimes(2);
  expect(io.create.mock.calls[1][0]).toBe(io.create.mock.calls[0][0]);
  expect(io.create.mock.calls[1][1]).toBe(io.create.mock.calls[0][1]);
  expect(io.create.mock.calls[1][2].mutationId).toBe(io.create.mock.calls[0][2].mutationId);
});

it("keeps an unproven response out of the current definition asset list", async () => {
  io.create.mockImplementationOnce(async (_, __, intent) => ({ ...asset(intent.mutationId), definitionId: null }));
  const { port, select, submit } = setup();
  select(); submit();
  await screen.findByText("pending");
  expect(port.accept).not.toHaveBeenCalled();
});

it("holds an in-flight reply across a saved revision for explicit recovery", async () => {
  let finish!: (value: TemplateAsset) => void;
  io.create.mockReturnValueOnce(new Promise<TemplateAsset>(resolve => { finish = resolve; }));
  const { port, view, select, submit } = setup();
  select(); submit();
  await waitFor(() => expect(io.create).toHaveBeenCalledOnce());
  view.rerender(<Fixture port={{ ...port, draftRevision: 5 }} />);
  const mutationId = io.create.mock.calls[0][2].mutationId;
  await act(async () => finish(asset(mutationId)));
  await screen.findByText("pending");
  expect(port.accept).not.toHaveBeenCalled();
  io.read.mockResolvedValueOnce(asset(mutationId));
  submit();
  await screen.findByText("assetUploaded");
  expect(io.create).toHaveBeenCalledOnce();
  expect(port.accept).toHaveBeenCalledExactlyOnceWith(asset(mutationId));
});
