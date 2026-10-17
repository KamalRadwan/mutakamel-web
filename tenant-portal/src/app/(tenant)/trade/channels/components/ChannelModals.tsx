"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ExternalLink,
  Layers,
  Lock,
  Pencil,
  Sparkles,
  Store,
} from "lucide-react";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FormModal,
  IdentifierText,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SWATCH_SURFACE_PALETTES,
  cn,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDateTime } from "@/lib/format/date";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import {
  CHANNEL_CODE_MAX_LENGTH,
  CHANNEL_KNOWN_STATUSES,
  CHANNEL_NAME_MAX_LENGTH,
  CHANNEL_STATUS_MAX_LENGTH,
  CHANNEL_TYPES,
  EMPTY_CHANNEL_FORM,
  isChannelType,
  toChannelForm,
  type Channel,
  type ChannelFormValues,
  type ChannelType,
} from "../channel-contract";
import {
  CHANNEL_STARTER_TEMPLATES,
  CHANNEL_TYPE_PALETTES,
  CHANNEL_UI_COPY,
  buildDuplicateChannelCodeSuggestions,
  evaluateChannelFormReadiness,
  getChannelPaletteText,
  getChannelTemplateName,
  sanitizeChannelCodeInput,
} from "../channel-catalogue-metadata";

interface ChannelModalProps {
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: ChannelFormValues) => Promise<boolean>;
  existingChannels?: readonly Channel[];
}

function useModalLabels() {
  const { t } = useI18n();
  return {
    submit: t.trade.save,
    cancel: t.common.cancel,
    discardTitle: t.common.discardTitle,
    discardDescription: t.common.discardDescription,
    discardConfirm: t.common.discardConfirm,
    discardCancel: t.common.cancel,
    sections: t.trade.itemFormSections,
    sectionInvalid: t.trade.itemFormHasErrors,
    close: t.common.close,
  };
}

function ChannelLiveAside({
  values,
  existingChannels = [],
  editingChannel,
}: {
  values: ChannelFormValues;
  existingChannels?: readonly Channel[];
  editingChannel?: Channel | null;
}) {
  const { lang, t } = useI18n();
  const copy = CHANNEL_UI_COPY[lang];
  const palette = CHANNEL_TYPE_PALETTES[values.channelType] ?? CHANNEL_TYPE_PALETTES.POS;
  const paletteText = getChannelPaletteText(palette, lang);
  const readiness = evaluateChannelFormReadiness(
    values,
    existingChannels,
    editingChannel?.id ?? null,
  );
  const greenDot = SWATCH_SURFACE_PALETTES.green.dot;
  const amberDot = SWATCH_SURFACE_PALETTES.amber.dot;
  const redDot = SWATCH_SURFACE_PALETTES.red.dot;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {copy.livePreview}
        </span>
        <Badge tone={readiness.allReady ? "positive" : "caution"}>
          {readiness.allReady ? copy.readyToSave : copy.incomplete}
        </Badge>
      </div>

      {/* Colorful Preview Card */}
      <div
        className={cn(
          "relative overflow-hidden rounded-lg border bg-card p-3.5 shadow-xs transition-all",
          palette.cardBorderClass,
        )}
      >
        <div className={cn("-mx-3.5 -mt-3.5 mb-3 h-1.5", palette.topAccentClass)} />
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-md font-semibold",
                palette.iconBgClass,
              )}
            >
              <Store className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <IdentifierText className="block truncate text-xs font-semibold text-foreground">
                {values.code.trim() || "CHANNEL-CODE"}
              </IdentifierText>
              <p className="truncate text-xs text-muted-foreground">
                {values.name.trim() || copy.namePlaceholder}
              </p>
            </div>
          </div>
          <Badge tone={values.status === "ACTIVE" ? "positive" : "neutral"}>
            {values.status || "ACTIVE"}
          </Badge>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2.5">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold",
              palette.badgeClass,
            )}
          >
            <span className={cn("size-1.5 rounded-full", palette.dotClass)} />
            {paletteText.label}
          </span>
          {editingChannel ? (
            <IdentifierText className="text-xs text-muted-foreground">
              If-Match: v{editingChannel.version}
            </IdentifierText>
          ) : (
            <span className="text-xs text-muted-foreground">{copy.companyScope}</span>
          )}
        </div>
      </div>

      {/* Readiness Checklist */}
      <div className="rounded-lg border border-border bg-card p-3">
        <p className="mb-2 text-xs font-semibold text-foreground">{copy.checklistTitle}</p>
        <ul className="flex flex-col gap-1.5 text-xs">
          <li className="flex items-center gap-2">
            <span className={cn("size-2 rounded-full", readiness.codeValid ? greenDot : amberDot)} />
            <span className={readiness.codeValid ? "text-foreground" : "text-muted-foreground"}>
              {copy.codeFormatCheck}
            </span>
          </li>
          <li className="flex items-center gap-2">
            <span className={cn("size-2 rounded-full", readiness.codeUnique ? greenDot : redDot)} />
            <span className={readiness.codeUnique ? "text-foreground" : "text-muted-foreground"}>
              {copy.codeUniqueCheck}
            </span>
          </li>
          <li className="flex items-center gap-2">
            <span className={cn("size-2 rounded-full", readiness.nameValid ? greenDot : amberDot)} />
            <span className={readiness.nameValid ? "text-foreground" : "text-muted-foreground"}>
              {copy.nameLengthCheck}
            </span>
          </li>
          <li className="flex items-center gap-2">
            <span className={cn("size-2 rounded-full", readiness.typeValid ? greenDot : amberDot)} />
            <span className={readiness.typeValid ? "text-foreground" : "text-muted-foreground"}>
              {t.trade.channelType}: <strong>{paletteText.short}</strong>
            </span>
          </li>
        </ul>
      </div>

      {/* Architecture / Governance Note */}
      <div className="rounded-lg border border-border/80 bg-muted/40 p-3 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground">
          {editingChannel ? copy.editGovernanceTitle : copy.createGovernanceTitle}
        </p>
        <p className="mt-1 leading-relaxed">
          {editingChannel ? copy.editGovernanceBody : copy.createGovernanceBody}
        </p>
      </div>
    </div>
  );
}

