import { Field, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { CrmRatingStars } from "../../../shared/components/board/CrmRatingStars";
import type { useOpportunityBoardQuickAdd } from "./hooks/useOpportunityBoardQuickAdd";

export function OpportunityBoardQuickAddFields({ form }: { form: ReturnType<typeof useOpportunityBoardQuickAdd> }) {
  const { t, lang } = useI18n();
  return (
    <>
      <div className="grid grid-cols-2 gap-1.5">
        <Field label={t.crmOpportunityDetail.amount}>
          <Input inputMode="decimal" dir="ltr" value={form.amount} onChange={(event) => form.setAmount(event.target.value)}
            placeholder="0.00" disabled={form.isSaving} />
        </Field>
        <Field label={t.crmLeadConvert.currencyCode}>
          <Select value={form.currencyCode || "__workspace_default__"}
            onValueChange={(code) => form.setCurrencyCode(code === "__workspace_default__" ? "" : code)} disabled={form.isSaving}>
            <SelectTrigger size="sm" aria-label={t.crmLeadConvert.currencyCode}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__workspace_default__">{t.crmOpportunities.workspaceDefaultCurrency}</SelectItem>
              {form.currencyOptions.map((code) => <SelectItem key={code} value={code}>{code}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t.crmOpportunities.probabilityShort}>
          <Input inputMode="numeric" dir="ltr" value={form.probabilityPercent}
            onChange={(event) => form.setProbabilityPercent(event.target.value)} placeholder="50" disabled={form.isSaving} />
        </Field>
        <Field label={t.crmOpportunities.expectedClose}>
          <Input type="date" dir="ltr" value={form.expectedCloseDate}
            onChange={(event) => form.setExpectedCloseDate(event.target.value)} disabled={form.isSaving} />
        </Field>
      </div>
      <Field label={t.crmOpportunities.importance}>
        <CrmRatingStars value={form.importance} onChange={form.setImportance} disabled={form.isSaving}
          ariaLabel={t.crmOpportunities.importance} starLabel={(level) => form.importance === level ? t.crmOpportunities.clearImportance
            : formatTemplate(t.crmOpportunities.setImportance, { level: formatNumber(level, lang) })} />
      </Field>
    </>
  );
}
