"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  Combobox,
  DegradedBanner,
  EmptyState,
  ErrorState,
  Field,
  FormDrawer,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@/design-system";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { useTenantBranchSelection } from "@/hooks/useTenantBranchSelection";
import { useCrmRecordOptions } from "@/hooks/useCrmRecordOptions";
import {
  OUTBOUND_EMAIL_SOURCE_TYPES,
  type OutboundEmailRecipientReference,
  type OutboundEmailSourceType,
} from "../outbound-email-contract";
import type { useOutboundEmailComposer } from "../hooks/useOutboundEmailComposer";

interface ComposeEmailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  composer: ReturnType<typeof useOutboundEmailComposer>;
  error?: string;
  onSend: (
    sourceType: OutboundEmailSourceType,
    sourceId: string,
    recipient: OutboundEmailRecipientReference,
    templateVersionId: string | null,
  ) => void;
}

function recipientKey(reference: OutboundEmailRecipientReference): string {
  return reference.kind === "PARTY_CONTACT"
    ? `PARTY_CONTACT:${reference.partyId}:${reference.contactId}`
    : "SOURCE_PRIMARY_CONTACT";
}

export function ComposeEmailDrawer({
  open,
  onOpenChange,
  composer,
  error,
  onSend,
}: ComposeEmailDrawerProps) {
  const { t } = useI18n();
  const { user } = useTenantAuth();
  const { branchIds, branchId, selectBranch } = useTenantBranchSelection(user);
  const [sourceType, setSourceType] =
    useState<OutboundEmailSourceType>("LEAD");
  const [sourceId, setSourceId] = useState<string | undefined>(undefined);
  const [sourceLabel, setSourceLabel] = useState<string | undefined>(undefined);
  const [recipientId, setRecipientId] = useState<string>("");
  const [templateVersionId, setTemplateVersionId] = useState<string>("");
  // Seeded once; the caller remounts this drawer each time it opens and
  // clears the composer alongside it.
  const records = useCrmRecordOptions(sourceType, branchId);

  const { options } = composer;
  const recipient = options?.recipients.find(
    (candidate) => recipientKey(candidate.reference) === recipientId,
  );
  const chosenTemplateVersionId =
    templateVersionId || options?.assignedTemplateVersionId || "";
  const blockedByAvailability = (options?.availability.length ?? 0) > 0;
  const canPreviewOrSend = Boolean(
    sourceId && recipient && !blockedByAvailability,
  );

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={t.crmOutboundEmails.composeTitle}
      description={t.crmOutboundEmails.composeDescription}
      isDirty={sourceId !== undefined}
      isSubmitting={composer.isSending}
      submitDisabled={!canPreviewOrSend}
      error={error}
      onSubmit={() => {
        if (!sourceId || !recipient) return;
        onSend(
          sourceType,
          sourceId,
          recipient.reference,
          chosenTemplateVersionId || null,
        );
      }}
      labels={{
        submit: t.crmOutboundEmails.queueSend,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
      }}
    >
      <TenantBranchSelect
        branchIds={branchIds}
        branchId={branchId}
        onChange={(next) => {
          selectBranch(next);
          setSourceId(undefined);
          setSourceLabel(undefined);
          composer.reset();
        }}
      />

      <Field label={t.crmOutboundEmails.sourceType}>
        <Select
          value={sourceType}
          onValueChange={(next) => {
            setSourceType(next as OutboundEmailSourceType);
            setSourceId(undefined);
            setSourceLabel(undefined);
            composer.reset();
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OUTBOUND_EMAIL_SOURCE_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {t.crmTasks.sourceTypeValues[type] ?? type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label={t.crmOutboundEmails.sourceRecord} required>
        <Combobox
          value={sourceId}
          selectedLabel={sourceLabel}
          onValueChange={(next) => {
            setSourceId(next);
            setSourceLabel(
              records.options.find((option) => option.value === next)?.label,
            );
            setRecipientId("");
            setTemplateVersionId("");
            if (next) void composer.loadOptions(sourceType, next);
            else composer.reset();
          }}
          options={records.options}
          onSearch={records.search}
          loading={records.isLoading}
          placeholder={t.crmOutboundEmails.sourceRecordPlaceholder}
          searchPlaceholder={t.common.search}
          loadingLabel={t.common.loading}
          emptyLabel={t.crmTasks.recordsEmpty}
          clearLabel={t.common.dismiss}
        />
      </Field>

      {composer.isLoadingOptions ? (
        <Skeleton className="h-20 w-full" />
      ) : composer.optionsError ? (
        <ErrorState
          title={t.crmOutboundEmails.optionsFailed}
          description={t.crmOutboundEmails.optionsFailedHint}
          retryLabel={t.common.retry}
          onRetry={() => {
            if (sourceId) void composer.loadOptions(sourceType, sourceId);
          }}
        />
      ) : options ? (
        <>
          {/* `availability` is the server saying why sending is impossible for
              this record. It is a setup gap, not a failure — an empty state
              naming the missing step, never a red banner. */}
          {options.availability.map((reason) => (
            <EmptyState
              key={reason}
              title={t.crmOutboundEmails.unavailableTitles[reason] ?? reason}
              description={
                t.crmOutboundEmails.unavailableDescriptions[reason] ?? ""
              }
            />
          ))}

          <Field label={t.crmOutboundEmails.recipient} required>
            <Select
              value={recipientId || undefined}
              disabled={options.recipients.length === 0}
              onValueChange={(next) => {
                setRecipientId(next);
                composer.clearPreview();
              }}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t.crmOutboundEmails.recipientPlaceholder}
                />
              </SelectTrigger>
              <SelectContent>
                {options.recipients.map((candidate) => (
                  <SelectItem
                    key={recipientKey(candidate.reference)}
                    value={recipientKey(candidate.reference)}
                  >
                    {`${candidate.displayName} · ${candidate.maskedAddress}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field
            label={t.crmOutboundEmails.template}
            hint={t.crmOutboundEmails.templateHint}
          >
            <Select
              value={chosenTemplateVersionId || undefined}
              disabled={options.templates.length === 0}
              onValueChange={(next) => {
                setTemplateVersionId(next);
                composer.clearPreview();
              }}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t.crmOutboundEmails.templatePlaceholder}
                />
              </SelectTrigger>
              <SelectContent>
                {options.templates.map((template) => (
                  <SelectItem
                    key={template.templateVersionId}
                    value={template.templateVersionId}
                  >
                    {`${template.name} · v${template.versionNumber} · ${template.locale}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              disabled={!canPreviewOrSend || composer.isPreviewing}
              onClick={() => {
                if (!sourceId || !recipient) return;
                void composer.loadPreview(
                  sourceType,
                  sourceId,
                  recipient.reference,
                  chosenTemplateVersionId || null,
                );
              }}
            >
              {t.crmOutboundEmails.preview}
            </Button>
            <Badge tone="neutral">
              {`${t.crmOutboundEmails.locale}: ${options.resolvedLocale}`}
            </Badge>
          </div>

          {composer.previewError ? (
            <DegradedBanner message={t.crmOutboundEmails.previewFailed} />
          ) : null}

          {composer.preview ? (
            <div className="flex flex-col gap-1.5 rounded-sm border border-border bg-muted p-2.5">
              <p className="text-sm font-medium text-foreground">
                {composer.preview.subject}
              </p>
              {composer.preview.preheader ? (
                <p className="text-xs text-muted-foreground">
                  {composer.preview.preheader}
                </p>
              ) : null}
              {/* The plain-text alternative, rendered as text. The HTML body
                  is server-authored markup and is never injected into this
                  document. */}
              <pre
                dir={composer.preview.direction === "RTL" ? "rtl" : "ltr"}
                className="max-h-64 overflow-auto whitespace-pre-wrap font-sans text-xs text-foreground"
              >
                {composer.preview.bodyText}
              </pre>
            </div>
          ) : null}
        </>
      ) : null}

      <p className="text-xs text-muted-foreground">
        {t.crmOutboundEmails.queuedNotice}
      </p>
    </FormDrawer>
  );
}
