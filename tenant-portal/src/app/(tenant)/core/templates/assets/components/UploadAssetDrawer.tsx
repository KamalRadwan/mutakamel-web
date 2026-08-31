"use client";

import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import {
  Button,
  Checkbox,
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
import { formatTemplate } from "@/lib/format/template";
import {
  ASSET_DELIVERY_CLASSES,
  ASSET_FILE_MAX_BYTES,
  ASSET_MIME_TYPES,
  ASSET_TYPES,
} from "../../template-assets-contract";
import { EMPTY_ASSET_UPLOAD, type AssetUploadValues } from "../hooks/useTemplateAssets";

/**
 * `EMAIL_PUBLIC` gets its **own** step.
 *
 * Marking an asset public means it is served without authentication, forever,
 * to anyone holding the id. That is a deliberate decision with no undo, so it
 * is confirmed on its own screen rather than as one more checkbox in a form.
 */
export function UploadAssetDrawer({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: AssetUploadValues) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
}) {
  const { t } = useI18n();
  const copy = t.coreOperations.templates;
  const [values, setValues] = useState<AssetUploadValues>(EMPTY_ASSET_UPLOAD);
  const [isConfirmingPublic, setIsConfirmingPublic] = useState(false);
  const needsPublicConfirmation = values.deliveryClass === "EMAIL_PUBLIC";

  const close = () => {
    setValues(EMPTY_ASSET_UPLOAD);
    setIsConfirmingPublic(false);
    onClose();
  };

  const submit = () => {
    if (needsPublicConfirmation && !values.confirmedPublic) {
      setIsConfirmingPublic(true);
      return;
    }
    void onSubmit(values);
  };

  return (
    <FormDrawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      title={copy.assetUploadTitle}
      description={copy.assetUploadDescription}
      isDirty={values.file !== null}
      isSubmitting={isSubmitting}
      onSubmit={submit}
      error={error ?? undefined}
      submitDisabled={values.file === null}
      labels={{
        submit: needsPublicConfirmation && !values.confirmedPublic ? copy.assetContinue : t.common.save,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
      }}
    >
      {isConfirmingPublic && !values.confirmedPublic ? (
        <div className="flex flex-col gap-3">
          <span className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 size-5 text-destructive" aria-hidden="true" />
            <span className="flex flex-col gap-1">
              <span className="text-sm font-medium text-foreground">
                {copy.assetPublicTitle}
              </span>
              <span className="text-sm text-muted-foreground">{copy.assetPublicWarning}</span>
            </span>
          </span>
          <Field label={copy.assetPublicAcknowledge} hint={copy.assetPublicAcknowledgeHint}>
            <Checkbox
              checked={values.confirmedPublic}
              onCheckedChange={(checked) =>
                setValues((current) => ({ ...current, confirmedPublic: checked === true }))
              }
              disabled={isSubmitting}
            />
          </Field>
          <Button variant="ghost" size="sm" onClick={() => setIsConfirmingPublic(false)}>
            {copy.assetBack}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Field label={copy.assetType} required>
            <Select
              value={values.assetType}
              onValueChange={(value) =>
                setValues((current) => ({
                  ...current,
                  assetType: value as AssetUploadValues["assetType"],
                }))
              }
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSET_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {copy.assetTypes[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label={copy.assetDelivery} hint={copy.assetDeliveryHint} required>
            <Select
              value={values.deliveryClass}
              onValueChange={(value) =>
                setValues((current) => ({
                  ...current,
                  deliveryClass: value as AssetUploadValues["deliveryClass"],
                  confirmedPublic: false,
                }))
              }
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSET_DELIVERY_CLASSES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {copy.assetDeliveryClasses[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field
            label={copy.assetFile}
            hint={formatTemplate(copy.assetFileHint, {
              max: String(Math.round(ASSET_FILE_MAX_BYTES / (1024 * 1024))),
            })}
            required
          >
            <Input
              type="file"
              accept={ASSET_MIME_TYPES.join(",")}
              disabled={isSubmitting}
              onChange={(event) =>
                setValues((current) => ({ ...current, file: event.target.files?.[0] ?? null }))
              }
            />
          </Field>
        </div>
      )}
    </FormDrawer>
  );
}
