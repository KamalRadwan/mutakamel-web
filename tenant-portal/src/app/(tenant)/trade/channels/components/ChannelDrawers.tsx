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
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  CHANNEL_CODE_MAX_LENGTH,
  CHANNEL_KNOWN_STATUSES,
  CHANNEL_NAME_MAX_LENGTH,
  CHANNEL_STATUS_MAX_LENGTH,
  CHANNEL_TYPES,
  EMPTY_CHANNEL_FORM,
  toChannelForm,
  type Channel,
  type ChannelFormValues,
  type ChannelType,
} from "../channel-contract";

interface ChannelDrawerProps {
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: ChannelFormValues) => Promise<boolean>;
}

function useDrawerLabels() {
  const { t } = useI18n();
  return {
    submit: t.trade.save,
    cancel: t.common.cancel,
    discardTitle: t.common.discardTitle,
    discardDescription: t.common.discardDescription,
    discardConfirm: t.common.discardConfirm,
    discardCancel: t.common.cancel,
  };
}

function ChannelFields({
  values,
  onChange,
  isSubmitting,
  isEdit,
}: {
  values: ChannelFormValues;
  onChange: (patch: Partial<ChannelFormValues>) => void;
  isSubmitting: boolean;
  isEdit: boolean;
}) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-4">
      <Field
        label={t.trade.channelCode}
        hint={t.trade.channelCodeHint}
        readOnly={isEdit}
        required={!isEdit}
      >
        <Input
          dir="ltr"
          value={values.code}
          onChange={(event) => onChange({ code: event.target.value.toUpperCase() })}
          maxLength={CHANNEL_CODE_MAX_LENGTH}
          disabled={isSubmitting}
          readOnly={isEdit}
          required={!isEdit}
        />
      </Field>

      <Field label={t.trade.channelName} required>
        <Input
          value={values.name}
          onChange={(event) => onChange({ name: event.target.value })}
          maxLength={CHANNEL_NAME_MAX_LENGTH}
          disabled={isSubmitting}
          required
        />
      </Field>

      {/* `UpdateChannelDto` carries no `channelType`, so on edit this is
          information the user needs but cannot change — readOnly, not disabled. */}
      <Field label={t.trade.channelType} hint={t.trade.channelTypeHint} readOnly={isEdit} required>
        <Select
          value={values.channelType}
          onValueChange={(next) => onChange({ channelType: next as ChannelType })}
          disabled={isSubmitting || isEdit}
        >
          <SelectTrigger aria-label={t.trade.channelType} aria-readonly={isEdit}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHANNEL_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {t.trade[`channelType_${type}`]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {isEdit ? (
        <Field label={t.common.status} hint={t.trade.channelStatusHint}>
          <Input
            dir="ltr"
            list="trade-channel-statuses"
            value={values.status}
            onChange={(event) => onChange({ status: event.target.value.toUpperCase() })}
            maxLength={CHANNEL_STATUS_MAX_LENGTH}
            disabled={isSubmitting}
          />
        </Field>
      ) : null}

      {/* Free text, not an enum: source pins only ACTIVE. The datalist offers
          the values that are known without pretending the set is closed. */}
      <datalist id="trade-channel-statuses">
        {CHANNEL_KNOWN_STATUSES.map((status) => (
          <option key={status} value={status} />
        ))}
      </datalist>
    </div>
  );
}

export function CreateChannelDrawer({
  isOpen,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: ChannelDrawerProps & { isOpen: boolean }) {
  const { t } = useI18n();
  const labels = useDrawerLabels();
  const [values, setValues] = useState<ChannelFormValues>(EMPTY_CHANNEL_FORM);
  const isDirty = JSON.stringify(values) !== JSON.stringify(EMPTY_CHANNEL_FORM);

  return (
    <FormDrawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setValues(EMPTY_CHANNEL_FORM);
          onClose();
        }
      }}
      title={t.trade.channelCreateTitle}
      description={t.trade.channelCreateDescription}
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      onSubmit={() => {
        void onSubmit(values).then((saved) => {
          if (saved) setValues(EMPTY_CHANNEL_FORM);
        });
      }}
      error={error ?? undefined}
      labels={labels}
    >
      <ChannelFields
        values={values}
        onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
        isSubmitting={isSubmitting}
        isEdit={false}
      />
    </FormDrawer>
  );
}

export function EditChannelDrawer({
  channel,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: ChannelDrawerProps & { channel: Channel }) {
  const { t } = useI18n();
  const labels = useDrawerLabels();
  const initial = toChannelForm(channel);
  const [values, setValues] = useState<ChannelFormValues>(initial);
  const isDirty = JSON.stringify(values) !== JSON.stringify(initial);

  return (
    <FormDrawer
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t.trade.channelEditTitle}
      description={t.trade.channelEditDescription}
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      onSubmit={() => void onSubmit(values)}
      error={error ?? undefined}
      labels={labels}
    >
      <ChannelFields
        values={values}
        onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
        isSubmitting={isSubmitting}
        isEdit
      />
    </FormDrawer>
  );
}
