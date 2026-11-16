// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";

const useAuditEventMock = vi.hoisted(() => vi.fn());

vi.mock("./hooks/useAuditEvent", () => ({
  useAuditEvent: (id: string | null) => useAuditEventMock(id),
}));
vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({ user: { permissions: ["audit.read"], isTenantOwner: false } }),
}));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));
vi.mock("@/design-system", async () => ({
  ...(await import("@/design-system/lib/cn")),
  ...(await import("@/design-system/primitives/Avatar")),
  ...(await import("@/design-system/primitives/Badge")),
  ...(await import("@/design-system/primitives/DateTime")),
  ...(await import("@/design-system/primitives/RatingStars")),
  ...(await import("@/design-system/primitives/Skeleton")),
  ...(await import("@/design-system/patterns/detail-section/DetailSection")),
  ...(await import("@/design-system/patterns/error-state/ErrorState")),
  ...(await import("@/design-system/patterns/history-tree/HistoryDiffList")),
  ...(await import("@/design-system/patterns/not-found-state/NotFoundState")),
  ...(await import("@/design-system/patterns/permission-gate/PermissionGate")),
}));

import { AuditEventDetail } from "./AuditEventDetail";

afterEach(cleanup);

describe("AuditEventDetail", () => {
  it("renders the 3-level header and HistoryDiffList transitions instead of raw JSON tables", () => {
    useAuditEventMock.mockReturnValue({
      canRead: true,
      isLoading: false,
      error: null,
      reload: vi.fn(),
      event: {
        id: "01900100-0000-7000-8000-0000000000e1",
        entityType: "Lead",
        entityId: "01900100-0000-7000-8000-000000000001",
        entityLabel: "Acme Industries",
        action: "LEAD_STAGE_CHANGED",
        actorLabel: "Sara Al-Mansour",
        createdAt: "2026-10-29T10:15:00Z",
        outcome: "SUCCESS",
        reason: "Qualified on call",
        diff: [
          { field: "status", before: "OPEN", after: "CONVERTED" },
        ],
        before: { status: "OPEN" },
        after: { status: "CONVERTED" },
      },
    });

    render(<AuditEventDetail id="01900100-0000-7000-8000-0000000000e1" />);

    expect(screen.getByRole("heading", { name: "Acme Industries" })).toBeInTheDocument();
    expect(screen.getByText("Sara Al-Mansour")).toBeInTheDocument();
    expect(screen.getByText(en.audit.actions.LEAD_STAGE_CHANGED)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: en.audit.ledger.liveRecord })).toHaveAttribute(
      "href",
      "/crm/leads/01900100-0000-7000-8000-000000000001",
    );
    expect(screen.getByText(en.statusValues["LeadStatus.OPEN"]!)).toHaveClass("line-through");
    expect(screen.getByText(en.statusValues["LeadStatus.CONVERTED"]!)).toBeInTheDocument();
    expect(screen.getByText("Reason: Qualified on call")).toBeInTheDocument();
  });
});
