"use client";

import { useState } from "react";
import {
  Field,
  FormDrawer,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  TEMPLATE_DESCRIPTION_MAX,
  TEMPLATE_DIRECTIONS,
  TEMPLATE_NAME_MAX,
  type TemplateDetail,
} from "../../templates-contract";

export function EditTemplateDrawer({
  template,
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: {
  template: TemplateDetail;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (patch: Record<string, unknown>) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
}) {
  const { t } = useI18n();
  const copy = t.coreOperations.templates;
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description ?? "");
  const [direction, setDirection] = useState(template.direction);

  const isDirty =
    name !== template.name ||
    description !== (template.description ?? "") ||
    direction !== template.direction;

  const submit = () => {
    const patch: Record<string, unknown> = {};
    if (name.trim() !== template.name) patch.name = name.trim();
    if (description.trim() !== (template.description ?? "")) {
      patch.description = description.trim() || null;
    }
    // A direction change rewrites the draft, so it cannot be pinned by the
    // definition revision alone — the draft revision rides in the body.
    if (direction !== template.direction) {
      patch.direction = direction;
      patch.expectedDraftRevision = template.currentDraft.revision;
    }
    void onSubmit(patch);
  };

  return (
    <FormDrawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={copy.editTitle}
      description={copy.editDescription}
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      onSubmit={submit}
      error={error ?? undefined}
      labels={{
        submit: t.common.save,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
      }}
    >
      <div className="flex flex-col gap-4">
        <Field label={copy.name} required>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={TEMPLATE_NAME_MAX}
            disabled={isSubmitting}
            required
          />
        </Field>

        <Field label={copy.description}>
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={TEMPLATE_DESCRIPTION_MAX}
            disabled={isSubmitting}
          />
        </Field>

        <Field label={copy.direction} hint={copy.directionChangeHint}>
          <Select
            value={direction}
            onValueChange={setDirection}
            disabled={isSubmitting}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TEMPLATE_DIRECTIONS.map((value) => (
                <SelectItem key={value} value={value}>
                  {copy.directions[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </FormDrawer>
  );
}
