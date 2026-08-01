"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useI18n } from "@/i18n/I18nContext";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const dashboardFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  description: z.string().max(500, "Description must be less than 500 characters").optional(),
});

type DashboardFormValues = z.infer<typeof dashboardFormSchema>;

interface DashboardFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: Partial<DashboardFormValues>;
  onSubmit: (values: DashboardFormValues) => Promise<void>;
}

export function DashboardFormDialog({ open, onOpenChange, defaultValues, onSubmit }: DashboardFormDialogProps) {
  const { lang } = useI18n();
  const isRtl = lang === "ar";

  const form = useForm<DashboardFormValues>({
    resolver: zodResolver(dashboardFormSchema),
    defaultValues: {
      name: defaultValues?.name || "",
      description: defaultValues?.description || "",
    },
  });

  const handleSubmit = async (values: DashboardFormValues) => {
    await onSubmit(values);
    onOpenChange(false);
  };

  const title = defaultValues?.name ? (isRtl ? "تعديل اللوحة" : "Edit Dashboard") : (isRtl ? "لوحة جديدة" : "New Dashboard");

  return (
    <Modal isOpen={open} onClose={() => onOpenChange(false)} title={title}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4" dir={isRtl ? "rtl" : "ltr"}>
        <div className="space-y-2">
          <label className="text-sm font-medium">{isRtl ? "الاسم" : "Name"}</label>
          <Input {...form.register("name")} placeholder={isRtl ? "مثال: مبيعات الربع الأول" : "e.g. Q1 Sales"} />
          {form.formState.errors.name && (
            <p className="text-xs text-red-500">{form.formState.errors.name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">{isRtl ? "الوصف" : "Description"}</label>
          <textarea 
            {...form.register("description")} 
            placeholder={isRtl ? "وصف اختياري" : "Optional description"} 
            className="flex min-h-[80px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:placeholder:text-slate-400 dark:focus-visible:ring-blue-800 resize-none h-24" 
          />
          {form.formState.errors.description && (
            <p className="text-xs text-red-500">{form.formState.errors.description.message}</p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            {isRtl ? "إلغاء" : "Cancel"}
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {isRtl ? "حفظ" : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
