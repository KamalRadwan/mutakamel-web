"use client";

import { FormModal } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { RemoteOptions } from "../../hooks/useCoreOptions";
import type { OrganizationCascadeResult } from "../../hooks/useOrganizationCascade";
import type { OrgFormValidations } from "../hooks/useOrganizationForm";
import type { OrgLevelConfig } from "../level-config";
import type { OrgNodeFormValues } from "../organization-payloads";
import type { EditReadOnlyParents } from "./OrganizationCascadeFields";
import { OrganizationNodeForm } from "./OrganizationNodeForm";
import { ORGANIZATION_LEVEL_ICONS } from "../organization-icons";

interface OrganizationNodeFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  config: OrgLevelConfig;
  values: OrgNodeFormValues;
  onChange: (patch: Partial<OrgNodeFormValues>) => void;
  isDirty: boolean;
  isSubmitting: boolean;
  hasSavedCurrency?: boolean;
  error?: string;
  submitDisabled?: boolean;
  onClose: () => void;
  onSubmit: () => void;
  cascade?: OrganizationCascadeResult;
  leadUserOptions: RemoteOptions;
  canReadUsers: boolean;
  selectedLeadLabel?: string;
  missingUpstreamPermission: boolean;
  validations: OrgFormValidations;
  editReadOnlyParents?: EditReadOnlyParents;
}

/**
 * Centered create/edit `FormModal` for Companies, Branches, Departments, and Teams.
 *
 * Intentionally omits `sections`, `asideSlot`, `sidebarHeader`, and `headerAside`
 * so the modal stays a single centered surface without a side section-navigation rail.
 */
export function OrganizationNodeFormModal({
  open,
  mode,
  config,
  values,
  onChange,
  isDirty,
  isSubmitting,
  hasSavedCurrency,
  error,
  submitDisabled = false,
  onClose,
  onSubmit,
  cascade,
  leadUserOptions,
  canReadUsers,
  selectedLeadLabel,
  missingUpstreamPermission,
  validations,
  editReadOnlyParents,
}: OrganizationNodeFormModalProps) {
  const { t } = useI18n();
  const copy = t.coreIdentity;
  const levelCopy = copy.levels[config.level];
  const LevelIcon = ORGANIZATION_LEVEL_ICONS[config.level];

  return (
    <FormModal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      size="wide"
      headerIcon={<span className="flex size-10 items-center justify-center rounded-md border border-primary/20 bg-primary/5 text-primary"><LevelIcon className="size-5" aria-hidden="true" /></span>}
      title={mode === "edit" ? levelCopy.editTitle : levelCopy.addTitle}
      description={mode === "edit" ? undefined : levelCopy.addDescription}
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      onSubmit={onSubmit}
      error={error}
      submitDisabled={submitDisabled || (mode === "create" && missingUpstreamPermission)}
      labels={{
        submit: mode === "edit" ? t.common.save : levelCopy.add,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
        sections: t.crmShared.formSectionsNav,
        sectionInvalid: t.crmShared.formSectionInvalid,
        close: copy.actions.close,
      }}
    >
      <OrganizationNodeForm
        config={config}
        values={values}
        onChange={onChange}
        mode={mode}
        isSubmitting={isSubmitting}
        hasSavedCurrency={hasSavedCurrency}
        cascade={cascade}
        leadUserOptions={leadUserOptions}
        canReadUsers={canReadUsers}
        selectedLeadLabel={selectedLeadLabel}
        missingUpstreamPermission={missingUpstreamPermission}
        validations={validations}
        editReadOnlyParents={editReadOnlyParents}
      />
    </FormModal>
  );
}
