"use client";

import {
  ArrowUpDown,
  CheckCircle2,
  Circle,
  FolderPlus,
  MoveRight,
  Pencil,
  Power,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  Badge,
  Button,
  cn,
  Field,
  FormModal,
  IdentifierText,
  Input,
  SWATCH_SURFACE_PALETTES,
  Textarea,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import type { NormalizedApiError } from "@/lib/api/errors";
import type { CategoryCommand } from "../category-api";
import {
  CATEGORY_DOMAIN_HUES,
  COMMON_CATEGORY_LOCALES,
  getCategoryDomainMetadata,
  STARTER_CATEGORY_TEMPLATES,
  suggestValidCategoryCodes,
} from "../category-catalogue-metadata";
import {
  useCategoryEditor,
  type CategoryEditorRequest,
} from "../hooks/useCategoryEditor";
import { CategoryTargetPicker } from "./CategoryTargetPicker";

export function CategoryEditor({
  editor,
  busy,
  uncertain,
  canWrite,
  error,
  onSubmit,
  onClose,
  onRetry,
}: {
  editor: CategoryEditorRequest;
  busy: boolean;
  uncertain: boolean;
  canWrite: boolean;
  error?: NormalizedApiError;
  onSubmit: (command: CategoryCommand) => Promise<void>;
  onClose: () => void;
  onRetry: () => void;
}) {
  const { t, lang } = useI18n();
  const copy = t.trade.categories;
  const form = useCategoryEditor(editor, onSubmit);
  const title =
    editor.action === "create"
      ? copy.add
      : editor.action === "update"
        ? copy.edit
        : editor.action === "status"
          ? editor.source?.status === "ACTIVE"
            ? copy.deactivate
            : copy.activate
          : copy[editor.action];

  const description =
    editor.action === "create" || editor.action === "update"
      ? copy.modalViewDescription
      : undefined;

  const metadata = editor.action === "create" || editor.action === "update";
  const pending = busy || uncertain;
  const locked = pending || !canWrite;

  const effectiveCode = editor.source?.code ?? form.code;
  const previewDepth =
    editor.action === "create"
      ? editor.parent
        ? editor.parent.depth + 1
        : 1
      : (editor.source?.depth ?? 1);

  const meta = getCategoryDomainMetadata(
    effectiveCode,
    form.displayName,
    previewDepth,
  );
  const palette = SWATCH_SURFACE_PALETTES[meta.hue];
  const depthPalette = SWATCH_SURFACE_PALETTES[meta.depthHue];

  const fieldError = (
    field: keyof typeof form.issues,
    apiField: string = field,
  ) =>
    form.attempted && form.issues[field]
      ? copy.formInvalid
      : error?.fieldErrors?.[apiField]?.join(" ");

  const showCodeSuggestions =
    editor.action === "create" &&
    (form.issues.code || error?.code === "TRADE.CATALOG.CATEGORY_CODE_TAKEN") &&
    Boolean(form.code.trim() || form.displayName.trim());

  const codeSuggestions = showCodeSuggestions
    ? suggestValidCategoryCodes(form.code, form.displayName)
    : [];

  const applyStarterTemplate = (
    template: (typeof STARTER_CATEGORY_TEMPLATES)[number],
  ) => {
    if (locked) return;
    form.setCode(template.code);
    form.setDisplayName(template.displayName);
    for (const entry of form.names) {
      if (entry.locale === "en") {
        form.changeName(entry.key, { name: template.nameEn });
      } else if (entry.locale === "ar") {
        form.changeName(entry.key, { name: template.nameAr });
      }
    }
  };

  const applyQuickLocale = (localeCode: string) => {
    if (locked) return;
    const emptyRow = form.names.find((entry) => !entry.locale.trim());
    if (emptyRow) {
      form.changeName(emptyRow.key, { locale: localeCode });
    }
  };

  const ActionIcon =
    editor.action === "create"
      ? FolderPlus
      : editor.action === "update"
        ? Pencil
        : editor.action === "move"
          ? MoveRight
          : editor.action === "reorder"
            ? ArrowUpDown
            : editor.action === "status"
              ? Power
              : Trash2;

  const readinessItems = [
    {
      id: "code",
      label: copy.readinessCode,
      ready: !form.issues.code,
    },
    {
      id: "displayName",
      label: copy.readinessDisplayName,
      ready: !form.issues.displayName,
    },
    {
      id: "translations",
      label: copy.readinessTranslations,
      ready: !form.issues.localizedNames,
    },
    {
      id: "target",
      label: copy.readinessTarget,
      ready: !form.issues.target,
    },
  ];

  const asideContent = (
    <div className="flex flex-col gap-3.5 p-4">
      {/* 1. Live Catalog Preview Card */}
      <div className="grid gap-2.5 rounded-lg border border-border bg-card p-3.5 shadow-2xs">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-foreground">
            {copy.livePreviewTitle}
          </span>
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-2xs font-medium",
              depthPalette.badge,
            )}
          >
            {formatTemplate(copy.levelBadge, {
              depth: formatNumber(previewDepth, lang),
            })}
          </span>
        </div>

        <div
          className={cn(
            "mt-1 rounded-lg border border-s-4 p-3",
            palette.sectionCard,
            palette.accentBorder,
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <IdentifierText className="rounded-sm border border-border bg-card px-1.5 py-0.5 text-2xs font-semibold">
              {effectiveCode.trim() || copy.code}
            </IdentifierText>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-medium",
                palette.badge,
              )}
            >
              <span
                className={cn("size-1.5 rounded-full", palette.dot)}
                aria-hidden="true"
              />
              {copy[`domain_${meta.domain}`]}
            </span>
          </div>
          <p className="mt-2 break-words text-sm font-semibold text-foreground">
            {form.displayName.trim() || copy.defaultName}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {form.names
              .filter((entry) => entry.locale.trim() && entry.name.trim())
              .map((entry) => (
                <span
                  key={entry.key}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-0.5 text-2xs text-foreground"
                >
                  <IdentifierText className="text-2xs font-semibold">
                    {entry.locale}
                  </IdentifierText>
                  <span>{entry.name}</span>
                </span>
              ))}
          </div>
        </div>
      </div>

      {/* 2. Setup Readiness Checklist */}
      {metadata ? (
        <div className="grid gap-2.5 rounded-lg border border-border bg-card p-3.5 shadow-2xs">
          <span className="text-xs font-semibold text-foreground">
            {copy.readinessTitle}
          </span>
          <ul className="grid gap-1.5 text-xs">
            {readinessItems.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-2 rounded-md border border-border bg-muted/35 px-2.5 py-1.5"
              >
                {item.ready ? (
                  <CheckCircle2
                    className="size-3.5 shrink-0 text-success-subtle-foreground"
                    aria-hidden="true"
                  />
                ) : (
                  <Circle
                    className="size-3.5 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                )}
                <span
                  className={
                    item.ready
                      ? "font-medium text-foreground"
                      : "text-muted-foreground"
                  }
                >
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* 3. Pending Changes Before/After Summary on Edit */}
      {editor.action === "update" && editor.source ? (
        <div className="grid gap-2.5 rounded-lg border border-border bg-card p-3.5 shadow-2xs">
          <span className="text-xs font-semibold text-foreground">
            {copy.pendingChangesTitle}
          </span>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md border border-border bg-muted/35 p-2">
              <div className="text-2xs text-muted-foreground">
                {t.trade.uomEditDiffBefore}
              </div>
              <div className="mt-1 break-words font-medium text-foreground">
                {editor.source.displayName}
              </div>
            </div>
            <div className="rounded-md border border-border bg-success-subtle/25 p-2">
              <div className="text-2xs text-muted-foreground">
                {t.trade.uomEditDiffAfter}
              </div>
              <div className="mt-1 break-words font-semibold text-foreground">
                {form.displayName.trim() || editor.source.displayName}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );

  const fields = (
    <div className="space-y-4">
      {/* Quick Starter Templates for Create Mode */}
      {editor.action === "create" ? (
        <div className="rounded-lg border border-border bg-card p-3 shadow-2xs">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
            <span>{copy.quickTemplatesTitle}</span>
          </div>
          <p className="mt-0.5 text-2xs text-muted-foreground">
            {copy.quickTemplatesHint}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {STARTER_CATEGORY_TEMPLATES.map((tpl) => {
              const tplPalette =
                SWATCH_SURFACE_PALETTES[CATEGORY_DOMAIN_HUES[tpl.domain]];
              return (
                <Button
                  key={tpl.code}
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={locked}
                  onClick={() => applyStarterTemplate(tpl)}
                  className={cn(
                    "h-auto gap-1.5 rounded-full px-2.5 py-1 text-2xs font-medium",
                    tplPalette.badge,
                  )}
                >
                  <span
                    className={cn("size-1.5 rounded-full", tplPalette.dot)}
                    aria-hidden="true"
                  />
                  <span>{tpl.code}</span>
                </Button>
              );
            })}
          </div>
        </div>
      ) : null}

      {metadata ? (
        <div className="space-y-4 rounded-lg border border-border bg-card p-3.5 shadow-2xs">
          <Field
            label={copy.code}
            error={
              fieldError("code") ??
              (error?.code === "TRADE.CATALOG.CATEGORY_CODE_TAKEN"
                ? error.message
                : undefined)
            }
            required
            readOnly={editor.action === "update"}
            showLabel
          >
            <Input
              value={editor.source?.code ?? form.code}
              readOnly={editor.action === "update"}
              disabled={locked}
              onChange={(event) => form.setCode(event.target.value)}
              dir="ltr"
              maxLength={80}
            />
          </Field>

          {codeSuggestions.length > 0 ? (
            <div className="rounded-md border border-border bg-muted/35 p-2.5">
              <p className="text-2xs font-medium text-muted-foreground">
                {copy.suggestedCodesLabel}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {codeSuggestions.map((suggestion) => (
                  <Button
                    key={suggestion}
                    type="button"
                    variant="outline"
                    size="xs"
                    disabled={locked}
                    onClick={() => form.setCode(suggestion)}
                  >
                    <IdentifierText>{suggestion}</IdentifierText>
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          <Field
            label={copy.defaultName}
            error={
              fieldError("displayName") ??
              (error?.code === "TRADE.CATALOG.CATEGORY_NAME_TAKEN"
                ? error.message
                : undefined)
            }
            required
            showLabel
          >
            <Input
              value={form.displayName}
              onChange={(event) => form.setDisplayName(event.target.value)}
              disabled={locked}
            />
          </Field>

          <fieldset className="space-y-3 border-t border-border pt-3">
            <legend className="text-sm font-medium">{copy.translations}</legend>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-2xs text-muted-foreground">
                {copy.locale}:
              </span>
              {COMMON_CATEGORY_LOCALES.map((preset) => (
                <Button
                  key={preset.code}
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={locked}
                  onClick={() => applyQuickLocale(preset.code)}
                  className="h-auto rounded-full bg-muted/40 px-2 py-0.5 text-2xs font-medium"
                >
                  {preset.code}
                </Button>
              ))}
            </div>
            {form.names.map((entry) => (
              <div key={entry.key} className="flex flex-wrap items-end gap-2">
                <Field
                  label={copy.locale}
                  error={fieldError("localizedNames")}
                  showLabel
                  className="w-28"
                >
                  <Input
                    value={entry.locale}
                    dir="ltr"
                    disabled={locked}
                    onChange={(event) =>
                      form.changeName(entry.key, { locale: event.target.value })
                    }
                  />
                </Field>
                <Field
                  label={copy.translatedName}
                  error={fieldError("localizedNames")}
                  showLabel
                  className="min-w-0 flex-1"
                >
                  <Input
                    value={entry.name}
                    disabled={locked}
                    onChange={(event) =>
                      form.changeName(entry.key, { name: event.target.value })
                    }
                  />
                </Field>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={locked || form.names.length <= 1}
                  aria-label={`${t.common.delete} ${entry.locale}`}
                  onClick={() => form.removeName(entry.key)}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              disabled={locked || form.names.length >= 20}
              onClick={form.addName}
            >
              {copy.addTranslation}
            </Button>
          </fieldset>
        </div>
      ) : null}

      {editor.action === "create" && editor.parent ? (
        <div className="rounded-lg border border-border bg-card p-3 text-sm shadow-2xs">
          <span className="font-medium text-muted-foreground">
            {copy.parent}:{" "}
          </span>
          <span className="font-semibold text-foreground">
            {editor.parent.path.map((entry) => entry.name).join(" / ")}
          </span>
        </div>
      ) : editor.action === "create" ||
        editor.action === "move" ||
        editor.action === "reorder" ? (
        <div className="rounded-lg border border-border bg-card p-3.5 shadow-2xs">
          <CategoryTargetPicker
            mode={editor.action === "reorder" ? "before" : "parent"}
            source={editor.action === "create" ? null : editor.source}
            value={form.target}
            onChange={form.setTarget}
            disabled={locked}
            error={fieldError(
              "target",
              editor.action === "reorder" ? "beforeId" : "parentId",
            )}
          />
        </div>
      ) : null}

      {editor.action === "status" || editor.action === "delete" ? (
        <div className="rounded-lg border border-border bg-card p-3.5 shadow-2xs">
          <Field
            label={copy.reason}
            error={fieldError("reason")}
            required
            showLabel
          >
            <Textarea
              value={form.reason}
              onChange={(event) => form.setReason(event.target.value)}
              disabled={locked}
            />
          </Field>
        </div>
      ) : null}

      {!canWrite ? (
        <p className="text-sm text-muted-foreground" role="status">
          {copy.writeUnavailable}
        </p>
      ) : null}
      {uncertain ? (
        <Button
          variant="outline"
          onClick={onRetry}
          disabled={busy || !canWrite}
        >
          {copy.retryOriginal}
        </Button>
      ) : null}
    </div>
  );

  const shared = {
    open: true,
    title,
    description,
    isDirty: form.dirty,
    isSubmitting: pending,
    submitDisabled: !canWrite,
    onOpenChange: (open: boolean) => {
      if (!open && !pending) onClose();
    },
    onSubmit: () => {
      if (!locked) void form.save();
    },
    error: form.invalid ? copy.formInvalid : error?.message,
    labels: {
      submit: title,
      cancel: t.common.cancel,
      discardTitle: t.common.discardTitle,
      discardDescription: t.common.discardDescription,
      discardConfirm: t.common.discardConfirm,
      discardCancel: t.common.cancel,
    },
  };

  return (
    <FormModal
      {...shared}
      size="wide"
      bodyClassName="bg-muted/35 dark:bg-background"
      headerIcon={
        <div
          className={cn(
            "mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg border",
            palette.iconBoxIdle,
          )}
        >
          <ActionIcon className="size-5" aria-hidden="true" />
        </div>
      }
      titleBadge={
        editor.source ? (
          <Badge tone={editor.source.effectiveActive ? "positive" : "neutral"}>
            {editor.source.code}
          </Badge>
        ) : undefined
      }
      asideSlot={asideContent}
      labels={{
        ...shared.labels,
        sections: copy.translations,
        sectionInvalid: copy.formInvalid,
        close: t.common.close,
      }}
    >
      {fields}
    </FormModal>
  );
}
