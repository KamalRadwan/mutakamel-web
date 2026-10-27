// @vitest-environment jsdom

import { createElement, type ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import type { CrmActionCapability } from "../crm-capabilities";
import { RecordNotesSection } from "./RecordNotesSection";

const state = vi.hoisted(() => ({ canEdit: false, canDelete: false }));
vi.mock("./CrmScopeGate", () => ({ CrmScopeGate: () => null }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en }) }));
vi.mock("../hooks/useCrmErrorText", () => ({ useCrmErrorText: () => () => null }));
vi.mock("../hooks/useAmbiguousOutcomeLabels", () => ({
  useAmbiguousOutcomeLabels: () => ({}), useAppliedUnreadableLabels: () => ({}),
}));
vi.mock("../hooks/useCrmNotes", () => ({ useCrmNotes: () => ({
  notes: [{ id: "note", body: "Saved note", updatedAt: "2026-10-17T00:00:00Z", ...state }],
  isLoading: false, loadError: null, writeError: null, ambiguity: null, appliedUnreadable: null,
  pendingId: null,
}) }));
vi.mock("@/design-system", () => ({
  PermissionGate: ({ children }: { children: ReactNode }) => <>{children}</>,
  DetailSection: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  Button: ({ children }: { children: ReactNode }) => createElement("button", null, children),
  Textarea: () => <textarea aria-label="Create note" />,
  DateTime: () => null, AmbiguousOutcomePanel: () => null,
  EmptyState: () => null, ErrorState: () => null, Skeleton: () => null,
}));
vi.mock("./NoteRow", () => ({ NoteRow: ({ canEdit, canDelete }: { canEdit: boolean; canDelete: boolean }) => (
  <li>{canEdit && createElement("button", null, "Edit")}{canDelete && createElement("button", null, "Delete")}</li>
) }));

afterEach(cleanup);
const ownCreate: CrmActionCapability = { scope: "own", ownerUserIds: ["actor"] };
const show = (createCapability: CrmActionCapability | null, readOnly = false) => render(
  <RecordNotesSection branchId="branch" sourceType="LEAD" sourceId="source"
    sourceOwnerUserId="other-owner" createCapability={createCapability} readOnly={readOnly} />,
);

describe("note action admission", () => {
  it("does not expose Edit or Delete from create access alone", () => {
    state.canEdit = false;
    state.canDelete = false;
    show({ scope: "all", ownerUserIds: null });
    expect(screen.getByLabelText("Create note")).toBeTruthy();
    expect(screen.queryByText("Edit")).toBeNull();
    expect(screen.queryByText("Delete")).toBeNull();
  });

  it("allows server-approved editing with create.own on another owner's source", () => {
    state.canEdit = true;
    state.canDelete = false;
    show(ownCreate);
    expect(screen.queryByLabelText("Create note")).toBeNull();
    expect(screen.getByText("Edit")).toBeTruthy();
    expect(screen.queryByText("Delete")).toBeNull();
  });

  it("allows a server-approved delete independently of create and edit", () => {
    state.canEdit = false;
    state.canDelete = true;
    show(null);
    expect(screen.queryByText("Edit")).toBeNull();
    expect(screen.getByText("Delete")).toBeTruthy();
  });

  it("keeps the read-only boundary even when both server flags allow writes", () => {
    state.canEdit = true;
    state.canDelete = true;
    show({ scope: "all", ownerUserIds: null }, true);
    expect(screen.queryByLabelText("Create note")).toBeNull();
    expect(screen.queryByText("Edit")).toBeNull();
    expect(screen.queryByText("Delete")).toBeNull();
  });
});
