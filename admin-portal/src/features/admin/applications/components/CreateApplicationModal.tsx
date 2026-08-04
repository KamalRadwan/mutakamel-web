import { useState } from "react";
import { CreateApplicationDto, ApplicationCatalogueVisibility, ApplicationCommercialMode, ApplicationType } from "../types";

export function CreateApplicationModal({
  isOpen,
  onClose,
  onCreate,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (dto: CreateApplicationDto) => Promise<unknown>;
}) {
  const [formData, setFormData] = useState<CreateApplicationDto>({
    key: "",
    name: "",
    description: "",
    applicationType: "TENANT",
    commercialMode: "SUBSCRIPTION",
    catalogueVisibility: "PUBLIC"
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onCreate({ ...formData, description: formData.description?.trim() || undefined });
      onClose();
    } catch {
      // Error is handled in the hook toast
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md shadow-xl border border-slate-200 dark:border-slate-800">
        <h2 className="text-lg font-bold mb-4">Register Application</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1 text-slate-700 dark:text-slate-300">Key (Immutable)</label>
            <input
              required
              pattern="^[a-z][a-z0-9_]{0,31}$"
              className="w-full border rounded-lg p-2 text-sm dark:bg-slate-800 dark:border-slate-700 font-mono"
              value={formData.key}
              onChange={(e) => setFormData({ ...formData, key: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1 text-slate-700 dark:text-slate-300">Commercial Mode</label>
              <select className="w-full border rounded-lg p-2 text-sm dark:bg-slate-800 dark:border-slate-700" value={formData.commercialMode} onChange={(e) => setFormData({ ...formData, commercialMode: e.target.value as ApplicationCommercialMode })}><option value="NON_BILLABLE">Non-billable</option><option value="INCLUDED">Included</option><option value="SUBSCRIPTION">Subscription</option></select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-slate-700 dark:text-slate-300">Visibility</label>
              <select className="w-full border rounded-lg p-2 text-sm dark:bg-slate-800 dark:border-slate-700" value={formData.catalogueVisibility} onChange={(e) => setFormData({ ...formData, catalogueVisibility: e.target.value as ApplicationCatalogueVisibility })}><option value="PUBLIC">Public</option><option value="INTERNAL">Internal</option></select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1 text-slate-700 dark:text-slate-300">Name</label>
            <input
              required
              className="w-full border rounded-lg p-2 text-sm dark:bg-slate-800 dark:border-slate-700"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1 text-slate-700 dark:text-slate-300">Description</label>
            <input
              className="w-full border rounded-lg p-2 text-sm dark:bg-slate-800 dark:border-slate-700"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1 text-slate-700 dark:text-slate-300">Application Type</label>
            <select
              className="w-full border rounded-lg p-2 text-sm dark:bg-slate-800 dark:border-slate-700"
              value={formData.applicationType}
              onChange={(e) => setFormData({ ...formData, applicationType: e.target.value as ApplicationType })}
            >
              <option value="TENANT">Tenant</option>
              <option value="SYSTEM">System</option>
            </select>
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Create Draft"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
