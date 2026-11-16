import type { CrmFormErrors } from "../../shared/hooks/useCrmCreateForm";

const FAST_FIELDS = new Set(["title", "customerProfileId", "pipelineId", "stageId", "ownerUserId", "amount", "currencyCode", "importance"]);

/** A rejected Fast submit must reveal the field that can resolve its error. */
export function opportunityCreateNeedsFullView(errors: CrmFormErrors, requiredCustomFieldKeys: readonly string[]): boolean {
  return Object.keys(errors).some((path) => {
    if (path.startsWith("customFields.")) {
      return !requiredCustomFieldKeys.includes(path.slice("customFields.".length));
    }
    return !FAST_FIELDS.has(path);
  });
}
