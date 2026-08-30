import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  Textarea,
} from "@/design-system";
import type {
  CreateFeatureDto,
  CreateTierDto,
  FeatureView,
  TierView,
  UpdateFeatureDto,
  UpdateTierDto,
} from "../types";

type Resource = TierView | FeatureView;

interface Props {
  kind: "tier" | "feature";
  applicationKey: string;
  resource?: Resource | null;
  isOpen: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (dto: CreateTierDto | UpdateTierDto | CreateFeatureDto | UpdateFeatureDto) => Promise<unknown>;
}

export function CatalogueResourceDialog({
  kind,
  applicationKey,
  resource,
  isOpen,
  isSubmitting,
  onClose,
  onSubmit,
}: Props) {
  const { lang } = useI18n();
  const copy = resourceDialogCopy(lang);
  const isFeature = kind === "feature";
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rank, setRank] = useState("0");
  const [color, setColor] = useState("#3b82f6");
  const [isActive, setIsActive] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const submissionErrorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    queueMicrotask(() => {
      setKey(resource?.key ?? (isFeature ? `${applicationKey}.` : ""));
      setName(resource?.name ?? "");
      setDescription(resource && "description" in resource ? resource.description ?? "" : "");
      setRank(String(resource?.rank ?? 0));
      setColor(resource && "color" in resource ? resource.color : "#3b82f6");
      setIsActive(resource?.isActive ?? true);
      setFieldErrors({});
      setSubmissionError(null);
    });
  }, [applicationKey, isFeature, isOpen, resource]);

  if (!isOpen) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedKey = key.trim();
    const parsedRank = Number(rank);
    const hasRank = Boolean(resource || isFeature);
    if (!trimmedName) return focusFieldError("name", copy.nameRequired, "catalogue-resource-name", setFieldErrors);
    if (!resource && !trimmedKey) return focusFieldError("key", copy.keyRequired, "catalogue-resource-key", setFieldErrors);
    if (isFeature && !resource && !trimmedKey.startsWith(`${applicationKey}.`)) {
      return focusFieldError("key", copy.featurePrefix(applicationKey), "catalogue-resource-key", setFieldErrors);
    }
    if (
      hasRank &&
      (!rank.trim() || !Number.isFinite(parsedRank) || !Number.isInteger(parsedRank) || parsedRank < 0)
    ) {
      return focusFieldError("rank", copy.rankInvalid, "catalogue-resource-rank", setFieldErrors);
    }

    setFieldErrors({});
    setSubmissionError(null);
    try {
      if (isFeature) {
        const dto = resource
          ? { name: trimmedName, description: description.trim(), rank: parsedRank, isActive }
          : { key: trimmedKey, name: trimmedName, description: description.trim() || undefined, rank: parsedRank, isActive };
        await onSubmit(dto);
      } else {
        const dto = resource
          ? { name: trimmedName, rank: parsedRank, color, isActive }
          : { key: trimmedKey, name: trimmedName, color, isActive };
        await onSubmit(dto);
      }
      onClose();
    } catch (error) {
      setSubmissionError(readSubmissionMessage(error, copy.failed));
      queueMicrotask(() => submissionErrorRef.current?.focus());
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm">
            {resource ? copy.edit : copy.create} {isFeature ? copy.feature : copy.tier}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">{copy.immutableKey}</p>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          {Object.keys(fieldErrors).length > 0 ? (
            <div role="alert" className="rounded-md border border-destructive bg-destructive-subtle px-3 py-2 text-xs text-destructive-subtle-foreground">
              <p className="font-semibold">{copy.validationSummary}</p>
              <ul className="mt-1 list-disc ps-5">
                {Object.entries(fieldErrors).map(([field, message]) => (
                  <li key={field}>
                    <a href={`#catalogue-resource-${field}`} className="underline underline-offset-2">{message}</a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {!resource && (
            <Field id="catalogue-resource-key" label={copy.key} required error={fieldErrors.key}>
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  invalid={Boolean(fieldErrors.key)}
                  value={key}
                  onChange={(event) => { setKey(event.target.value); setFieldErrors({}); }}
                  maxLength={isFeature ? 96 : 64}
                  required
                  dir="ltr"
                />
              )}
            </Field>
          )}
          <Field id="catalogue-resource-name" label={copy.name} required error={fieldErrors.name}>
            {(fieldProps) => (
              <Input
                {...fieldProps}
                invalid={Boolean(fieldErrors.name)}
                value={name}
                onChange={(event) => { setName(event.target.value); setFieldErrors({}); }}
                maxLength={128}
                required
              />
            )}
          </Field>
          {isFeature && (
            <Field label={copy.description}>
              {(fieldProps) => (
                <Textarea {...fieldProps} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={512} rows={3} />
              )}
            </Field>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {resource || isFeature ? (
              <Field id="catalogue-resource-rank" label={copy.rank} error={fieldErrors.rank}>
                {(fieldProps) => <Input {...fieldProps} invalid={Boolean(fieldErrors.rank)} type="number" min={0} step={1} value={rank} onChange={(event) => { setRank(event.target.value); setFieldErrors((current) => omitFieldError(current, "rank")); }} className="font-mono" />}
              </Field>
            ) : null}
            {!isFeature && (
              <Field label={copy.colour}>
                {(fieldProps) => <Input {...fieldProps} type="color" value={color} onChange={(event) => setColor(event.target.value)} className="p-1" />}
              </Field>
            )}
          </div>
          <div className="flex min-h-11 items-center gap-3 rounded-md border border-input px-3 py-2 text-xs font-semibold text-foreground">
            <Checkbox id="catalogue-resource-active" checked={isActive} onCheckedChange={(checked) => setIsActive(checked === true)} />
            <label htmlFor="catalogue-resource-active" className="cursor-pointer">{copy.active}</label>
          </div>
          {submissionError && (
            <div ref={submissionErrorRef} role="alert" tabIndex={-1} className="rounded-md border border-destructive bg-destructive-subtle px-3 py-2 text-xs text-destructive-subtle-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {submissionError}
            </div>
          )}
          <footer className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={onClose}>{copy.cancel}</Button>
            <Button type="submit" variant="primary" loading={isSubmitting}>
              {resource ? copy.save : `${copy.create} ${isFeature ? copy.feature : copy.tier}`}
            </Button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function focusFieldError(
  field: string,
  message: string,
  id: string,
  setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>,
) {
  setErrors({ [field]: message });
  queueMicrotask(() => document.getElementById(id)?.focus());
}

function readSubmissionMessage(value: unknown, fallback: string) {
  if (value instanceof Error) return value.message;
  if (value && typeof value === "object" && "message" in value && typeof value.message === "string") return value.message;
  return fallback;
}

function omitFieldError(errors: Record<string, string>, field: string) {
  const next = { ...errors };
  delete next[field];
  return next;
}

function resourceDialogCopy(lang: "ar" | "en") {
  return lang === "ar"
    ? {
        edit: "تعديل", create: "إنشاء", feature: "ميزة", tier: "فئة",
        immutableKey: "المفاتيح هوية بروتوكول ثابتة ولا يمكن تغييرها لاحقًا.",
        key: "المفتاح", name: "الاسم", description: "الوصف", rank: "الترتيب", colour: "اللون",
        active: "نشط في الكتالوج التجاري", cancel: "إلغاء", save: "حفظ التغييرات",
        nameRequired: "الاسم مطلوب.", keyRequired: "المفتاح مطلوب.",
        rankInvalid: "يجب أن يكون الترتيب عددًا صحيحًا غير سالب.",
        validationSummary: "راجع الحقول الموضحة قبل الحفظ.",
        featurePrefix: (key: string) => `يجب أن يبدأ مفتاح الميزة بـ ${key}.`,
        failed: "تعذر حفظ التغيير.",
      }
    : {
        edit: "Edit", create: "Create", feature: "feature", tier: "tier",
        immutableKey: "Keys are protocol identity and cannot be changed later.",
        key: "Key", name: "Name", description: "Description", rank: "Rank", colour: "Colour",
        active: "Active in the commercial catalogue", cancel: "Cancel", save: "Save changes",
        nameRequired: "Name is required.", keyRequired: "Key is required.",
        rankInvalid: "Rank must be a non-negative whole number.",
        validationSummary: "Review the highlighted fields before saving.",
        featurePrefix: (key: string) => `Feature keys must start with ${key}.`,
        failed: "The change could not be saved.",
      };
}
