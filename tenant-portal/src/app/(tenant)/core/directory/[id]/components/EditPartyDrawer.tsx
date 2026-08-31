"use client";

import { useState } from "react";
import { FormDrawer } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  toPartyForm,
  type Party,
  type PartyFormValues,
  type PartyStatus,
} from "../../directory-contract";
import { PartyFormFields } from "../../components/PartyFormFields";

interface EditPartyDrawerProps {
  party: Party;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: PartyFormValues, status: PartyStatus) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
}

export function EditPartyDrawer({
  party,
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: EditPartyDrawerProps) {
  const { t } = useI18n();
  const copy = t.coreOperations.directory;
  const initial = toPartyForm(party);
  const [values, setValues] = useState<PartyFormValues>(initial);
  const [status, setStatus] = useState<PartyStatus>(party.status);
  const isDirty = JSON.stringify(values) !== JSON.stringify(initial) || status !== party.status;

  return (
    <FormDrawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={copy.partyEditTitle}
      description={copy.partyEditDescription}
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      onSubmit={() => void onSubmit(values, status)}
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
      <PartyFormFields
        values={values}
        onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
        isSubmitting={isSubmitting}
        // `UpdatePartyDto` carries no `partyType`; it is fixed at creation.
        typeReadOnly
        status={{ value: status, onChange: setStatus }}
      />
    </FormDrawer>
  );
}
