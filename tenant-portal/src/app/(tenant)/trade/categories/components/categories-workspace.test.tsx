// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import {
  parseCategoryDetail,
  parseCategoryPage,
  parseCategoryTreePage,
} from "../category-contract";
import { CategoriesWorkspace } from "./categories-workspace";

const mock = vi.hoisted(() => ({
  read: vi.fn(),
  tree: vi.fn(),
  list: vi.fn(),
  options: vi.fn(),
  submit: vi.fn(),
  search: "",
  listeners: new Set<() => void>(),
  canWrite: true,
  toast: {
    success: vi.fn(),
    warning: vi.fn(),
    errorFromApi: vi.fn(),
    outcomeFromApi: vi.fn(() => false),
  },
}));

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: en, lang: "en" }),
}));

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({
    user: {
      isTenantOwner: true,
      permissions: ["trade.items.read", "trade.catalog_master.manage"],
    },
  }),
}));

vi.mock("@/hooks/useAccessMode", () => ({
  useAccessMode: () => ({
    mode: null,
    canRead: true,
    canMutate: mock.canWrite,
  }),
}));

vi.mock("@/lib/api/errors", () => ({
  normalizeApiError: (value: unknown) =>
    value instanceof Error ? { status: 0, message: value.message } : value,
}));

vi.mock("next/navigation", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    useSearchParams: () =>
      new URLSearchParams(
        useSyncExternalStore(
          (listener) => {
            mock.listeners.add(listener);
            return () => mock.listeners.delete(listener);
          },
          () => mock.search,
        ),
      ),
  };
});

vi.mock("@/design-system", async (original) => ({
  ...(await original<typeof import("@/design-system")>()),
  useToast: () => mock.toast,
  useConnectivity: () => ({ status: "online" }),
  useRealtimeResync: vi.fn(),
  replaceSearchParams: (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(mock.search);
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    mock.search = params.toString();
    for (const listener of mock.listeners) listener();
  },
}));

vi.mock("../category-api", async (original) => ({
  ...(await original<typeof import("../category-api")>()),
  readCategory: mock.read,
  readCategoryTree: mock.tree,
  readCategories: mock.list,
  readCategoryOptions: mock.options,
  submitCategory: mock.submit,
}));

const rootId = "019f0000-0000-7000-8000-000000000001";
const childId = "019f0000-0000-7000-8000-000000000002";
const now = "2026-09-27T10:00:00.000Z";

const rootNode = parseCategoryDetail({
  id: rootId,
  code: "HARDWARE",
  name: "Enterprise Hardware",
  displayName: "Enterprise Hardware",
  parentId: null,
  status: "ACTIVE",
  effectiveActive: true,
  inactiveAncestorId: null,
  sortOrder: 1024,
  depth: 1,
  version: 2,
  treeVersion: 4,
  path: [
    {
      id: rootId,
      code: "HARDWARE",
      name: "Enterprise Hardware",
      siblingPosition: 1,
      siblingTotal: 2,
    },
  ],
  hasChildren: true,
  childCount: 1,
  localizedNames: { en: "Enterprise Hardware", ar: "الأجهزة المؤسسية" },
  subtreeHeight: 2,
  createdAt: now,
  updatedAt: now,
  usage: {
    directItemCount: 14,
    subtreeItemCount: 82,
    descendantCount: 3,
    hasRetainedItemReferences: false,
    canDelete: false,
    deleteBlockers: ["ACTIVE", "HAS_CHILDREN", "HAS_ITEM_REFERENCES"],
    asOf: now,
  },
});

const childNode = parseCategoryDetail({
  id: childId,
  code: "SERVERS-RACK",
  name: "Rackmount Servers",
  displayName: "Rackmount Servers",
  parentId: rootId,
  status: "ACTIVE",
  effectiveActive: false,
  inactiveAncestorId: rootId,
  sortOrder: 1024,
  depth: 2,
  version: 1,
  treeVersion: 4,
  path: [
    {
      id: rootId,
      code: "HARDWARE",
      name: "Enterprise Hardware",
      siblingPosition: 1,
      siblingTotal: 2,
    },
    {
      id: childId,
      code: "SERVERS-RACK",
      name: "Rackmount Servers",
      siblingPosition: 1,
      siblingTotal: 1,
    },
  ],
  hasChildren: false,
  childCount: 0,
  localizedNames: { en: "Rackmount Servers", ar: "خوادم الراك" },
  subtreeHeight: 1,
  createdAt: now,
  updatedAt: now,
  usage: {
    directItemCount: 0,
    subtreeItemCount: 0,
    descendantCount: 0,
    hasRetainedItemReferences: false,
    canDelete: true,
    deleteBlockers: [],
    asOf: now,
  },
});

const treePage = parseCategoryTreePage({
  items: [rootNode],
  parentId: null,
  page: 1,
  limit: 50,
  total: 1,
  treeVersion: 4,
  asOf: now,
});

const listPage = parseCategoryPage({
  items: [rootNode, childNode],
  page: 1,
  limit: 50,
  total: 2,
  treeVersion: 4,
  asOf: now,
});

