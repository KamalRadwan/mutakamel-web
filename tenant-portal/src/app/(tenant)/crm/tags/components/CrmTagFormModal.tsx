"use client";

import { Field, FormModal, Input, TagColorPicker } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { CrmTagCatalogueItem } from "../../shared/tag-contract";
import { useCrmTagForm } from "../hooks/useCrmTagForm";
import type { CrmTagFormTarget } from "../hooks/useCrmTags";

interface CrmTagFormModalProps {
  target: CrmTagFormTarget;
  existingTags: readonly CrmTagCatalogueItem[];
  onClose: () => void;
  onSaved: (tag: CrmTagCatalogueItem) => void;
  onReloadNeeded: (message: string) => void;
}

/**
 * Create or edit one tag — its name and its colour — in a centred card modal,
 * the same shell the Create Lead flow uses for its inline tag create. Mounted
 * only while open.
 */
export function CrmTagFormModal({ target, existingTags, onClose, onSaved, onReloadNeeded }: CrmTagFormModalProps) {
  const { t } = useI18n();
  const form = useCrmTagForm({ target, existingTags, onSaved, onReloadNeeded });

  return (
    <FormModal
      open
      size="card"
      onOpenChange={(open) => {
        if (!open && !form.isSubmitting) onClose();
      }}
      title={form.isEdit ? t.crmTags.editTitle : t.crmTags.addTitle}
      isDirty={form.isDirty}
      isSubmitting={form.isSubmitting}
      submitDisabled={form.submitDisabled}
      onSubmit={form.submit}
      error={form.serverError ?? undefined}
      labels={{
        submit: form.isSubmitting ? t.crmTags.saving : t.crmTags.save,
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
      <div className="flex flex-col gap-4 py-2">
        <Field
          label={t.crmTags.nameLabel}
          error={form.nameError ?? undefined}
          hint={`${form.charCount}/${form.maxChars}`}
          required
        >
          <Input
            size="sm"
            dir="auto"
            value={form.name}
            onChange={(event) => form.handleNameChange(event.target.value)}
            onBlur={form.handleNameBlur}
            placeholder={t.crmTags.namePlaceholder}
            maxLength={form.maxChars}
            disabled={form.isSubmitting}
            autoFocus
          />
        </Field>
        <TagColorPicker
          value={form.color}
          onChange={form.handleColorChange}
          previewLabel={form.name}
          disabled={form.isSubmitting}
        />
      </div>
    </FormModal>
  );
}
