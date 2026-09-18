// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { api, authMock } = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  authMock: {
    user: { permissions: ["crm.lead_stages.read", "crm.lead_stages.manage"], isTenantOwner: false },
    isLoading: false,
  },
}));

vi.mock("@/lib/api/axiosClient", () => ({
  axiosClient: api,
  TenantApiClientError: class TenantApiClientError extends Error {},
  unwrapCoreData: (payload: unknown) => payload,
}));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => authMock }));
vi.mock("next/navigation", () => ({ usePathname: () => "/crm/lead-stages" }));

import { I18nProvider } from "@/i18n/I18nContext";
import { en } from "@/i18n/dictionaries/en";
import { TooltipProvider } from "@/design-system";
import LeadStagesPage from "./page";

const ENTRY = {
  id: "01900100-0000-7000-8000-000000000001",
  nameAr: "جديد",
  nameEn: "New",
  flag: "NEW",
  category: "IN_PROGRESS",
  sortOrder: 1,
  isDefault: true,
  isActive: true,
};
const CONTACTED = {
  ...ENTRY,
  id: "01900100-0000-7000-8000-000000000002",
  nameAr: "تم التواصل",
  nameEn: "Contacted",
  flag: "CONTACTED",
  sortOrder: 2,
  isDefault: false,
};
const QUALIFIED = {
  ...CONTACTED,
  id: "01900100-0000-7000-8000-000000000003",
  nameAr: "مؤهَّل",
  nameEn: "Qualified",
  flag: "QUALIFIED",
  sortOrder: 3,
};
const DISQUALIFIED = {
  ...CONTACTED,
  id: "01900100-0000-7000-8000-000000000004",
  nameAr: "غير مؤهل",
  nameEn: "Disqualified",
  flag: "DISQUALIFIED",
  category: "NEGATIVE",
  sortOrder: 4,
};
const CONVERTED = {
  ...CONTACTED,
  id: "01900100-0000-7000-8000-000000000005",
  nameAr: "تم التحويل",
  nameEn: "Converted",
  flag: "CONVERTED",
  category: "POSITIVE",
  sortOrder: 5,
};
const CATALOGUE = [ENTRY, CONTACTED, QUALIFIED, DISQUALIFIED, CONVERTED];

function renderPage() {
  return render(
    <I18nProvider>
      <TooltipProvider>
        <LeadStagesPage />
      </TooltipProvider>
    </I18nProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  window.localStorage.setItem("tenant_lang", "en");
  api.get.mockResolvedValue({ data: CATALOGUE });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Lead stages — ranking by drag", () => {
  it("gives every stage it can reorder a grip named after it", async () => {
    renderPage();

    expect(await screen.findByLabelText("Drag to reorder: Contacted")).toBeInTheDocument();
    expect(screen.getByLabelText("Drag to reorder: Qualified")).toBeInTheDocument();
    // The CRM pins the NEW stage at rank 1 and answers 422
    // LEAD_STAGE_REORDER_INVALID for any order that moves it, so it carries no
    // handle to move it with.
    expect(screen.queryByLabelText("Drag to reorder: New")).toBeNull();
    expect(screen.queryByLabelText("Drag to reorder: Disqualified")).toBeNull();
    expect(screen.queryByLabelText("Drag to reorder: Converted")).toBeNull();
  });

  it("withdraws the handles while a search narrows the table, and says why", async () => {
    renderPage();
    await screen.findByLabelText("Drag to reorder: Contacted");

    fireEvent.change(screen.getByPlaceholderText(/Search by stage name/u), {
      target: { value: "qual" },
    });

    // FilterBar debounces, so the handles go with the query, not the keystroke.
    await waitFor(() => expect(screen.queryByLabelText(/Drag to reorder: /u)).toBeNull());
    expect(screen.getByRole("note")).toHaveTextContent(/Clear the search to reorder/u);
  });

  it("opens create and edit as centered modals", async () => {
    renderPage();

    fireEvent.click(
      await screen.findByRole("button", { name: en.crm.addANewStage }),
    );
    expect(screen.getByRole("dialog", { name: en.crmLeadStages.addTitle })).toHaveClass(
      "max-w-[672px]",
    );
    fireEvent.click(screen.getByRole("button", { name: en.common.cancel }));

    fireEvent.click(
      screen.getByLabelText(`${en.crmLeadStages.editTitle}: Contacted`),
    );
    expect(screen.getByRole("dialog", { name: en.crmLeadStages.editTitle })).toHaveClass(
      "max-w-[672px]",
    );
  });

  it("does not offer edits, deletes, defaults, or rank handles for terminal anchors", async () => {
    renderPage();
    expect((await screen.findAllByText("Disqualified")).length).toBeGreaterThan(0);

    for (const name of ["New", "Disqualified", "Converted"]) {
      expect(
        screen.getByLabelText(`${en.crmLeadStages.editTitle}: ${name}`),
      ).toBeDisabled();
      expect(
        screen.getByLabelText(`${en.common.delete}: ${name}`),
      ).toBeDisabled();
    }
    for (const name of ["Disqualified", "Converted"]) {
      expect(
        screen.getByLabelText(`${en.crmLeadStages.setDefault}: ${name}`),
      ).toBeDisabled();
    }
  });
});
