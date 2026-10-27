// core-app/packages/database/src/entities/tenant and explicit directory/template
// publishers. Class names and domain names are distinct stored audit subjects.
export const coreAuditCatalogue = [
  ["TenantUserEntity", "user", "/core/users"],
  ["TenantRoleEntity", "role", "/core/roles"],
  ["TenantUserBranchRoleEntity", "branchRole", null],
  ["TenantRolePermissionEntity", "rolePermission", null],
  ["party", "party", "/core/directory"],
  ["PartyEntity", "party", "/core/directory"],
  ["template_definition", "template", "/core/templates"],
  ["CompanyEntity", "company", "/core/organization/companies"],
  ["BranchEntity", "branch", "/core/organization/branches"],
  ["DepartmentEntity", "department", "/core/organization/departments"],
  ["TeamEntity", "team", "/core/organization/teams"],
] as const;
