// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import type { CrmTag } from "../../../shared/tag-contract";
import type { LeadDetail } from "../../lead-contract";
import { LeadIdentityCards } from "./LeadIdentityCards";

const OWNER = "01900100-0000-7000-8000-000000000001";
const tags = vi.hoisted(() => ({ post: vi.fn(), delete: vi.fn(), get: vi.fn(), error: vi.fn(), lang: "en" as "en" | "ar" }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: { en, ar }[tags.lang], lang: tags.lang, dir: { en: "ltr", ar: "rtl" }[tags.lang] }) }));
const actor = vi.hoisted(() => ({ isTenantOwner: true, permissions: [] as string[] }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: { id: "01900100-0000-7000-8000-000000000001", ...actor } }) }));
vi.mock("@/lib/api/axiosClient", async (original) => ({
  ...(await original<typeof import("@/lib/api/axiosClient")>()),
  axiosClient: { post: tags.post, delete: tags.delete, get: tags.get },
}));
vi.mock("@/design-system", async (original) => ({
  ...(await original<typeof import("@/design-system")>()),
  useToast: () => ({ error: tags.error }),
}));
vi.mock("../../components/create-lead/CreateTagModal", () => ({
  CreateTagModal: ({ open, onSuccess }: { open: boolean; onSuccess: (tag: CrmTag) => void }) => open ? (
    <button onClick={() => onSuccess({ id: "01900100-0000-7000-8000-000000000008", name: "Created tag", backgroundColor: null, textColor: null })}>Complete tag creation</button>
  ) : null,
}));
vi.mock("../hooks/useLeadDetailsReferences", () => ({ useLeadDetailsReferences: () => ({
  knownUsers: new Map([["01900100-0000-7000-8000-000000000001", { id: "01900100-0000-7000-8000-000000000001", firstName: "Kamal", lastName: "Radwan" }]]),
  ownerOptions: [{ id: "01900100-0000-7000-8000-000000000001", firstName: "Kamal", lastName: "Radwan" }],
  tags: [{ id: "01900100-0000-7000-8000-000000000007", name: "Priority" }], tagsLoading: false, tagsUnavailable: false,
  canReadUsers: false, usersLoading: false, usersUnavailable: false,
}) }));

const lead = { id: "01900100-0000-7000-8000-000000000003", status: "OPEN", ownerUserId: OWNER, createdByUserId: OWNER, acquisitionSourceId: "01900100-0000-7000-8000-000000000004", acquisitionSourceNameEn: "Website", acquisitionSourceNameAr: "الموقع", createdAt: "2026-09-07T00:00:00.000Z", updatedAt: "2026-09-07T01:00:00.000Z", interestSummary: "Summary", expectedNeed: "Need", description: "Existing note" } as LeadDetail;
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
beforeEach(() => { vi.clearAllMocks(); tags.lang = "en"; actor.isTenantOwner = true; actor.permissions = []; });

