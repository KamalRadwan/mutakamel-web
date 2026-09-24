// @vitest-environment jsdom

import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/I18nContext";
import { CreateTagModal } from "./CreateTagModal";

const { post } = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock("@/lib/api/axiosClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/axiosClient")>();
  return { ...actual, axiosClient: { ...actual.axiosClient, post } };
});

describe("CreateTagModal", () => {
  const onSuccess = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // The colour picker's radio group measures itself; jsdom has no observer.
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  function renderModal(open = true, initialName = "") {
    return render(
      createElement(
        I18nProvider,
        null,
        createElement(CreateTagModal, {
          open,
          initialName,
          existingTags: [{ id: "01900100-0000-7000-8000-000000000001", name: "VIP", backgroundColor: null, textColor: null }],
          onSuccess,
          onClose,
        }),
      ),
    );
  }

  it("renders when open and displays pre-filled tag name", () => {
    renderModal(true, "Urgent Lead");

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Urgent Lead")).toBeInTheDocument();
  });

  it("submits the trimmed tag name on create button click", async () => {
    const createdId = "01900100-0000-7000-8000-000000000009";
    post.mockResolvedValueOnce({
      data: {
        id: createdId,
        name: "Urgent Lead",
        createdAt: "2026-09-14T00:00:00.000Z",
        updatedAt: "2026-09-14T00:00:00.000Z",
      },
    });

    renderModal(true, "Urgent Lead");

    // Click submit button (labeled "إنشاء" in Arabic or "Create" in English)
    const submitBtn = screen.getByRole("button", { name: /إنشاء|Create/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(post).toHaveBeenCalledWith("/api/tenant/crm/v1/tags", {
        name: "Urgent Lead",
      });
      expect(onSuccess).toHaveBeenCalledWith({
        id: createdId,
        name: "Urgent Lead",
        backgroundColor: null,
        textColor: null,
      });
      expect(onClose).toHaveBeenCalled();
    });
  });
});
