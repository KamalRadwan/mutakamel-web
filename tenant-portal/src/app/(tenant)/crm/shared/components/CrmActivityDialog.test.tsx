// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { api, authMock } = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  authMock: {
    user: { permissions: ["activities.read", "activities.create"], isTenantOwner: false },
    isLoading: false,
  },
}));

vi.mock("@/lib/api/axiosClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/axiosClient")>()),
  axiosClient: api,
}));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => authMock }));

import { en } from "@/i18n/dictionaries/en";
import { CrmActivityDialog } from "./CrmActivityDialog";

vi.mock("@/i18n/I18nContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/i18n/I18nContext")>()),
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));

const TARGET = {
  id: "01900100-0000-7000-8000-000000000001",
  name: "Al-Amal Hospital",
  targetType: "CUSTOMER_PROFILE" as const,
};

function listBody(items: unknown[]) {
  return {
    data: {
      success: true,
      data: {
        items,
        total: items.length,
        page: 1,
        limit: 25,
        totalPages: 1,
        hasNext: false,
      },
      correlationId: "c",
    },
    headers: new Headers(),
    status: 200,
  };
}

const PLANNED = {
  id: "01900100-0000-7000-8000-0000000000b1",
  subject: "Follow up with procurement",
  type: "CALL",
  priority: "HIGH",
  dueAt: "2026-09-20T10:00:00.000Z",
  description: "Discuss contract terms",
  version: 1,
};

function localInput(hours: number): string {
  const at = new Date(Date.now() + hours * 60 * 60 * 1000);
  return new Date(at.getTime() - at.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

beforeEach(() => {
  api.get.mockResolvedValue(listBody([PLANNED]));
  api.post.mockResolvedValue({
    data: {
      success: true,
      data: { ...PLANNED, id: "01900100-0000-7000-8000-0000000000b2" },
      correlationId: "c",
    },
    headers: new Headers(),
    status: 201,
  });
});

afterEach(cleanup);

describe("CrmActivityDialog", () => {
  it("renders both the planned activity list and create form", async () => {
    render(
      <CrmActivityDialog
        target={TARGET}
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />,
    );

    expect(await screen.findByText("Follow up with procurement")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(en.crmLeads.activities.subject)).toBeInTheDocument();
  });

  it("submits a new activity via POST to core activities route", async () => {
    const onCreated = vi.fn();
    render(
      <CrmActivityDialog
        target={TARGET}
        onClose={vi.fn()}
        onCreated={onCreated}
      />,
    );

    const subjectInput = await screen.findByPlaceholderText(en.crmLeads.activities.subject);
    fireEvent.change(subjectInput, { target: { value: "Review tender documents" } });

    const dueInput = screen.getByPlaceholderText(en.crmLeads.activities.dueAt);
    fireEvent.change(dueInput, { target: { value: localInput(24) } });

    const submitBtn = screen.getByRole("button", { name: en.crmLeads.activities.submit });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        "/api/tenant/core/v1/activities",
        expect.objectContaining({
          subject: "Review tender documents",
          targetType: "CUSTOMER_PROFILE",
          targetId: TARGET.id,
        }),
        expect.anything(),
      );
      expect(onCreated).toHaveBeenCalledOnce();
    });
  });
});
