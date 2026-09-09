import type { AddonAction } from "../hooks/useAddonDefinitionDialog";
import type { AddonCopy } from "./addon-copy";
export function addonActionLabel(action: AddonAction, copy: AddonCopy): string {
  const labels = { CREATE: copy.create, UPDATE: copy.edit, DRAFT_CREATE: copy.clone, PUBLISH: copy.publish, DEPRECATE: copy.deprecate,
    DISABLE: copy.disable, DELETE: copy.remove, VERSION_REVOKE: copy.revoke, COMPATIBILITY_REPLACE: copy.editCompatibility,
    FEATURE_GRANTS_REPLACE: copy.editGrants, COMPONENT_BINDINGS_REPLACE: copy.editBindings, CONFIGURATION_SCHEMA_REPLACE: copy.editSchema };
  return labels[action];
}
export function addonLifecycleLabel(status: "DRAFT" | "ACTIVE" | "DEPRECATED" | "DISABLED", copy: AddonCopy): string {
  return { DRAFT: copy.draft, ACTIVE: copy.activeLabel, DEPRECATED: copy.deprecatedLabel, DISABLED: copy.disabledLabel }[status];
}
export function addonAuditLabel(action: string, copy: AddonCopy): string {
  const labels: Record<string, string> = { ADDON_CREATED: copy.create, ADDON_DRAFT_CREATED: copy.clone, ADDON_UPDATED: copy.edit,
    ADDON_PUBLISHED: copy.publish, ADDON_DEPRECATED: copy.deprecate, ADDON_DISABLED: copy.disable, ADDON_DELETED: copy.remove,
    ADDON_VERSION_REVOKED: copy.revoke, ADDON_COMPATIBILITY_REPLACED: copy.editCompatibility, ADDON_FEATURE_GRANTS_REPLACED: copy.editGrants,
    ADDON_COMPONENT_BINDINGS_REPLACED: copy.editBindings, ADDON_CONFIGURATION_SCHEMA_REPLACED: copy.editSchema, ADDON_PRICE_LADDER_REPLACED: copy.savePrices };
  return labels[action] ?? copy.action;
}
