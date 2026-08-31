"use client";

import { useState } from "react";
import { FormDrawer } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { EMPTY_PARTY_FORM, type PartyFormValues } from "../directory-contract";
import { PartyFormFields } from "./PartyFormFields";

interface CreatePartyDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: PartyFormValues) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
}

export function CreatePartyDrawer({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: CreatePartyDrawerProps) {
  const { t } = useI18n();
  const copy = t.coreOperations.directory;
  const [values, setValues] = useState<PartyFormValues>(EMPTY_PARTY_FORM);
  const isDirty = JSON.stringify(values) !== JSON.stringify(EMPTY_PARTY_FORM);

  const close = () => {
    setValues(EMPTY_PARTY_FORM);
    onClose();
  };

  const handleSubmit = async () => {
    if (await onSubmit(values)) setValues(EMPTY_PARTY_FORM);
  };

  return (
    <FormDrawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      title={copy.partyCreateTitle}
      // Contacts, addresses and roles each have their own route and their own
      // permission, so they are added after the party exists rather than
      // smuggled through the create body.
      description={copy.partyCreateDescription}
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      onSubmit={() => void handleSubmit()}
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
        typeReadOnly={false}
      />
    </FormDrawer>
  );
}
