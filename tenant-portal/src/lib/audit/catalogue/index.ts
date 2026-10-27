import { coreAuditCatalogue } from "./core";
import { crmAuditCatalogue, crmNotificationSubjects } from "./crm";
import { tradeAuditCatalogue } from "./trade";

export const auditCatalogue = [
  ...coreAuditCatalogue.map(([entityType, labelKey, detailRoute]) => ({ sourceApp: "CORE", entityType, labelKey, detailRoute })),
  ...crmAuditCatalogue.map(([entityType, labelKey, detailRoute]) => ({ sourceApp: "CRM", entityType, labelKey, detailRoute })),
  ...tradeAuditCatalogue.map(([entityType, labelKey, detailRoute]) => ({ sourceApp: "TRADE", entityType, labelKey, detailRoute })),
].map((entry) => {
  const notify = entry.sourceApp === "CRM" && crmNotificationSubjects.has(entry.entityType);
  return { ...entry, notify: { ownerChanged: notify, deleted: notify } };
});

export function auditRecordHref(entityType: string, entityId: string | null): string | null {
  const entry = auditCatalogue.find((candidate) => candidate.entityType === entityType);
  return entry?.detailRoute && entityId ? `${entry.detailRoute}/${encodeURIComponent(entityId)}` : null;
}

export function auditSubjectForPath(pathname: string) {
  // Inventory exposes the same decision receipt under its own detail route.
  const path = pathname.replace(/^\/trade\/inventory\/decisions\//u, "/trade/decisions/");
  const entry = auditCatalogue.find((candidate) => candidate.detailRoute && path.startsWith(`${candidate.detailRoute}/`)
    && !path.slice(candidate.detailRoute.length + 1).includes("/"));
  if (!entry?.detailRoute) return null;
  const entityId = path.slice(entry.detailRoute.length + 1);
  try {
    return entityId ? { entityType: entry.entityType, entityId: decodeURIComponent(entityId) } : null;
  } catch { return null; }
}
