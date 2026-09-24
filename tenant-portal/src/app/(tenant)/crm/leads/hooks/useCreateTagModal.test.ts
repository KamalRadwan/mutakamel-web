// @vitest-environment jsdom

import { createElement } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/I18nContext";
import { ar } from "@/i18n/dictionaries/ar";
import { useCreateTagModal } from "./useCreateTagModal";
import type { CrmTag } from "../../shared/tag-contract";

const { post } = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock("@/lib/api/axiosClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/axiosClient")>();
  return { ...actual, axiosClient: { ...actual.axiosClient, post } };
});

const EXISTING_TAGS: CrmTag[] = [
  { id: "01900100-0000-7000-8000-000000000001", name: "VIP", backgroundColor: null, textColor: null },
  { id: "01900100-0000-7000-8000-000000000002", name: "Enterprise", backgroundColor: null, textColor: null },
];

const wrapper = ({ children }: { children: React.ReactNode }) =>
  createElement(I18nProvider, null, children);

function renderTagModal(options: Parameters<typeof useCreateTagModal>[0]) {
  return renderHook(() => useCreateTagModal(options), { wrapper });
}

describe("useCreateTagModal", () => {
  const onSuccess = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("initializes name from initialName when opened", () => {
    const { result } = renderTagModal({
      open: true,
      initialName: "Custom Tag",
      existingTags: EXISTING_TAGS,
      onSuccess,
      onClose,
    });

    expect(result.current.name).toBe("Custom Tag");
    expect(result.current.charCount).toBe(10);
    expect(result.current.fieldError).toBeNull();
    expect(result.current.serverError).toBeNull();
  });

  it("validates required name on blur when empty", () => {
    const { result } = renderTagModal({
        open: true,
        initialName: "",
        existingTags: EXISTING_TAGS,
        onSuccess,
        onClose,
    });

    act(() => {
      result.current.handleBlur();
    });

    expect(result.current.fieldError).toBeTruthy();
    expect(result.current.isSubmitDisabled).toBe(true);
  });

  it("validates maximum 60 characters", () => {
    const { result } = renderTagModal({
        open: true,
        initialName: "a".repeat(61),
        existingTags: EXISTING_TAGS,
        onSuccess,
        onClose,
    });

    act(() => {
      result.current.handleBlur();
    });

    expect(result.current.fieldError).toBeTruthy();
    expect(result.current.isSubmitDisabled).toBe(true);
  });

  it("validates duplicate tag name case-insensitively", () => {
    const { result } = renderTagModal({
        open: true,
        initialName: "vip",
        existingTags: EXISTING_TAGS,
        onSuccess,
        onClose,
    });

    act(() => {
      result.current.handleBlur();
    });

    expect(result.current.fieldError).toBeTruthy();
  });

  it("posts to /api/tenant/crm/v1/tags and triggers onSuccess and onClose", async () => {
    const newTagId = "01900100-0000-7000-8000-000000000099";
    post.mockResolvedValueOnce({
      data: {
        id: newTagId,
        name: "New Category",
        createdAt: "2026-09-14T00:00:00.000Z",
        updatedAt: "2026-09-14T00:00:00.000Z",
      },
    });

    const { result } = renderTagModal({
        open: true,
        initialName: "New Category",
        existingTags: EXISTING_TAGS,
        onSuccess,
        onClose,
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(post).toHaveBeenCalledWith("/api/tenant/crm/v1/tags", {
      name: "New Category",
    });
    expect(onSuccess).toHaveBeenCalledWith({
      id: newTagId,
      name: "New Category",
      backgroundColor: null,
      textColor: null,
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("sends the colour pair with the name and keeps it on the created tag", async () => {
    const newTagId = "01900100-0000-7000-8000-000000000098";
    post.mockResolvedValueOnce({
      data: {
        id: newTagId,
        name: "Hot",
        backgroundColor: "#FEE2E2",
        textColor: "#991B1B",
        createdAt: "2026-09-24T00:00:00.000Z",
        updatedAt: "2026-09-24T00:00:00.000Z",
      },
    });

    const { result } = renderTagModal({
      open: true,
      initialName: "Hot",
      existingTags: EXISTING_TAGS,
      onSuccess,
      onClose,
    });

    act(() => {
      result.current.handleColorChange({ backgroundColor: "#FEE2E2", textColor: "#991B1B" });
    });
    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(post).toHaveBeenCalledWith("/api/tenant/crm/v1/tags", {
      name: "Hot",
      backgroundColor: "#FEE2E2",
      textColor: "#991B1B",
    });
    expect(onSuccess).toHaveBeenCalledWith({
      id: newTagId,
      name: "Hot",
      backgroundColor: "#FEE2E2",
      textColor: "#991B1B",
    });
  });

  it("maps 422 CRM_TAG_COLOR_INCOMPLETE to the colour message", async () => {
    post.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 422, data: { errorCode: "CRM_TAG_COLOR_INCOMPLETE" } },
    });

    const { result } = renderTagModal({
      open: true,
      initialName: "Half colour",
      existingTags: [],
      onSuccess,
      onClose,
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.serverError).toBe(ar.crmTags.errors.colorIncomplete);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("handles 409 CRM_TAG_NAME_TAKEN from server", async () => {
    const error = {
      isAxiosError: true,
      response: {
        status: 409,
        data: { errorCode: "CRM_TAG_NAME_TAKEN" },
      },
    };
    post.mockRejectedValueOnce(error);

    const { result } = renderTagModal({
        open: true,
        initialName: "Taken Tag",
        existingTags: [],
        onSuccess,
        onClose,
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.fieldError).toBeTruthy();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("handles 422 CRM_TAG_LIMIT_EXCEEDED from server", async () => {
    const error = {
      isAxiosError: true,
      response: {
        status: 422,
        data: { errorCode: "CRM_TAG_LIMIT_EXCEEDED" },
      },
    };
    post.mockRejectedValueOnce(error);

    const { result } = renderTagModal({
        open: true,
        initialName: "Overflow Tag",
        existingTags: [],
        onSuccess,
        onClose,
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.serverError).toBeTruthy();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
