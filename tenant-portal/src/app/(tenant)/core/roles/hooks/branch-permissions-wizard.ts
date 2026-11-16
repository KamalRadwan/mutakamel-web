import type { StepperStep } from "@/design-system";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { Language } from "@/i18n/useLanguage";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";

export type RoleBranchWizardStep = "scope" | "permissions" | "review";

export function buildRoleBranchStepperSteps(options: {
  step: RoleBranchWizardStep;
  scopeHasBlockingError: boolean;
  anyBranchOverLimit: boolean;
  t: Dictionary;
}): StepperStep[] {
  const { step, scopeHasBlockingError, anyBranchOverLimit, t } = options;
  const copy = t.coreIdentity.roleBranch.steps;
  return [
    {
      id: "scope",
      label: copy.scope,
      state:
        step === "scope" ? (scopeHasBlockingError ? "invalid" : "current") : "complete",
    },
    {
      id: "permissions",
      label: copy.permissions,
      state:
        step === "permissions"
          ? anyBranchOverLimit
            ? "invalid"
            : "current"
          : step === "review"
            ? "complete"
            : "upcoming",
    },
    {
      id: "review",
      label: copy.review,
      state: step === "review" ? "current" : "upcoming",
    },
  ];
}

export function computeRoleBranchSubmitLabel(options: {
  step: RoleBranchWizardStep;
  isClearingAllSaved: boolean;
  t: Dictionary;
}): string {
  const footer = options.t.coreIdentity.roleBranch.footer;
  if (options.step === "scope") {
    return options.isClearingAllSaved ? footer.nextReviewRemoval : footer.nextPermissions;
  }
  return options.step === "permissions" ? footer.reviewChanges : footer.saveChanges;
}

export function computeRoleBranchDiscardDescription(
  dirtyBranchCount: number,
  t: Dictionary,
  lang: Language,
): string {
  const discardCopy = t.coreIdentity.roleBranch.dialogs.discard;
  if (dirtyBranchCount === 1) return discardCopy.oneBranchDescription;
  if (dirtyBranchCount === 2) return discardCopy.twoBranchesDescription;
  if (dirtyBranchCount > 2) {
    return formatTemplate(discardCopy.manyBranchesDescription, {
      count: formatNumber(dirtyBranchCount, lang),
    });
  }
  return discardCopy.generalDescription;
}

export function resolveWizardStepClick(options: {
  target: RoleBranchWizardStep;
  effectiveMode: "edit" | "view";
  isClearingAllSaved: boolean;
  scopeInvalid: boolean;
  anyBranchOverLimit: boolean;
}): {
  nextStep: RoleBranchWizardStep | null;
  flagScopeInvalid?: boolean;
  ensureActiveBranch?: boolean;
} {
  if (options.effectiveMode === "view" || options.target === "scope") {
    return { nextStep: options.target };
  }
  if (options.isClearingAllSaved) {
    return { nextStep: options.target === "review" ? "review" : null };
  }
  if (options.scopeInvalid) {
    return { nextStep: "scope", flagScopeInvalid: true };
  }
  if (options.target === "review" && options.anyBranchOverLimit) {
    return { nextStep: "permissions" };
  }
  return { nextStep: options.target, ensureActiveBranch: true };
}
