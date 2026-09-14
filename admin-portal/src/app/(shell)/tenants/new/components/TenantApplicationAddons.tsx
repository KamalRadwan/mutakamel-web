import { User } from "lucide-react";
import { Checkbox, Field, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useTenantApplicationAddons } from "../hooks/useTenantApplicationAddons";
import type { TenantApplicationCandidate, TenantApplicationSelection } from "../types";

export function TenantApplicationAddons({ candidate, selection, onChange }: {
  candidate: TenantApplicationCandidate; selection: TenantApplicationSelection; onChange: (patch: Partial<TenantApplicationSelection>) => void;
}) {
  const { lang } = useI18n(); const state = useTenantApplicationAddons(candidate, selection, onChange);
  const copy = lang === "ar" ? { title: "إضافات اختيارية", empty: "لا توجد إضافات منشورة متاحة لهذا التطبيق.",
    hint: "مقاعد الإضافة لا تتجاوز مقاعد التطبيق. تُعرض الأسعار في تسعيرة الخادم قبل الإنشاء.", seats: "مقاعد الإضافة", blocked: "غير متاحة لهذه الباقة", invalid: "أدخل عددًا صحيحًا من 1 إلى عدد مقاعد التطبيق.",
    tier: "أزل الإضافات المحددة أولًا لتغيير الباقة." } : { title: "Optional addons", empty: "No published addons are available for this application.",
    hint: "Addon seats cannot exceed application seats. Server prices are shown in the quote before creation.", seats: "Addon seats", blocked: "Unavailable for this tier", invalid: "Enter a whole number from 1 through the application seat count.",
    tier: "Remove selected addons before changing the tier." };
  return <section className="mt-3 space-y-2 border-t border-border pt-2.5" aria-label={copy.title}>
    <h4 className="text-xs font-semibold">{copy.title}</h4><p className="text-xs text-muted-foreground">{copy.hint}</p>
    {selection.addons.length > 0 && <p className="text-xs text-muted-foreground">{copy.tier}</p>}
    {!candidate.addons.length && <p className="text-xs text-muted-foreground">{copy.empty}</p>}
    {candidate.addons.map(option => {
      const selected = selection.addons.find(item => item.addonId === option.addonId);
      const available = option.catalogueReasons.length === 0 && option.compatibleTierIds.includes(selection.tierId);
      const invalid = selected && (!Number.isInteger(selected.seats) || selected.seats < 1 || selected.seats > selection.seats);
      const id = `tenant-addon-${option.addonId}`;
      return <div key={option.addonId} className="space-y-2 rounded-md border border-border p-2.5">
        <label htmlFor={id} className="flex min-h-8 cursor-pointer items-center gap-2.5 text-xs"><Checkbox id={id} checked={Boolean(selected)} disabled={!selected && !available} onCheckedChange={value => state.toggle(option.addonId, value === true)} />
          <span className="min-w-0 font-medium"><bdi>{option.name}</bdi><span className="ms-2 font-mono text-xs text-muted-foreground"><bdi>{option.key}</bdi></span></span></label>
        {!available && <p className="text-xs text-warning-subtle-foreground">{copy.blocked}</p>}
        {selected && (
          <Field id={`${id}-seats`} label={copy.seats} hideLabel required error={invalid ? copy.invalid : undefined} className="max-w-44">
            {field => (
              <Input
                {...field}
                size="sm"
                type="number"
                min={1}
                max={selection.seats}
                step={1}
                value={selected.seats}
                leading={<User className="size-3.5 text-muted-foreground" aria-hidden="true" />}
                placeholder={`${copy.seats} *`}
                onChange={event => state.seats(option.addonId, event.target.value)}
              />
            )}
          </Field>
        )}
      </div>;
    })}
  </section>;
}
