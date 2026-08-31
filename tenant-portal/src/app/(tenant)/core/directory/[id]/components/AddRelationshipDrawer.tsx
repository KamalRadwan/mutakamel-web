"use client";

import { useState } from "react";
import {
  Combobox,
  Field,
  FormDrawer,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  RELATIONSHIP_LABEL_MAX,
  RELATIONSHIP_TYPES,
} from "../../directory-children-contract";
import type { Party } from "../../directory-contract";
import {
  EMPTY_RELATIONSHIP_FORM,
  type RelationshipFormValues,
} from "../../party-child-forms";

interface AddRelationshipDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: RelationshipFormValues) => Promise<boolean>;
  onSearch: (query: string) => void;
  candidates: Party[];
  isSearching: boolean;
  isSubmitting: boolean;
  error: string | null;
}

export function AddRelationshipDrawer({
  isOpen,
  onClose,
  onSubmit,
  onSearch,
  candidates,
  isSearching,
  isSubmitting,
  error,
}: AddRelationshipDrawerProps) {
  const { t } = useI18n();
  const copy = t.coreOperations.directory;
  const [values, setValues] = useState<RelationshipFormValues>(EMPTY_RELATIONSHIP_FORM);
  const isDirty = JSON.stringify(values) !== JSON.stringify(EMPTY_RELATIONSHIP_FORM);
  const selected = candidates.find((candidate) => candidate.id === values.toPartyId);

  return (
    <FormDrawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={copy.relationshipCreateTitle}
      description={copy.relationshipDescription}
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      onSubmit={() => void onSubmit(values)}
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
        <Field label={copy.relationshipTarget} hint={copy.relationshipTargetHint} required>
          <Combobox
            value={values.toPartyId || undefined}
            selectedLabel={selected?.displayName}
            onValueChange={(next) =>
              setValues((current) => ({ ...current, toPartyId: next ?? "" }))
            }
            options={candidates.map((candidate) => ({
              value: candidate.id,
              label: candidate.displayName,
            }))}
            onSearch={onSearch}
            loading={isSearching}
            placeholder={copy.relationshipTargetPlaceholder}
            searchPlaceholder={copy.searchPlaceholder}
            loadingLabel={t.common.loading}
            emptyLabel={copy.empty}
            disabled={isSubmitting}
          />
        </Field>

        <Field label={copy.relationshipType} required>
          <Select
            value={values.relationshipType}
            onValueChange={(value) =>
              setValues((current) => ({
                ...current,
                relationshipType: value as RelationshipFormValues["relationshipType"],
              }))
            }
            disabled={isSubmitting}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RELATIONSHIP_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {copy.relationshipTypes[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label={copy.relationshipLabel}>
          <Input
            value={values.label}
            onChange={(event) =>
              setValues((current) => ({ ...current, label: event.target.value }))
            }
            maxLength={RELATIONSHIP_LABEL_MAX}
            disabled={isSubmitting}
          />
        </Field>

        <Field label={copy.relationshipPrimary}>
          <Switch
            checked={values.isPrimary}
            onCheckedChange={(checked) =>
              setValues((current) => ({ ...current, isPrimary: checked }))
            }
            disabled={isSubmitting}
          />
        </Field>
      </div>
    </FormDrawer>
  );
}
