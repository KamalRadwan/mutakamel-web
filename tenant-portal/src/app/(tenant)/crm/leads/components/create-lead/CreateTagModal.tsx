"use client";

import { Field, FormModal, Input, TagColorPicker } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { CrmTag } from "../../../shared/tag-contract";
import { useCreateTagModal } from "../../hooks/useCreateTagModal";

export interface CreateTagModalProps {
  open: boolean;
  initialName?: string;
  existingTags: CrmTag[];
  onSuccess: (newTag: CrmTag) => void;
  onClose: () => void;
}

/**
 * Centered modal card to create a new CRM lead tag in the catalogue.
 * Allowed only for users with the `crm.tags.manage` permission.
 * Sends `{ name }`, or `{ name, backgroundColor, textColor }` when a colour
 * was picked — CreateTagDto accepts both colours or neither.
 */
export function CreateTagModal({
  open,
  initialName = "",
  existingTags,
  onSuccess,
  onClose,
}: CreateTagModalProps) {
  const { t } = useI18n();
  const modal = useCreateTagModal({
    open,
    initialName,
    existingTags,
    onSuccess,
    onClose,
  });

  return (
    <FormModal
      open={open}
      size="card"
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={t.crmLeads.create.createTagTitle}
      description={t.crmLeads.create.createTagDescription}
      isDirty={modal.isDirty}
      isSubmitting={modal.isSubmitting}
      submitDisabled={modal.isSubmitDisabled}
      onSubmit={() => void modal.handleSubmit()}
      error={modal.serverError ?? undefined}
      labels={{
        submit: modal.isSubmitting ? t.crmLeads.create.creatingTag : t.common.create,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
        sections: t.crmShared.formSectionsNav,
        sectionInvalid: t.crmShared.formSectionInvalid,
        close: t.common.close,
      }}
    >
      <div className="space-y-4 py-2">
        <Field
          label={t.crmLeads.create.tagNameLabel}
          error={modal.fieldError ?? undefined}
          required
          hint={`${modal.charCount}/${modal.maxChars}`}
        >
          <Input
            size="sm"
            value={modal.name}
            onChange={(event) => modal.handleNameChange(event.target.value)}
            onBlur={modal.handleBlur}
            placeholder={t.crmLeads.create.tagNamePlaceholder}
            disabled={modal.isSubmitting}
            maxLength={modal.maxChars}
            autoFocus
          />
        </Field>
        <TagColorPicker
          value={modal.color}
          onChange={modal.handleColorChange}
          previewLabel={modal.name}
          disabled={modal.isSubmitting}
        />
      </div>
    </FormModal>
  );
}
