import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, Field, Input, Textarea, Checkbox, Button } from "@/design-system";
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
  const isFeature = kind === "feature";
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rank, setRank] = useState("0");
  const [color, setColor] = useState("#3b82f6");
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    queueMicrotask(() => {
      setKey(resource?.key ?? (isFeature ? `${applicationKey}.` : ""));
      setName(resource?.name ?? "");
      setDescription(resource && "description" in resource ? resource.description ?? "" : "");
      setRank(String(resource?.rank ?? 0));
      setColor(resource && "color" in resource ? resource.color : "#3b82f6");
      setIsActive(resource?.isActive ?? true);
      setError(null);
    });
  }, [applicationKey, isFeature, isOpen, resource]);

  if (!isOpen) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedKey = key.trim();
    if (!trimmedName) return setError("Name is required.");
    if (!resource && !trimmedKey) return setError("Key is required.");
    if (isFeature && !resource && !trimmedKey.startsWith(`${applicationKey}.`)) {
      return setError(`Feature keys must start with ${applicationKey}.`);
    }
    try {
      if (isFeature) {
        const dto = resource
          ? { name: trimmedName, description: description.trim(), rank: Number(rank), isActive }
          : { key: trimmedKey, name: trimmedName, description: description.trim() || undefined, rank: Number(rank), isActive };
        await onSubmit(dto);
      } else {
        const dto = resource
          ? { name: trimmedName, rank: Number(rank), color, isActive }
          : { key: trimmedKey, name: trimmedName, color, isActive };
        await onSubmit(dto);
      }
      onClose();
    } catch (submissionError) {
      setError(readSubmissionMessage(submissionError, "The change could not be saved."));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm">
            {resource ? "Edit" : "Create"} {isFeature ? "feature" : "tier"}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">Keys are protocol identity and cannot be changed later.</p>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {!resource && (
            <Field label="Key">
              {(fp) => <Input {...fp} value={key} onChange={(event) => setKey(event.target.value)} maxLength={isFeature ? 96 : 64} required />}
            </Field>
          )}
          <Field label="Name">
            {(fp) => <Input {...fp} value={name} onChange={(event) => setName(event.target.value)} maxLength={128} required />}
          </Field>
          {isFeature && (
            <Field label="Description">
              {(fp) => <Textarea {...fp} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={512} rows={3} />}
            </Field>
          )}
          <div className="grid grid-cols-2 gap-4">
            {resource || isFeature ? (
              <Field label="Rank">
                {(fp) => <Input {...fp} type="number" min={0} value={rank} onChange={(event) => setRank(event.target.value)} className="font-mono" />}
              </Field>
            ) : <span />}
            {!isFeature && (
              <Field label="Colour">
                {(fp) => <input {...fp} type="color" value={color} onChange={(event) => setColor(event.target.value)} className="h-10 w-full rounded-md border border-border bg-card p-1" />}
              </Field>
            )}
          </div>
          <label className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-xs font-semibold text-foreground">
            <Checkbox checked={isActive} onCheckedChange={(checked) => setIsActive(checked === true)} />
            Active in the commercial catalogue
          </label>
          {error && (
            <p role="alert" className="rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-xs text-danger-700 dark:border-danger-800/60 dark:bg-danger-950/40 dark:text-danger-300">
              {error}
            </p>
          )}
          <footer className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
              {resource ? "Save changes" : `Create ${kind}`}
            </Button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function readSubmissionMessage(value: unknown, fallback: string) {
  if (value instanceof Error) return value.message;
  if (value && typeof value === "object" && "message" in value && typeof value.message === "string") {
    return value.message;
  }
  return fallback;
}