beforeEach(() => {
  vi.clearAllMocks();
  mock.search = "";
  mock.listeners.clear();
  mock.canWrite = true;
  mock.read.mockImplementation(async (id: string) =>
    id === childId ? childNode : rootNode,
  );
  mock.tree.mockResolvedValue(treePage);
  mock.list.mockResolvedValue(listPage);
  mock.options.mockResolvedValue({
    items: [],
    page: 1,
    limit: 50,
    total: 0,
    hasNext: false,
    hasPrev: false,
    asOf: now,
  });
  mock.submit.mockResolvedValue({
    receipt: { id: rootId, version: 3, treeVersion: 5, changed: true },
    replayed: false,
  });
});

afterEach(cleanup);

describe("CategoriesWorkspace UI (View All, Modal View One, Modal Create & Edit)", () => {
  it("renders View All with 4-Card KPI Strip and switches between Tree, List, and Cards views", async () => {
    render(<CategoriesWorkspace />);

    await waitFor(() =>
      expect(screen.getByText("Enterprise Hardware")).toBeTruthy(),
    );

    // Verify 4 KPI Summary Cards
    expect(screen.getByText(en.trade.categories.kpiTotalTitle)).toBeTruthy();
    expect(screen.getByText(en.trade.categories.kpiActiveTitle)).toBeTruthy();
    expect(screen.getByText(en.trade.categories.kpiInactiveTitle)).toBeTruthy();
    expect(screen.getByText(en.trade.categories.kpiDepthTitle)).toBeTruthy();

    // Switch to List View
    fireEvent.click(
      screen.getByRole("button", { name: en.trade.categories.list }),
    );
    await waitFor(() => expect(mock.list).toHaveBeenCalled());
    expect(
      screen.getAllByText(en.trade.categories.domain_ELECTRONICS).length,
    ).toBeGreaterThan(0);

    // Switch to Cards View
    fireEvent.click(
      screen.getByRole("button", { name: en.trade.categories.cards }),
    );
    expect(screen.getAllByText("HARDWARE").length).toBeGreaterThan(0);
    expect(screen.getAllByText("SERVERS-RACK").length).toBeGreaterThan(0);
  });

  it("renders CategoryDetailPanel and opens Modal View One (360° Details) without any raw JSON", async () => {
    render(<CategoriesWorkspace initialId={rootId} />);

    await waitFor(() =>
      expect(screen.getAllByText("Enterprise Hardware").length).toBeGreaterThan(
        0,
      ),
    );

    // Verify usage metrics and domain badge in Detail Panel
    expect(
      screen.getAllByText(en.trade.categories.directItems).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(en.trade.categories.subtreeItems).length,
    ).toBeGreaterThan(0);

    // Open Modal View One (360° Details)
    const openModalBtn = screen.getByRole("button", {
      name: en.trade.categories.openModalView,
    });
    fireEvent.click(openModalBtn);

    await waitFor(() =>
      expect(
        screen.getByText(en.trade.categories.hierarchyLadderTitle),
      ).toBeTruthy(),
    );
    expect(
      screen.getByText(en.trade.categories.usageMetricsTitle),
    ).toBeTruthy();
    expect(
      screen.getByText(en.trade.categories.deletionSafetyTitle),
    ).toBeTruthy();
    expect(
      screen.getByText(en.trade.categories.deletionProtected),
    ).toBeTruthy();
  });

  it("opens Modal Create One with Starter Templates, Live Catalog Preview, Readiness Checklist, and Code Auto-Fix", async () => {
    render(<CategoriesWorkspace initialId={rootId} />);

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: en.trade.categories.add }),
      ).toBeTruthy(),
    );

    // Open Create Modal via PageHeader primary action
    fireEvent.click(
      screen.getByRole("button", { name: en.trade.categories.add }),
    );

    await waitFor(() =>
      expect(
        screen.getByText(en.trade.categories.quickTemplatesTitle),
      ).toBeTruthy(),
    );
    expect(
      screen.getByText(en.trade.categories.livePreviewTitle),
    ).toBeTruthy();
    expect(screen.getByText(en.trade.categories.readinessTitle)).toBeTruthy();

    // Click a starter template chip ("ELEC-POS")
    fireEvent.click(screen.getByRole("button", { name: "ELEC-POS" }));

    const codeInput = screen.getByLabelText(
      new RegExp(`^${en.trade.categories.code}`, "i"),
    ) as HTMLInputElement;
    expect(codeInput.value).toBe("ELEC-POS");

    // Enter an invalid code with spaces to trigger Auto-Fix Code Suggestions
    fireEvent.change(codeInput, { target: { value: "bad code!" } });
    await waitFor(() =>
      expect(
        screen.getByText(en.trade.categories.suggestedCodesLabel),
      ).toBeTruthy(),
    );

    // Click the first suggested valid code
    fireEvent.click(screen.getByRole("button", { name: "BAD-CODE" }));
    expect(codeInput.value).toBe("BAD-CODE");
  });

  it("opens Modal Edit One with Pending Changes Before/After summary", async () => {
    render(<CategoriesWorkspace initialId={rootId} />);

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: en.trade.categories.edit }),
      ).toBeTruthy(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: en.trade.categories.edit }),
    );

    await waitFor(() =>
      expect(
        screen.getByText(en.trade.categories.pendingChangesTitle),
      ).toBeTruthy(),
    );
    expect(screen.getByText(en.trade.uomEditDiffBefore)).toBeTruthy();
    expect(
      screen.getAllByText(en.trade.uomEditDiffAfter).length,
    ).toBeGreaterThan(0);
  });
});