function ChannelFields({
  values,
  onChange,
  isSubmitting,
  isEdit,
  existingChannels = [],
  editingChannelId,
}: {
  values: ChannelFormValues;
  onChange: (patch: Partial<ChannelFormValues>) => void;
  isSubmitting: boolean;
  isEdit: boolean;
  existingChannels?: readonly Channel[];
  editingChannelId?: string | null;
}) {
  const { t, lang } = useI18n();
  const copy = CHANNEL_UI_COPY[lang];
  const readiness = evaluateChannelFormReadiness(values, existingChannels, editingChannelId);
  const duplicateTaken = !isEdit && values.code.trim().length > 0 && !readiness.codeUnique;
  const suggestions = duplicateTaken
    ? buildDuplicateChannelCodeSuggestions(values.code, existingChannels)
    : [];

  return (
    <div className="flex flex-col gap-4">
      {/* Quick-Start Templates (Create Mode only) */}
      {!isEdit && (
        <div className="rounded-lg border border-border bg-muted/25 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
              {copy.quickStartTitle}
            </span>
            <span className="text-xs text-muted-foreground">{copy.quickStartSubtitle}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CHANNEL_STARTER_TEMPLATES.map((tpl) => {
              const tplPalette = CHANNEL_TYPE_PALETTES[tpl.channelType];
              const tplPaletteText = getChannelPaletteText(tplPalette, lang);
              const isSelected =
                values.code === tpl.code && values.channelType === tpl.channelType;
              return (
                <Button
                  key={tpl.id}
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={() =>
                    onChange({
                      code: tpl.code,
                      name: getChannelTemplateName(tpl, lang),
                      channelType: tpl.channelType,
                    })
                  }
                  className={cn(
                    "gap-1.5 text-xs font-medium",
                    isSelected && tplPalette.badgeClass,
                  )}
                >
                  <span className={cn("size-1.5 rounded-full", tplPalette.dotClass)} />
                  <span>{tplPaletteText.short}</span>
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {/* Locked Identity Notice on Edit */}
      {isEdit && (
        <div
          className={cn(
            "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-xs",
            SWATCH_SURFACE_PALETTES.amber.sectionCard,
          )}
        >
          <Lock
            className={cn("size-4 shrink-0", SWATCH_SURFACE_PALETTES.amber.iconText)}
            aria-hidden="true"
          />
          <span>{copy.lockedIdentityNotice}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label={t.trade.channelCode}
          hint={t.trade.channelCodeHint}
          readOnly={isEdit}
          required={!isEdit}
        >
          <Input
            size="sm"
            placeholder={t.trade.channelCode}
            dir="ltr"
            value={values.code}
            onChange={(event) =>
              onChange({ code: sanitizeChannelCodeInput(event.target.value) })
            }
            maxLength={CHANNEL_CODE_MAX_LENGTH}
            disabled={isSubmitting}
            readOnly={isEdit}
            required={!isEdit}
          />
          {duplicateTaken && (
            <div
              className={cn(
                "mt-1.5 rounded-md border p-2 text-xs",
                SWATCH_SURFACE_PALETTES.red.sectionCard,
              )}
            >
              <p className="font-medium">{t.trade.channelCodeTaken}</p>
              {suggestions.length > 0 && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs opacity-80">{copy.availableAlternatives}</span>
                  {suggestions.map((alt) => (
                    <Button
                      key={alt}
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={() => onChange({ code: alt })}
                      className="font-mono text-xs font-semibold"
                    >
                      {alt}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}
        </Field>

        <Field label={t.trade.channelName} required>
          <Input
            size="sm"
            placeholder={t.trade.channelName}
            value={values.name}
            onChange={(event) => onChange({ name: event.target.value })}
            maxLength={CHANNEL_NAME_MAX_LENGTH}
            disabled={isSubmitting}
            required
          />
        </Field>
      </div>

      {/* `UpdateChannelDto` carries no `channelType`, so on edit this is
          information the user needs but cannot change — readOnly, not disabled. */}
      <Field label={t.trade.channelType} hint={t.trade.channelTypeHint} readOnly={isEdit} required>
        <Select
          value={values.channelType}
          onValueChange={(next) => onChange({ channelType: next as ChannelType })}
          disabled={isSubmitting || isEdit}
        >
          <SelectTrigger size="sm" aria-label={t.trade.channelType} aria-readonly={isEdit}>
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

      {/* Colorful Visual Channel Type Selector Cards */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {CHANNEL_TYPES.map((type) => {
          const palette = CHANNEL_TYPE_PALETTES[type];
          const paletteText = getChannelPaletteText(palette, lang);
          const selected = values.channelType === type;
          return (
            <Button
              key={type}
              type="button"
              variant="outline"
              disabled={isSubmitting || isEdit}
              onClick={() => onChange({ channelType: type })}
              className={cn(
                "h-auto items-start justify-start gap-2.5 rounded-lg border p-2.5 text-start whitespace-normal transition-all",
                selected
                  ? cn("bg-card shadow-xs ring-2 ring-primary/20", palette.cardBorderClass)
                  : "border-border bg-card/60 opacity-85 hover:bg-muted/40 hover:opacity-100",
                isEdit && !selected && "opacity-45",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold",
                  palette.iconBgClass,
                )}
              >
                <span className={cn("size-2 rounded-full", palette.dotClass)} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-1">
                  <span className="truncate text-xs font-semibold text-foreground">
                    {t.trade[`channelType_${type}`]}
                  </span>
                  {selected && (
                    <CheckCircle2 className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                  )}
                </span>
                <span className="mt-0.5 line-clamp-1 block text-xs font-normal text-muted-foreground">
                  {paletteText.description}
                </span>
              </span>
            </Button>
          );
        })}
      </div>

      {isEdit ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-3">
          <div className="grid grid-cols-2 gap-2">
            {(["ACTIVE", "INACTIVE"] as const).map((presetStatus) => {
              const isSelected = values.status.toUpperCase() === presetStatus;
              return (
                <Button
                  key={presetStatus}
                  type="button"
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={() => onChange({ status: presetStatus })}
                  className={cn(
                    "justify-between px-3 py-2 text-xs font-semibold",
                    isSelected &&
                      (presetStatus === "ACTIVE"
                        ? SWATCH_SURFACE_PALETTES.green.tileActive
                        : SWATCH_SURFACE_PALETTES.slate.tileActive),
                  )}
                >
                  <span>{t.trade[`channelStatus_${presetStatus}`]}</span>
                  <Badge tone={presetStatus === "ACTIVE" ? "positive" : "neutral"}>
                    {presetStatus}
                  </Badge>
                </Button>
              );
            })}
          </div>

          <Field label={t.common.status} hint={t.trade.channelStatusHint}>
            <Input
              size="sm"
              placeholder={t.common.status}
              dir="ltr"
              list="trade-channel-statuses"
              value={values.status}
              onChange={(event) => onChange({ status: event.target.value.toUpperCase() })}
              maxLength={CHANNEL_STATUS_MAX_LENGTH}
              disabled={isSubmitting}
            />
          </Field>
        </div>
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

export function CreateChannelModal({
  isOpen,
  isSubmitting,
  error,
  onClose,
  onSubmit,
  existingChannels = [],
}: ChannelModalProps & { isOpen: boolean }) {
  const { t } = useI18n();
  const labels = useModalLabels();
  const [values, setValues] = useState<ChannelFormValues>(EMPTY_CHANNEL_FORM);
  const isDirty = JSON.stringify(values) !== JSON.stringify(EMPTY_CHANNEL_FORM);

  return (
    <FormModal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setValues(EMPTY_CHANNEL_FORM);
          onClose();
        }
      }}
      title={t.trade.channelCreateTitle}
      description={t.trade.channelCreateDescription}
      size="wide"
      asideSlot={<ChannelLiveAside values={values} existingChannels={existingChannels} />}
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
        existingChannels={existingChannels}
      />
    </FormModal>
  );
}

export function EditChannelModal({
  channel,
  isSubmitting,
  error,
  onClose,
  onSubmit,
  existingChannels = [],
}: ChannelModalProps & { channel: Channel }) {
  const { t } = useI18n();
  const labels = useModalLabels();
  const initial = toChannelForm(channel);
  const [values, setValues] = useState<ChannelFormValues>(initial);
  const isDirty = JSON.stringify(values) !== JSON.stringify(initial);

  return (
    <FormModal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t.trade.channelEditTitle}
      description={t.trade.channelEditDescription}
      size="wide"
      titleBadge={
        <Badge tone="neutral">
          <IdentifierText>v{channel.version}</IdentifierText>
        </Badge>
      }
      asideSlot={
        <ChannelLiveAside
          values={values}
          existingChannels={existingChannels}
          editingChannel={channel}
        />
      }
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
        existingChannels={existingChannels}
        editingChannelId={channel.id}
      />
    </FormModal>
  );
}

export function ChannelInspectModal({
  channel,
  canManage,
  onClose,
  onEdit,
}: {
  channel: Channel | null;
  canManage: boolean;
  onClose: () => void;
  onEdit: (channel: Channel) => void;
}) {
  const { t, lang } = useI18n();
  const copy = CHANNEL_UI_COPY[lang];
  if (!channel) return null;

  const knownType = isChannelType(channel.channelType) ? channel.channelType : "POS";
  const palette = CHANNEL_TYPE_PALETTES[knownType];
  const paletteText = getChannelPaletteText(palette, lang);
  const isKnownStatus = (CHANNEL_KNOWN_STATUSES as readonly string[]).includes(channel.status);

  return (
    <Dialog
      open={channel !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent size="2xl" closeLabel={t.common.close}>
        <div className={cn("-mx-3.5 -mt-3.5 mb-2 h-2 rounded-t-lg", palette.topAccentClass)} />
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={channel.status === "ACTIVE" ? "positive" : "neutral"}>
              {isKnownStatus
                ? t.trade[`channelStatus_${channel.status as "ACTIVE" | "INACTIVE"}`]
                : channel.status}
            </Badge>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold",
                palette.badgeClass,
              )}
            >
              <span className={cn("size-1.5 rounded-full", palette.dotClass)} />
              {isChannelType(channel.channelType)
                ? t.trade[`channelType_${channel.channelType}`]
                : channel.channelType}
            </span>
            <Badge tone="neutral">
              <IdentifierText>v{channel.version}</IdentifierText>
            </Badge>
          </div>
          <DialogTitle className="mt-1 flex items-center gap-2">
            <IdentifierText className="text-base font-semibold">{channel.code}</IdentifierText>
            <span className="text-muted-foreground">—</span>
            <span>{channel.name}</span>
          </DialogTitle>
          <DialogDescription>{paletteText.description}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-muted/25 p-3.5 sm:grid-cols-2">
          <div>
            <span className="text-xs font-medium text-muted-foreground">
              {t.trade.channelCode}
            </span>
            <p className="mt-0.5 text-sm font-semibold text-foreground">
              <IdentifierText>{channel.code}</IdentifierText>
            </p>
          </div>
          <div>
            <span className="text-xs font-medium text-muted-foreground">
              {t.trade.channelName}
            </span>
            <p className="mt-0.5 text-sm font-semibold text-foreground">{channel.name}</p>
          </div>
          <div>
            <span className="text-xs font-medium text-muted-foreground">
              {t.trade.channelType}
            </span>
            <p className="mt-0.5 text-sm font-semibold text-foreground">
              {isChannelType(channel.channelType)
                ? t.trade[`channelType_${channel.channelType}`]
                : channel.channelType}
            </p>
          </div>
          <div>
            <span className="text-xs font-medium text-muted-foreground">
              {t.trade.updatedAt}
            </span>
            <p className="mt-0.5 text-sm font-medium text-foreground">
              {formatDateTime(channel.updatedAt, lang)}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2.5">
            <Layers className="size-4 text-primary" aria-hidden="true" />
            <div className="text-xs">
              <p className="font-semibold text-foreground">{copy.branchRolloutTitle}</p>
              <p className="text-muted-foreground">{copy.branchRolloutDesc}</p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`${TENANT_ROUTES.tradeChannels}/${channel.id}`}>
              <ExternalLink className="size-3.5" aria-hidden="true" />
              {copy.fullDossier}
            </Link>
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            {t.common.close}
          </Button>
          {canManage && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                onClose();
                onEdit(channel);
              }}
            >
              <Pencil className="size-3.5" aria-hidden="true" />
              {t.trade.channelEditTitle}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
