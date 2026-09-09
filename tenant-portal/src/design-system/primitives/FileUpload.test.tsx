// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FileUpload, type FileUploadProps, type UploadFile } from "./FileUpload";

afterEach(cleanup);

const MB = 1024 * 1024;

function makeFile(name: string, type: string, size: number): File {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

function renderUpload(overrides: Partial<FileUploadProps> = {}) {
  const props: FileUploadProps = {
    files: [],
    onFilesAdded: vi.fn(),
    onRemove: vi.fn(),
    onReject: vi.fn(),
    accept: ["image/png", "image/jpeg"],
    maxSizeBytes: 2 * MB,
    formatBytes: (bytes) => `${Math.round(bytes / MB)} MB`,
    labels: {
      instruction: "Drop files here",
      browse: "Browse files",
      constraint: "PNG or JPEG up to {max}",
      remove: "Remove {name}",
      uploading: "Uploading {name}",
      tooLarge: "{name} is {size}, over the {max} limit",
      wrongType: "{name} is not an accepted file type",
      tooMany: "Only {max} files can be attached",
    },
    ...overrides,
  };
  return { props, ...render(<FileUpload {...props} />) };
}

function drop(files: File[]) {
  fireEvent.drop(screen.getByText("Drop files here").closest("label")!, {
    dataTransfer: { files },
  });
}

describe("FileUpload", () => {
  it("applies the same MIME and size validation in button mode", () => {
    const { props, container } = renderUpload({ variant: "button" });
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [
      makeFile("bad.svg", "image/svg+xml", 1024), makeFile("big.png", "image/png", 3 * MB),
      makeFile("valid.png", "image/png", MB),
    ] } });
    expect(props.onFilesAdded).toHaveBeenCalledWith([expect.objectContaining({ name: "valid.png" })]);
    expect(props.onReject).toHaveBeenCalledWith([
      "bad.svg is not an accepted file type", "big.png is 3 MB, over the 2 MB limit",
    ]);
  });
  it("admits a file that passes the MIME allowlist and the size cap", () => {
    const onFilesAdded = vi.fn();
    renderUpload({ onFilesAdded });
    const file = makeFile("logo.png", "image/png", MB);
    drop([file]);
    expect(onFilesAdded).toHaveBeenCalledWith([file]);
  });

  it("rejects a MIME type outside the allowlist and never forwards it", () => {
    const onFilesAdded = vi.fn();
    const onReject = vi.fn();
    renderUpload({ onFilesAdded, onReject });
    drop([makeFile("payload.svg", "image/svg+xml", 1024)]);
    expect(onFilesAdded).not.toHaveBeenCalled();
    expect(onReject).toHaveBeenCalledWith(["payload.svg is not an accepted file type"]);
  });

  it("rejects a file over the cap with the size in the message", () => {
    const onReject = vi.fn();
    renderUpload({ onReject });
    drop([makeFile("scan.png", "image/png", 5 * MB)]);
    expect(onReject).toHaveBeenCalledWith(["scan.png is 5 MB, over the 2 MB limit"]);
  });

  it("stops at maxFiles, counting what is already attached", () => {
    const onFilesAdded = vi.fn();
    const onReject = vi.fn();
    const existing: UploadFile[] = [
      { id: "a", file: makeFile("a.png", "image/png", 10), status: "ready" },
    ];
    renderUpload({ files: existing, maxFiles: 2, onFilesAdded, onReject });
    const second = makeFile("b.png", "image/png", 10);
    const third = makeFile("c.png", "image/png", 10);
    drop([second, third]);
    expect(onFilesAdded).toHaveBeenCalledWith([second]);
    expect(onReject).toHaveBeenCalledWith(["Only 2 files can be attached"]);
  });

  it("renders an INDETERMINATE bar while uploading — no fabricated percentage", () => {
    renderUpload({
      files: [{ id: "a", file: makeFile("big.png", "image/png", MB), status: "uploading" }],
    });
    const bar = screen.getByRole("progressbar", { name: "Uploading big.png" });
    // Radix omits aria-valuenow when the value is null. That omission IS the
    // indeterminate announcement — see DECISIONS.md D14.
    expect(bar).not.toHaveAttribute("aria-valuenow");
  });

  it("becomes determinate only when real progress is supplied", () => {
    renderUpload({
      files: [
        { id: "a", file: makeFile("big.png", "image/png", MB), status: "uploading", progress: 42 },
      ],
    });
    expect(screen.getByRole("progressbar", { name: "Uploading big.png" })).toHaveAttribute(
      "aria-valuenow",
      "42",
    );
  });

  it("shows a failed file's reason instead of a bar", () => {
    renderUpload({
      files: [
        {
          id: "a",
          file: makeFile("big.png", "image/png", MB),
          status: "failed",
          error: "Upload rejected by the server",
        },
      ],
    });
    expect(screen.getByText("Upload rejected by the server")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("removes an attached file through a named control", () => {
    const onRemove = vi.fn();
    renderUpload({
      files: [{ id: "a", file: makeFile("logo.png", "image/png", MB), status: "ready" }],
      onRemove,
    });
    fireEvent.click(screen.getByRole("button", { name: "Remove logo.png" }));
    expect(onRemove).toHaveBeenCalledWith("a");
  });

  it("accepts nothing while disabled", () => {
    const onFilesAdded = vi.fn();
    renderUpload({ disabled: true, onFilesAdded });
    drop([makeFile("logo.png", "image/png", MB)]);
    expect(onFilesAdded).not.toHaveBeenCalled();
  });

  it("puts the allowlist on the native input so the OS picker filters too", () => {
    renderUpload();
    expect(screen.getByLabelText("Browse files")).toHaveAttribute(
      "accept",
      "image/png,image/jpeg",
    );
  });
});
