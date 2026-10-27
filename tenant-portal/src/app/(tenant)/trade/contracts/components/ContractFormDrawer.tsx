"use client";

import { FileText, Plus, Trash2 } from "lucide-react";
import { Button, Field, FormDrawer, IdentifierText, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/design-system";
import { TradeWriteFields, TradeWriteOutcome } from "../../documents/components/TradeBoundaryStates";
import { TradeFinancialLinesEditor } from "../../documents/components/TradeFinancialLinesEditor";
import { FINANCIAL_TOTAL_KEYS } from "../../documents/financial-totals";
import type { ContractDetail } from "../contract-contract";
import { useContractFormDrawer } from "../hooks/useContractFormDrawer";
import { tradeDecimalError } from "../../documents/lib/trade-evidence-validation";

export interface ContractFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  headers: Record<string, string>;
  contract?: ContractDetail | null;
  onSaved: () => Promise<unknown>;
}

export function ContractFormDrawer(props: ContractFormDrawerProps) {
  const form = useContractFormDrawer(props);
  const { t, td, write, isEdit } = form;
  return (
    <FormDrawer open={props.open} onOpenChange={(next) => { if (!write.isBlocked) props.onOpenChange(next); }}
      title={isEdit ? td.executive.editContractTitle : td.executive.createContractTitle}
      description={td.executive.contractDrawerDescription}
      isDirty={form.partyId !== "" || form.reference !== ""}
      isSubmitting={write.isWriting} submitDisabled={!form.canSubmit}
      onSubmit={() => void form.handleSubmit()}
      labels={{ submit: td.executive.saveContractDraft, cancel: t.common.cancel,
        discardTitle: t.common.discardTitle, discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm, discardCancel: t.common.cancel }}>
      <TradeWriteOutcome write={write} />
      <TradeWriteFields write={write}>
      <div className="dossier-card dossier-card-indigo space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={td.party} required>
            <Input size="sm" value={form.partyId} readOnly={isEdit}
              onChange={(e) => form.setPartyId(e.target.value)} placeholder="UUIDv7" />
          </Field>
          <Field label={td.currency} required hint={td.currencyHint}>
            <Input size="sm" value={form.currencyCode} readOnly={isEdit}
              onChange={(e) => form.setCurrencyCode(e.target.value.toUpperCase())} placeholder="SAR" />
          </Field>
          <Field label={td.contracts.effectiveFrom}>
            <Input size="sm" type="date" value={form.effectiveFrom}
              onChange={(e) => form.setEffectiveFrom(e.target.value)} placeholder={td.contracts.effectiveFrom} />
          </Field>
          <Field label={td.contracts.effectiveTo}>
            <Input size="sm" type="date" value={form.effectiveTo}
              onChange={(e) => form.setEffectiveTo(e.target.value)} placeholder={td.contracts.effectiveTo} />
          </Field>
          <Field label={td.reference}>
            <Input size="sm" value={form.reference}
              onChange={(e) => form.setReference(e.target.value)} placeholder={td.reference} />
          </Field>
          <Field label={td.executive.financialModeLabel}>
            <Select value={form.mode} onValueChange={form.setMode} disabled={write.isBlocked}>
              <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NON_FINANCIAL">{td.executive.modeNonFinancial}</SelectItem>
                <SelectItem value="FINANCIAL">{td.executive.modeFinancial}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {isEdit ? <>
            <Field label={td.executive.governingLawCountryLabel}>
              <Input size="sm" value={typeof form.termsSnapshot.governingLawCountry === "string" ? form.termsSnapshot.governingLawCountry : ""}
                onChange={(e) => form.updateTerm("governingLawCountry", e.target.value)} />
            </Field>
            <Field label={td.executive.terminationNoticeDaysLabel}>
              <Input size="sm" inputMode="numeric"
                value={typeof form.termsSnapshot.terminationNoticeDays === "number" || typeof form.termsSnapshot.terminationNoticeDays === "string" ? String(form.termsSnapshot.terminationNoticeDays) : ""}
                onChange={(e) => form.updateTerm("terminationNoticeDays", e.target.value)} />
            </Field>
          </> : null}
          <div className="sm:col-span-2">
            <Field label={td.notes}>
              <Input size="sm" value={form.notes}
                onChange={(e) => form.setNotes(e.target.value)} placeholder={td.notes} />
            </Field>
          </div>
        </div>
      </div>

      {form.mode === "NON_FINANCIAL" ? (
        <div className="dossier-card dossier-card-emerald">
          <p className="text-xs text-muted-foreground">{td.executive.nonFinancialZeroHint}</p>
        </div>
      ) : isEdit ? (
        <div className="dossier-card grid grid-cols-1 gap-3 sm:grid-cols-2">
          {FINANCIAL_TOTAL_KEYS.map((key) => (
            <Field key={key} label={td.totals[key]} error={tradeDecimalError(form.editTotals[key]) ? td.lineEditor.decimalInvalid : undefined}>
              <Input size="sm" inputMode="decimal" value={form.editTotals[key]}
                readOnly={key === "amountPaid" || key === "amountDue" || key === "grandTotal"}
                disabled={write.isBlocked} onChange={(e) => form.updateTotal(key, e.target.value)} />
            </Field>
          ))}
          {!form.editTotalsValid ? <p role="alert" className="text-sm text-destructive">{td.lineEditor.calculationInvalid}</p> : null}
        </div>
      ) : (
        <TradeFinancialLinesEditor dialect="FINANCIAL" currencyCode={form.currencyCode}
          lines={form.lines} onChangeLines={form.setLines} disabled={write.isBlocked} />
      )}

      <div className="dossier-card dossier-card-violet space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="dossier-icon-pill dossier-ip-violet" aria-hidden><FileText className="h-4 w-4" /></span>
            <span className="text-sm font-semibold text-foreground">{td.contracts.clauses}</span>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={form.addClause}>
            <Plus className="me-1.5 h-3.5 w-3.5" aria-hidden />{td.executive.addClause}
          </Button>
        </div>
        <div className="space-y-3">
          {form.clauses.map((clause, index) => (
            <div key={clause.clientClauseId} className="trade-clause-card space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="trade-clause-order-badge"><IdentifierText>{String(index + 1)}</IdentifierText></span>
                  <span className="text-xs font-semibold text-foreground">
                    {td.executive.clauseOrderLabel}{" "}<IdentifierText>{String(index + 1)}</IdentifierText>
                  </span>
                </div>
                {form.clauses.length > 1 ? (
                  <Button type="button" size="sm" variant="ghost" onClick={() => form.removeClause(index)} aria-label={td.executive.removeClause}>
                    <Trash2 className="h-4 w-4 text-destructive" aria-hidden />
                  </Button>
                ) : null}
              </div>
              <Field label={td.executive.clauseTitleLabel} required>
                <Input size="sm" value={clause.title} onChange={(e) => form.updateClause(index, { title: e.target.value })} placeholder={td.executive.clauseTitleLabel} />
              </Field>
              <Field label={td.executive.clauseBodyLabel} required>
                <Input size="sm" value={clause.body} onChange={(e) => form.updateClause(index, { body: e.target.value })} placeholder={td.executive.clauseBodyLabel} />
              </Field>
            </div>
          ))}
        </div>
      </div>
      </TradeWriteFields>
    </FormDrawer>
  );
}