describe("Lead details card", () => {
  it("keeps chips visible without offering catalogue access when tag read is missing", () => {
    actor.isTenantOwner = false;
    actor.permissions = ["crm.tags.manage"];
    render(<LeadIdentityCards lead={lead} sources={[]} canEdit allowedOwnerIds={null} onSaved={vi.fn()} onReconcile={vi.fn()} />);
    expect(screen.getByText("Priority")).toBeVisible();
    expect(screen.queryByRole("button", { name: en.crmLeads.executive.attachTag })).not.toBeInTheDocument();
    expect(tags.get).not.toHaveBeenCalled();
  });

  it("allows tag readers to load the catalogue and withdraws it when permission is lost", async () => {
    actor.isTenantOwner = false;
    actor.permissions = ["crm.tags.read"];
    tags.get.mockResolvedValueOnce({ data: [{ id: "01900100-0000-7000-8000-000000000009", name: "Catalogue tag", createdAt: "2026-10-29T00:00:00Z", updatedAt: "2026-10-29T00:00:00Z" }] });
    const props = { lead, sources: [], canEdit: true, allowedOwnerIds: null, onSaved: vi.fn(), onReconcile: vi.fn() };
    const { rerender } = render(<LeadIdentityCards {...props} />);
    fireEvent.click(screen.getByRole("button", { name: en.crmLeads.executive.attachTag }));
    expect(await screen.findByRole("button", { name: "+ Catalogue tag" })).toBeVisible();
    expect(tags.get).toHaveBeenCalledTimes(1);
    actor.permissions = [];
    rerender(<LeadIdentityCards {...props} />);
    expect(screen.queryByRole("button", { name: en.crmLeads.executive.attachTag })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ Catalogue tag" })).not.toBeInTheDocument();
    expect(screen.getByText("Priority")).toBeVisible();
  });

  it.each(["en", "ar"] as const)("allows converted lead tag changes while keeping fields read-only in %s", async (lang) => {
    tags.lang = lang;
    const copy = { en, ar }[lang];
    const existing = { id: "01900100-0000-7000-8000-000000000007", name: "Priority" };
    const attached = { id: "01900100-0000-7000-8000-000000000009", name: "Catalogue tag" };
    const created = { id: "01900100-0000-7000-8000-000000000008", name: "Created tag" };
    tags.get.mockResolvedValueOnce({ data: [{ ...attached, createdAt: "2026-10-29T00:00:00Z", updatedAt: "2026-10-29T00:00:00Z" }] });
    tags.post.mockResolvedValueOnce({ data: [existing, attached] }).mockResolvedValueOnce({ data: [attached, created] });
    tags.delete.mockResolvedValueOnce(undefined);
    render(<LeadIdentityCards lead={{ ...lead, status: "CONVERTED" }} sources={[]} canEdit allowedOwnerIds={null} onSaved={vi.fn()} onReconcile={vi.fn()} />);

    expect(screen.queryByRole("button", { name: copy.crmLeadDetail.saveDetails })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: copy.crmLeadDetail.salesPerson })).toBeDisabled();
    for (const field of screen.getAllByRole("textbox")) expect(field).toHaveAttribute("readonly");
    fireEvent.click(screen.getByRole("button", { name: copy.crmLeads.executive.attachTag }));
    fireEvent.click(await screen.findByRole("button", { name: "+ Catalogue tag" }));
    await waitFor(() => expect(tags.post).toHaveBeenCalledExactlyOnceWith(
      `/api/tenant/crm/v1/leads/${lead.id}/tags`, { tagIds: [attached.id] }, { skipAutoIdempotency: true },
    ));
    expect(screen.getByText("Catalogue tag")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Remove tag Priority" }));
    await waitFor(() => expect(tags.delete).toHaveBeenCalledExactlyOnceWith(`/api/tenant/crm/v1/leads/${lead.id}/tags/${existing.id}`));
    expect(screen.queryByText("Priority")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: copy.crmTags.add }));
    fireEvent.click(screen.getByRole("button", { name: "Complete tag creation" }));
    await waitFor(() => expect(tags.post).toHaveBeenLastCalledWith(
      `/api/tenant/crm/v1/leads/${lead.id}/tags`, { tagIds: [created.id] }, { skipAutoIdempotency: true },
    ));
    expect(screen.getByText("Created tag")).toBeVisible();
  });

  it.each(["OPEN", "CONVERTED"] as const)("hides tag actions without update scope for a %s lead", (status) => {
    render(<LeadIdentityCards lead={{ ...lead, status }} sources={[]} canEdit={false} allowedOwnerIds={[]} onSaved={vi.fn()} onReconcile={vi.fn()} />);
    expect(screen.getByText("Priority")).toBeVisible();
    expect(screen.queryByRole("button", { name: en.crmLeads.executive.attachTag })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove tag Priority" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.crmTags.add })).not.toBeInTheDocument();
    expect(tags.post).not.toHaveBeenCalled();
    expect(tags.delete).not.toHaveBeenCalled();
  });

  it("withdraws an open tag picker when update scope is lost", async () => {
    const catalogueTag = { id: "01900100-0000-7000-8000-000000000009", name: "Catalogue tag", createdAt: "2026-10-29T00:00:00Z", updatedAt: "2026-10-29T00:00:00Z" };
    tags.get.mockResolvedValueOnce({ data: [catalogueTag] });
    const props = { lead: { ...lead, status: "CONVERTED" as const }, sources: [], allowedOwnerIds: null, onSaved: vi.fn(), onReconcile: vi.fn() };
    const { rerender } = render(<LeadIdentityCards {...props} canEdit />);
    fireEvent.click(screen.getByRole("button", { name: en.crmLeads.executive.attachTag }));
    expect(await screen.findByRole("button", { name: "+ Catalogue tag" })).toBeVisible();
    rerender(<LeadIdentityCards {...props} canEdit={false} />);
    expect(screen.queryByRole("button", { name: "+ Catalogue tag" })).not.toBeInTheDocument();
    expect(tags.post).not.toHaveBeenCalled();
  });

  it.each([false, true])("queues a created tag behind a pending removal, including failure=%s", async (fails) => {
    let settle!: () => void;
    tags.delete.mockImplementationOnce(() => new Promise<void>((resolve, reject) => {
      settle = () => fails ? reject(new Error("Refused")) : resolve();
    }));
    const created = { id: "01900100-0000-7000-8000-000000000008", name: "Created tag" };
    tags.post.mockResolvedValueOnce({ data: fails ? [{ id: "01900100-0000-7000-8000-000000000007", name: "Priority" }, created] : [created] });
    render(<LeadIdentityCards lead={lead} sources={[]} canEdit allowedOwnerIds={null} onSaved={vi.fn()} onReconcile={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove tag Priority" }));
    fireEvent.click(screen.getByRole("button", { name: en.crmTags.add }));
    fireEvent.click(screen.getByRole("button", { name: "Complete tag creation" }));
    expect(tags.post).not.toHaveBeenCalled();
    await act(async () => settle());
    await waitFor(() => expect(tags.post).toHaveBeenCalledExactlyOnceWith(
      `/api/tenant/crm/v1/leads/${lead.id}/tags`, { tagIds: [created.id] }, { skipAutoIdempotency: true },
    ));
    expect(screen.getByText("Created tag")).toBeVisible();
    expect(screen.queryByText("Priority") !== null).toBe(fails);
  });

  it("queues creation behind attachment and preserves the settled tags on failure", async () => {
    const existing = { id: "01900100-0000-7000-8000-000000000007", name: "Priority" };
    const attached = { id: "01900100-0000-7000-8000-000000000009", name: "Existing catalogue tag" };
    tags.get.mockResolvedValueOnce({ data: [{ ...attached, createdAt: "2026-10-28T00:00:00Z", updatedAt: "2026-10-28T00:00:00Z" }] });
    let settle!: () => void;
    tags.post.mockImplementationOnce(() => new Promise((resolve) => { settle = () => resolve({ data: [existing, attached] }); }))
      .mockRejectedValueOnce(new Error("Refused"));
    render(<LeadIdentityCards lead={lead} sources={[]} canEdit allowedOwnerIds={null} onSaved={vi.fn()} onReconcile={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: en.crmLeads.executive.attachTag }));
    fireEvent.click(await screen.findByRole("button", { name: "+ Existing catalogue tag" }));
    fireEvent.click(screen.getByRole("button", { name: en.crmTags.add }));
    fireEvent.click(screen.getByRole("button", { name: "Complete tag creation" }));
    expect(tags.post).toHaveBeenCalledTimes(1);
    await act(async () => settle());
    await waitFor(() => expect(tags.error).toHaveBeenCalledWith(en.crmTags.errors.createdNotAttached));
    expect(tags.post).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Priority")).toBeVisible();
    expect(screen.getByText("Existing catalogue tag")).toBeVisible();
    expect(screen.queryByText("Created tag")).not.toBeInTheDocument();
  });

  it.each(["en", "ar"] as const)("explains attachment failure in %s and retains the created catalogue entry for retry", async (lang) => {
    tags.lang = lang;
    const copy = { en, ar }[lang];
    tags.post.mockRejectedValueOnce(new Error("Refused"));
    render(<LeadIdentityCards lead={lead} sources={[]} canEdit allowedOwnerIds={null} onSaved={vi.fn()} onReconcile={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: copy.crmTags.add }));
    fireEvent.click(screen.getByRole("button", { name: "Complete tag creation" }));
    await waitFor(() => expect(tags.error).toHaveBeenCalledExactlyOnceWith(copy.crmTags.errors.createdNotAttached));
    expect(screen.queryByRole("button", { name: "Complete tag creation" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: copy.crmLeads.executive.attachTag }));
    expect(screen.getByRole("button", { name: "+ Created tag" })).toBeVisible();
  });
  it("keeps labels visible and fields accessible without unclaimed Field controls", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<LeadIdentityCards lead={lead} sources={[]} canEdit allowedOwnerIds={null} onSaved={vi.fn()} onReconcile={vi.fn()} />);
    expect(screen.getByText("Website")).toBeVisible();
    expect(screen.queryByText(en.crmLeadDetail.usersPermissionRequired)).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: en.crmLeadDetail.salesPerson })).toBeEnabled();
    expect(screen.getByText("Priority")).toBeVisible();
    expect(screen.getAllByText("Kamal Radwan")).toHaveLength(2);
    expect(screen.getAllByText("KR")).toHaveLength(2);
    expect(screen.getAllByText(en.crmLeadDetail.createdBy).find((node) => node.tagName === "DT")).toBeVisible();
    const summary = screen.getByRole("textbox", { name: en.crmLeadDetail.interestSummary });
    expect(summary).not.toHaveAttribute("readonly");
    expect(screen.queryByRole("button", { name: "Edit details" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: en.crmLeadDetail.saveDetails })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: en.crmLeads.source })).toHaveTextContent("Website");
    expect(screen.queryByRole("textbox", { name: en.crmLeadDetail.createdBy })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: en.crmLeadDetail.notes }), { target: { value: "Unsaved" } });
    expect(screen.getByRole("button", { name: en.crmLeadDetail.saveDetails })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: en.common.cancel }));
    expect(screen.getByRole("textbox", { name: en.crmLeadDetail.notes })).toHaveValue("Existing note");
    expect(screen.getByRole("textbox", { name: en.crmLeadDetail.notes })).not.toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: en.crmLeadDetail.saveDetails })).toBeDisabled();
    expect(consoleError).not.toHaveBeenCalled();
  });
  it("keeps the creator immutable and does not offer editing without capability", () => {
    render(<LeadIdentityCards lead={lead} sources={[]} canEdit={false} allowedOwnerIds={[]} onSaved={vi.fn()} onReconcile={vi.fn()} />);
    expect(screen.queryByRole("button", { name: en.crmLeadDetail.saveDetails })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: en.crmLeadDetail.salesPerson })).toBeDisabled();
    expect(screen.getAllByRole("textbox")).toHaveLength(3);
    for (const field of screen.getAllByRole("textbox")) expect(field).toHaveAttribute("readonly");
  });
  it("supports starting in clean View Mode and toggling into Edit Mode on demand", () => {
    render(
      <LeadIdentityCards
        lead={lead}
        sources={[]}
        canEdit
        viewModeByDefault
        allowedOwnerIds={null}
        onSaved={vi.fn()}
        onReconcile={vi.fn()}
      />,
    );
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(screen.getByText("Summary")).toBeVisible();
    expect(screen.getByText("Existing note")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: en.crmTags.edit }));
    expect(screen.getByRole("textbox", { name: en.crmLeadDetail.interestSummary })).toHaveValue("Summary");
    fireEvent.click(screen.getByRole("button", { name: en.common.cancel }));
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });
});

