"use client";

import { useState } from "react";
import {
  Field,
  FormDrawer,
  Input,
  MultiSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import {
  EMPTY_WEBHOOK_SUBSCRIPTION_FORM,
  WEBHOOK_ENDPOINT_MAX_LENGTH,
  WEBHOOK_EVENTS_MAX,
  WEBHOOK_RETRY_POLICIES,
  WEBHOOK_SCOPE_TARGETS,
  type WebhookEventDescriptor,
  type WebhookSubscriptionFormValues,
} from "../webhook-contract";

interface CreateWebhookSubscriptionModalProps {
  events: readonly WebhookEventDescriptor[];
  eventsUnavailable: boolean;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: WebhookSubscriptionFormValues) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
}

export function CreateWebhookSubscriptionModal({
  events,
  eventsUnavailable,
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: CreateWebhookSubscriptionModalProps) {
  const { t } = useI18n();
  const [values, setValues] = useState<WebhookSubscriptionFormValues>(
    EMPTY_WEBHOOK_SUBSCRIPTION_FORM,
  );
  const isDirty = JSON.stringify(values) !== JSON.stringify(EMPTY_WEBHOOK_SUBSCRIPTION_FORM);

  return (
    <FormDrawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setValues(EMPTY_WEBHOOK_SUBSCRIPTION_FORM);
          onClose();
        }
      }}
      title={t.tradeAutomation.subscriptionCreateTitle}
      description={t.tradeAutomation.subscriptionCreateDescription}
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      // Without the event catalogue the request cannot carry the field list
      // each event needs, so submitting is blocked rather than guessed.
      submitDisabled={eventsUnavailable}
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
      <div className="flex flex-col gap-3">
        <Field label={t.tradeAutomation.code} required hint={t.tradeGovernance.codeHint}>
          <Input
            value={values.code}
            maxLength={100}
            disabled={isSubmitting}
            onChange={(event) => setValues((current) => ({ ...current, code: event.target.value }))}
          />
        </Field>
        <Field
          label={t.tradeGovernance.scopeTarget}
          required
          hint={t.tradeAutomation.webhookScopeHint}
        >
          <Select
            value={values.scopeTarget}
            disabled={isSubmitting}
            onValueChange={(next) =>
              setValues((current) => ({
                ...current,
                scopeTarget: next as WebhookSubscriptionFormValues["scopeTarget"],
              }))
            }
          >
            <SelectTrigger aria-label={t.tradeGovernance.scopeTarget}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WEBHOOK_SCOPE_TARGETS.map((value) => (
                <SelectItem key={value} value={value}>
                  {tradeStatusLabel(t.tradeStatus, value, t.common.unknownCode)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t.tradeAutomation.endpointUri} required hint={t.tradeAutomation.endpointHint}>
          <Input
            value={values.endpointUri}
            maxLength={WEBHOOK_ENDPOINT_MAX_LENGTH}
            disabled={isSubmitting}
            onChange={(event) =>
              setValues((current) => ({ ...current, endpointUri: event.target.value }))
            }
          />
        </Field>
        <Field label={t.tradeAutomation.retryPolicy} required>
          <Select
            value={values.retryPolicyCode}
            disabled={isSubmitting}
            onValueChange={(next) =>
              setValues((current) => ({
                ...current,
                retryPolicyCode: next as WebhookSubscriptionFormValues["retryPolicyCode"],
              }))
            }
          >
            <SelectTrigger aria-label={t.tradeAutomation.retryPolicy}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WEBHOOK_RETRY_POLICIES.map((value) => (
                <SelectItem key={value} value={value}>
                  {tradeStatusLabel(t.tradeStatus, value, t.common.unknownCode)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field
          label={t.tradeAutomation.maxAttempts}
          required
          hint={t.tradeAutomation.maxAttemptsHint}
        >
          <Input
            type="number"
            min={1}
            max={10}
            value={values.maxAttempts}
            disabled={isSubmitting}
            onChange={(event) =>
              setValues((current) => ({ ...current, maxAttempts: event.target.value }))
            }
          />
        </Field>
        <Field label={t.tradeAutomation.events} required hint={t.tradeAutomation.eventsHint}>
          <MultiSelect
            values={values.eventTypes}
            onValuesChange={(next) =>
              setValues((current) => ({
                ...current,
                eventTypes: next.slice(0, WEBHOOK_EVENTS_MAX),
              }))
            }
            options={events.map((event) => ({ value: event.eventType, label: event.eventType }))}
            placeholder={t.tradeAutomation.eventsPlaceholder}
            emptyLabel={t.tradeAutomation.eventsEmpty}
            moreLabel={t.filters.more}
            removeLabel={t.filters.remove}
            overflowLabel={t.tradeAutomation.events}
            disabled={isSubmitting || eventsUnavailable}
          />
        </Field>
      </div>
    </FormDrawer>
  );
}
