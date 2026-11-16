import { describe, expect, it } from "vitest";
import { generateUUIDv7 } from "@/lib/uuid";
import type { Branch, Company } from "../../contracts/organization-contract";
import type {
  RoleBranchCatalogueItem,
  RoleBranchPermissionsDocument,
} from "../contracts/role-branch-contract";
import { reconcileUncertainSave } from "./branch-permissions-reconcile";
import { computeBranchReviewItems } from "./branch-permissions-review";
import {
  changeBranchActionRecordScope,
  computeNodeSelectionState,
  filterBranchTaxonomy,
  toggleBranchActionRow,
  toggleBranchRowCollection,
} from "./branch-permissions-selection";
import { buildBranchCatalogueTaxonomy } from "./branch-permissions-taxonomy";
import {
  deriveInitialScopeSelection,
  mergeScopeOptionsWithSavedProfiles,
} from "./useRoleBranchScopeOptions";

function makeCatalogueFixture(): RoleBranchCatalogueItem[] {
  const crmModule = { id: "crm", nameAr: "المبيعات", nameEn: "CRM" };
  const leadsGroup = { id: "leads", nameAr: "العملاء المحتملون", nameEn: "Leads" };
  const followUpSub = { id: "activities", nameAr: "المتابعات", nameEn: "Follow-ups" };

  return [
    {
      id: generateUUIDv7(),
      key: "crm.leads.read_own",
      nameAr: "عرض العملاء",
      nameEn: "View leads",
      module: crmModule,
      groups: [leadsGroup],
      scope: "BRANCH",
      recordScope: "OWN",
    },
    {
      id: generateUUIDv7(),
      key: "crm.leads.read_team",
      nameAr: "عرض العملاء",
      nameEn: "View leads",
      module: crmModule,
      groups: [leadsGroup],
      scope: "BRANCH",
      recordScope: "TEAM",
    },
    {
      id: generateUUIDv7(),
      key: "crm.leads.read_all",
      nameAr: "عرض العملاء",
      nameEn: "View leads",
      module: crmModule,
      groups: [leadsGroup],
      scope: "BRANCH",
      recordScope: "ALL",
    },
    {
      id: generateUUIDv7(),
      key: "crm.activities.create",
      nameAr: "إنشاء متابعة",
      nameEn: "Create follow-up",
      module: crmModule,
      groups: [leadsGroup, followUpSub],
      scope: "BRANCH",
      recordScope: null,
    },
    {
      id: generateUUIDv7(),
      key: "roles.role.delete",
      nameAr: "حذف الأدوار",
      nameEn: "Delete roles",
      module: { id: "core", nameAr: "الهوية", nameEn: "Identity" },
      groups: [{ id: "roles", nameAr: "الأدوار", nameEn: "Roles" }],
      scope: "TENANT",
      recordScope: null,
    },
  ];
}

describe("branch permission taxonomy, record scope switching, and non-destructive filtering", () => {
  it("separates TENANT items, pairs real OWN/TEAM/ALL keys without synthetic IDs, and switches record scope", () => {
    const items = makeCatalogueFixture();
    const taxonomy = buildBranchCatalogueTaxonomy(items);

    expect(taxonomy.tenantLockedItems).toHaveLength(1);
    expect(taxonomy.tenantLockedItems[0]?.key).toBe("roles.role.delete");
    expect(taxonomy.modules).toHaveLength(1);

    const leadsGroup = taxonomy.modules[0]!.groups[0]!;
    expect(leadsGroup.directRows).toHaveLength(1);
    expect(leadsGroup.subgroups).toHaveLength(1);

    const viewLeadsRow = leadsGroup.directRows[0]!;
    expect(viewLeadsRow.variants.map((v) => v.scope)).toEqual(["OWN", "TEAM", "ALL"]);
    expect(viewLeadsRow.primaryItem.id).toBe(items[2]!.id);

    const checkedOnce = toggleBranchActionRow([], viewLeadsRow);
    expect(checkedOnce).toEqual([items[2]!.id]);

    const narrowedToOwn = changeBranchActionRecordScope(checkedOnce, viewLeadsRow, "OWN");
    expect(narrowedToOwn).toEqual([items[0]!.id]);

    const nodeState = computeNodeSelectionState(leadsGroup.allRows, new Set(narrowedToOwn));
    expect(nodeState).toEqual({ checked: "indeterminate", summaryKind: "custom" });

    const allChecked = toggleBranchRowCollection(narrowedToOwn, leadsGroup.allRows);
    expect(allChecked).toEqual([items[2]!.id, items[3]!.id]);

    const filteredScoped = filterBranchTaxonomy(taxonomy.modules, {
      searchQuery: "",
      filterMode: "scoped",
      selectedSet: new Set(allChecked),
      lang: "en",
    });
    expect(filteredScoped[0]?.allRows).toHaveLength(1);
    expect(allChecked).toHaveLength(2);
  });
});

