import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
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
      setError(submissionError instanceof Error ? submissionError.message : "The change could not be saved.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="catalogue-resource-title" className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <header className="flex items-start justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <h2 id="catalogue-resource-title" className="text-sm font-black text-slate-950 dark:text-white">
              {resource ? "Edit" : "Create"} {isFeature ? "feature" : "tier"}
            </h2>
            <p className="mt-1 text-xs text-slate-500">Keys are protocol identity and cannot be changed later.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </header>
        <form onSubmit={submit} className="space-y-4 p-5">
          {!resource && (
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Key
              <input value={key} onChange={(event) => setKey(event.target.value)} maxLength={isFeature ? 96 : 64} required className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-950" />
            </label>
          )}
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            Name
            <input value={name} onChange={(event) => setName(event.target.value)} maxLength={128} required className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-950" />
          </label>
          {isFeature && (
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Description
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={512} rows={3} className="mt-1.5 w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-950" />
            </label>
          )}
          <div className="grid grid-cols-2 gap-4">
            {resource || isFeature ? (
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Rank
                <input type="number" min={0} value={rank} onChange={(event) => setRank(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-950" />
              </label>
            ) : <span />}
            {!isFeature && (
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Colour
                <input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-950" />
              </label>
            )}
          </div>
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold dark:border-slate-800">
            <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} className="h-4 w-4 accent-violet-600" />
            Active in the commercial catalogue
          </label>
          {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
          <footer className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-500 disabled:opacity-50">
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {resource ? "Save changes" : `Create ${kind}`}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
