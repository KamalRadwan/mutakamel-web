"use client";
import { useState } from "react";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, RadioGroup, RadioGroupItem } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { AddonCopy } from "../lib/addon-copy";
import type { ApplicationView } from "../types";

interface Props {
  owners: readonly ApplicationView[];
  truncated: boolean;
  copy: AddonCopy;
  onSelect: (application: ApplicationView) => void;
  onClose: () => void;
}

/**
 * Choosing the owner is a required first step, not a convenience. An addon key
 * must start with its application key (`ADDON_OWNER_MISMATCH`), and
 * `useAddonDefinitionDialog` seeds the key field with `<applicationKey>.` at
 * mount — so the definition dialog cannot be opened before an owner exists, and
 * the owner cannot change underneath it afterwards.
 *
 * Only eligible owners are offered. Listing an application Core would reject
 * would hand the operator a guaranteed failure dressed as a choice.
 */
export function AddonOwnerPicker({ owners, truncated, copy, onSelect, onClose }: Props) {
  const { dir } = useI18n();
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const application = owners.find(owner => owner.key === selected);
    if (!application) { setError(copy.ownerRequired); return; }
    onSelect(application);
  };

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent dir={dir} className="max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto p-3 sm:p-3.5">
        <DialogHeader>
          <DialogTitle>{copy.create}</DialogTitle>
          <DialogDescription className="text-sm">{copy.ownerStepHint}</DialogDescription>
        </DialogHeader>

        {error && (
          <div role="alert" className="rounded-md border border-destructive bg-destructive-subtle p-3 text-sm text-destructive-subtle-foreground">
            {error}
          </div>
        )}

        {owners.length === 0 ? (
          <p role="status" className="text-sm text-muted-foreground">{copy.noEligibleOwners}</p>
        ) : (
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">{copy.ownerStep}</legend>
            <RadioGroup
              value={selected}
              onValueChange={value => { setSelected(value); setError(null); }}
              aria-label={copy.ownerStep}
            >
              {owners.map(owner => (
                <div key={owner.key} className="flex min-h-8.5 items-center gap-2.5 rounded-md border border-border p-2.5">
                  <RadioGroupItem id={`addon-owner-${owner.key}`} value={owner.key} />
                  <label htmlFor={`addon-owner-${owner.key}`} className="min-w-0 grow cursor-pointer">
                    <span className="block text-xs font-semibold">{owner.name}</span>
                    <bdi className="block break-all font-mono text-[11px] text-muted-foreground" dir="ltr">{owner.key}.</bdi>
                  </label>
                </div>
              ))}
            </RadioGroup>
            <p className="text-xs text-muted-foreground">{copy.systemBoundary}</p>
            {truncated && (
              <p role="status" className="rounded-md border border-warning bg-warning-subtle p-3 text-xs text-warning-subtle-foreground">
                {copy.pickerTruncated}
              </p>
            )}
          </fieldset>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>{copy.cancel}</Button>
          <Button type="button" variant="primary" size="sm" disabled={owners.length === 0} onClick={submit}>{copy.continueLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
