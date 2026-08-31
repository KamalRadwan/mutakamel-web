// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AttachmentList, type Attachment, type AttachmentListProps } from "./AttachmentList";

afterEach(cleanup);

const attachments: Attachment[] = [
  { id: "1", name: "contract.pdf", size: "1.2 MB", uploadedAt: "2026-08-30", uploadedBy: "Kamal" },
  { id: "2", name: "site-plan.png", size: "820 KB", uploadedAt: "2026-08-29" },
];

function renderList(overrides: Partial<AttachmentListProps> = {}) {
  const props: AttachmentListProps = {
    attachments,
    files: [],
    onFilesAdded: vi.fn(),
    onRemove: vi.fn(),
    onDownload: vi.fn(),
    accept: ["application/pdf"],
    maxSizeBytes: 26 * 1024 * 1024,
    formatBytes: (bytes) => `${bytes} B`,
    labels: {
      title: "Attachments",
      emptyTitle: "No attachments yet",
      emptyDescription: "Files attached to this record appear here.",
      download: "Download {name}",
      delete: "Delete {name}",
      upload: {
        instruction: "Drop files here",
        browse: "Browse files",
        constraint: "Up to {max}",
        remove: "Remove {name}",
        uploading: "Uploading {name}",
        tooLarge: "{name} is {size}, over the {max} limit",
        wrongType: "{name} is not an accepted file type",
        tooMany: "Only {max} files can be attached",
      },
    },
    ...overrides,
  };
  return { props, ...render(<AttachmentList {...props} />) };
}

describe("AttachmentList", () => {
  it("lists every stored attachment with its metadata", () => {
    renderList();
    expect(screen.getByText("contract.pdf")).toBeInTheDocument();
    expect(screen.getByText("1.2 MB")).toBeInTheDocument();
    expect(screen.getByText("Kamal")).toBeInTheDocument();
  });

  it("names the section so it is reachable as a landmark", () => {
    renderList();
    expect(screen.getByRole("region", { name: "Attachments" })).toBeInTheDocument();
  });

  it("reports a download intent with the whole attachment", () => {
    const onDownload = vi.fn();
    renderList({ onDownload });
    fireEvent.click(screen.getByRole("button", { name: "Download contract.pdf" }));
    expect(onDownload).toHaveBeenCalledWith(attachments[0]);
  });

  it("omits delete entirely when the caller does not pass a handler", () => {
    renderList();
    expect(screen.queryByRole("button", { name: "Delete contract.pdf" })).toBeNull();
  });

  it("reports a delete intent WITHOUT confirming — the caller owns that", () => {
    const onDelete = vi.fn();
    renderList({ onDelete });
    fireEvent.click(screen.getByRole("button", { name: "Delete contract.pdf" }));
    expect(onDelete).toHaveBeenCalledWith(attachments[0]);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("renders the empty state rather than a bare list", () => {
    renderList({ attachments: [] });
    expect(screen.getByText("No attachments yet")).toBeInTheDocument();
  });

  it("suppresses the drop zone when uploading is not permitted", () => {
    renderList({ canUpload: false });
    expect(screen.queryByText("Drop files here")).toBeNull();
  });

  it("shows skeletons rather than an empty state while loading", () => {
    renderList({ attachments: [], isLoading: true });
    expect(screen.queryByText("No attachments yet")).toBeNull();
  });
});
