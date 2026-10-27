// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import type { LeadItem, LeadStage } from "../hooks/useLeads";
import { LeadExecutiveTableView } from "./LeadExecutiveTableView";

const locale = vi.hoisted(() => ({ lang: "en" as "ar" | "en" }));
const dictionaries = { ar, en };
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: dictionaries[locale.lang], lang: locale.lang }),
}));
vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({ user: { permissions: [] } }),
}));
vi.mock("./LeadPhoneActionsRow", () => ({ LeadPhoneActionsRow: () => null }));

const lead: LeadItem = {
  id: "01950000-0000-7000-8000-000000000001",
  partyId: "01950000-0000-7000-8000-000000000002",
  leadProfileType: "INDIVIDUAL", leadName: "Dina Ali", company: "",
  email: "", phone: "", phones: [], country: "", primaryContact: null,
  sourceNameAr: "", sourceNameEn: "", sourceIconUrl: null, stageId: "new",
  ownerUserId: null, rating: 0, cardColor: null, owner: null,
  nextActivity: null, tags: [],
  createdAt: "2026-10-01T12:00:00Z", updatedAt: "2026-10-17T11:55:00Z",
};

afterEach(() => {
  cleanup();
  locale.lang = "en";
});

describe("lead table disabled stage accessibility", () => {
  it.each([
    ["en", false, "NEW"], ["ar", false, "NEW"],
    ["en", true, "CONVERTED"], ["ar", true, "CONVERTED"],
  ] as const)("announces the reason and refuses activation (%s, update=%s, %s)", (lang, canUpdate, flag) => {
    locale.lang = lang;
    const stage: LeadStage = {
      id: "new", nameAr: "مرحلة", nameEn: "Stage", flag,
    };
    const onMoveStage = vi.fn();
    render(
      <LeadExecutiveTableView
        items={[lead]} stages={[stage]} branchId="branch" selectedIds={new Set()}
        onSelectionChange={vi.fn()} canUpdate={() => canUpdate} canDelete={() => false}
        isLoading={false} error={null} onRetry={vi.fn()} onOpenQuickModal={vi.fn()}
        onOpenActivities={vi.fn()} onDeleteLead={vi.fn()} onMoveStage={onMoveStage}
        onCardChange={vi.fn()} onInlinePhoneSave={vi.fn()}
      />,
    );
    const name = lang === "ar" ? stage.nameAr : stage.nameEn;
    const button = screen.getByRole("button", {
      name: `${name}. ${dictionaries[lang].crmLeadDetail.stageMoveUnavailable}`,
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    expect(button.tabIndex).toBe(0);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    button.focus();
    expect(document.activeElement).toBe(button);
    fireEvent.click(button);
    expect(screen.queryByText(dictionaries[lang].crmLeads.executive.changeStageInline)).toBeNull();
    expect(onMoveStage).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: dictionaries[lang].crmLeads.executive.addPhone })).toBeNull();
  });
});