describe("scope option auto-selection & uncertain-write reconciliation", () => {
  it("auto-selects sole company & sole branch only when catalogue load is complete and no profiles exist", () => {
    const companyId = generateUUIDv7();
    const branchId = generateUUIDv7();
    const company: Company = {
      id: companyId,
      code: "C1",
      name: "Mutakamel Co",
      status: "ACTIVE",
      legalName: null,
      taxNumber: null,
      currencyCode: "SAR",
      createdAt: "2026-11-01T10:00:00.000Z",
      updatedAt: "2026-11-01T10:00:00.000Z",
    };
    const branch: Branch = {
      id: branchId,
      companyId,
      code: "B1",
      name: "Jeddah Branch",
      status: "ACTIVE",
      address: null,
      phone: null,
      isHeadquarters: true,
      createdAt: "2026-11-01T10:00:00.000Z",
      updatedAt: "2026-11-01T10:00:00.000Z",
    };

    const merged = mergeScopeOptionsWithSavedProfiles([company], [branch], []);
    const completeInit = deriveInitialScopeSelection({
      savedProfiles: [],
      companies: merged.companies,
      branches: merged.branches,
      isComplete: true,
    });
    expect(completeInit.selectedCompanyIds).toEqual([companyId]);
    expect(completeInit.draftProfiles).toEqual({ [branchId]: [] });
    expect(completeInit.autoSelectedSingleCompany).toBe(true);
    expect(completeInit.autoSelectedSingleBranchId).toBe(branchId);

    const incompleteInit = deriveInitialScopeSelection({
      savedProfiles: [],
      companies: merged.companies,
      branches: merged.branches,
      isComplete: false,
    });
    expect(incompleteInit.selectedCompanyIds).toEqual([]);
    expect(incompleteInit.draftProfiles).toEqual({});
  });

  it("computes per-branch diffs and reconciles APPLIED vs CONFLICT vs NOT_APPLIED on uncertain saves", () => {
    const items = makeCatalogueFixture();
    const taxonomy = buildBranchCatalogueTaxonomy(items);
    const companyId = generateUUIDv7();
    const branchA = generateUUIDv7();
    const branchB = generateUUIDv7();

    const doc: RoleBranchPermissionsDocument = {
      roleId: generateUUIDv7(),
      roleName: "Regional Supervisor",
      isSystem: false,
      permissionMode: "BRANCH",
      revision: "7",
      catalogueRevision: "a".repeat(64),
      globalPermissionIds: [],
      profiles: [
        {
          branchId: branchA,
          companyId,
          branchName: "Riyadh",
          companyName: "Mutakamel",
          isActive: true,
          permissionIds: [items[0]!.id],
        },
      ],
      catalogue: items,
      limits: { branches: 100, permissionsPerBranch: 200 },
    };

    const branchesById = new Map([
      [branchA, { id: branchA, companyId, name: "Riyadh", companyName: "Mutakamel", isActive: true }],
      [branchB, { id: branchB, companyId, name: "Dammam", companyName: "Mutakamel", isActive: true }],
    ]);

    const review = computeBranchReviewItems({
      document: doc,
      draftProfiles: { [branchA]: [items[2]!.id, items[3]!.id] },
      selectedCompanyIds: [companyId],
      branchesById,
      taxonomy,
    });
    expect(review.isDirty).toBe(true);
    expect(review.dirtyBranchCount).toBe(1);
    expect(review.items.find((i) => i.branchId === branchA)?.addedCount).toBe(2);
    expect(review.items.find((i) => i.branchId === branchA)?.removedCount).toBe(1);
    expect(review.items.find((i) => i.branchId === branchB)?.isIncluded).toBe(false);

    const intended = [{ branchId: branchA, permissionIds: [items[2]!.id, items[3]!.id] }];
    expect(reconcileUncertainSave(intended, "7", doc)).toBe("NOT_APPLIED");
    expect(
      reconcileUncertainSave(intended, "7", {
        ...doc,
        revision: "8",
        profiles: [{ ...doc.profiles[0]!, permissionIds: [items[2]!.id, items[3]!.id] }],
      }),
    ).toBe("APPLIED");
    expect(
      reconcileUncertainSave(intended, "7", {
        ...doc,
        revision: "8",
        profiles: [{ ...doc.profiles[0]!, permissionIds: [items[3]!.id] }],
      }),
    ).toBe("CONFLICT");
  });
});
