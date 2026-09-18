import { readCoreData, readCrmBody, type CorePath } from "@/lib/api/envelope";
import { localizedName } from "@/lib/format/localized";
import { isUUIDv7 } from "@/lib/uuid";

export type AuditValueLabels = Readonly<Record<string, Readonly<Record<string, string>>>>;

// Gateway core.tenant.organization.*.get + OrganizationController's read guards.
const ORGANIZATION = {
  companyId: { path: "/api/tenant/core/v1/organization/companies", permission: "org.company.read" },
  branchId: { path: "/api/tenant/core/v1/organization/branches", permission: "org.branch.read" },
  departmentId: { path: "/api/tenant/core/v1/organization/departments", permission: "org.department.read" },
  teamId: { path: "/api/tenant/core/v1/organization/teams", permission: "org.team.read" },
} as const satisfies Record<string, { path: CorePath; permission: string }>;

function organizationReference(field: string) {
  return Object.hasOwn(ORGANIZATION, field) ? ORGANIZATION[field as keyof typeof ORGANIZATION] : undefined;
}

export function auditReferencePermission(field: string): string | undefined {
  return field === "acquisitionSourceId" ? "crm.acquisition_sources.read" : organizationReference(field)?.permission;
}

export async function readAuditReferenceLabel(field: string, id: string, lang: "ar" | "en", signal: AbortSignal): Promise<string> {
  if (!isUUIDv7(id)) throw new Error("Invalid reference identifier.");
  const config = { signal, cache: "no-store", maxResponseBytes: 64 * 1024 } as const;
  const organization = organizationReference(field);
  // AcquisitionSourcesController.findOne returns raw AcquisitionSourceView,
  // including inactive sources; organization detail returns an enveloped Entity.
  const payload = organization ? await readCoreData(`${organization.path}/${encodeURIComponent(id)}`, config)
    : field === "acquisitionSourceId" ? await readCrmBody(`/api/tenant/crm/v1/acquisition-sources/${encodeURIComponent(id)}`, config) : null;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Invalid reference.");
  const row = payload as Record<string, unknown>;
  if (row.id !== id) throw new Error("Reference identity mismatch.");
  const name = organization ? row.name
    : typeof row.nameAr === "string" && typeof row.nameEn === "string"
      ? localizedName({ nameAr: row.nameAr, nameEn: row.nameEn }, lang) : null;
  if (typeof name !== "string" || name.length > 300) throw new Error("Invalid reference name.");
  const label = name.trim();
  if (!label || isUUIDv7(label)) throw new Error("Invalid reference name.");
  return label;
}
