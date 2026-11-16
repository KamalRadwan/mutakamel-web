"use client";

import { Settings2, UserRound } from "lucide-react";
import { Button, Checkbox, Combobox, Field, FormModal, Input, PermissionGate } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TradeWriteOutcome } from "../../documents/components/TradeBoundaryStates";
import type { QuotationDiscountLimitsState } from "../hooks/useQuotationDiscountLimits";

export function QuotationDiscountLimitsDialog({ state }: { state: QuotationDiscountLimitsState }) {
  const { t } = useI18n();
  const copy = t.quotationDiscount;
  const users = state.users;
  return <FormModal open={state.open} onOpenChange={state.setOpen} size="card" title={copy.limitsTitle}
    description={copy.limitsDescription} isDirty={state.dirty} isSubmitting={state.write.isWriting}
    submitDisabled={!state.canSubmit} onSubmit={() => void state.submit()}
    headerIcon={<Settings2 className="size-5 text-primary" aria-hidden="true" />}
    labels={{ submit: copy.saveLimit, cancel: t.common.cancel, close: t.common.close,
      discardTitle: t.common.discardTitle, discardDescription: t.common.discardDescription,
      discardConfirm: t.common.discardConfirm, discardCancel: t.common.cancel,
      sections: copy.limitsTitle, sectionInvalid: copy.limitsInvalid }}>
    <div className="space-y-4 p-4 sm:p-5">
      <TradeWriteOutcome write={state.write} />
      {state.write.writeError?.status === 403 || state.error?.status === 403
        ? <PermissionGate require="trade.quotations.discount.manage" denied>{null}</PermissionGate> : <>
        {state.write.writeError ? <div role="alert" className="space-y-2 rounded-md border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive"><p>{state.conflicted ? copy.limitsChanged : copy.limitsInvalid}</p>{state.conflicted ? <Button variant="outline" size="sm" onClick={state.retry}>{t.common.retry}</Button> : null}</div> : null}
        <Field label={copy.user} showLabel required>
          <Combobox size="md" value={state.selected?.id} selectedLabel={state.selected ? `${state.selected.firstName} ${state.selected.lastName}`.trim() : undefined}
            selectedDescription={state.selected?.email} onValueChange={state.selectUser} onSearch={users.setSearch}
            options={users.items.map((user) => ({ value: user.id, label: `${user.firstName} ${user.lastName}`.trim() || user.email, description: user.email }))}
            loading={users.loading} disabled={state.write.isBlocked} placeholder={copy.chooseUser}
            searchPlaceholder={copy.searchUsers} loadingLabel={t.common.loading} emptyLabel={copy.noUsers}
            leadingSlot={<UserRound className="size-4 text-muted-foreground" aria-hidden="true" />} wrapLabels
            errorContent={users.error ? users.error.status === 403
              ? <PermissionGate require="users.user.read" denied>{null}</PermissionGate>
              : <p role="alert" className="p-3 text-sm text-destructive">{copy.userUnavailable}</p> : undefined}
            footer={users.error?.status !== 403 && (users.hasMore || users.error) ? <Button variant="ghost" size="sm"
              onClick={users.error ? users.retry : users.loadMore} loading={users.loading}>{users.error ? t.common.retry : t.quotationExperience.contactMore}</Button> : undefined} />
        </Field>
        {state.loading ? <p role="status" className="text-sm text-muted-foreground">{t.common.loading}</p>
          : state.error ? <div role="alert" className="space-y-2 text-sm"><p>{copy.policyUnavailable}</p><Button variant="outline" size="sm" onClick={state.retry}>{t.common.retry}</Button></div>
            : state.selected ? <fieldset disabled={state.write.isBlocked} className="space-y-4 rounded-lg border border-border bg-muted/10 p-4">
              {!state.limit ? <p role="status" className="text-sm text-muted-foreground">{copy.limitsEmpty}</p> : null}
              <Field label={copy.maxPercent} required showLabel error={state.valueError}>
                <Input size="md" inputMode="decimal" value={state.draft.maxPercent} maxLength={40}
                  onChange={(event) => state.update({ maxPercent: event.target.value })} />
              </Field>
              <Field label={copy.limitActive} showLabel><Checkbox checked={state.draft.active} onCheckedChange={(value) => state.update({ active: value === true })} /></Field>
              <Field label={copy.allowFreeItems} showLabel><Checkbox checked={state.draft.allowFreeItems} onCheckedChange={(value) => state.update({ allowFreeItems: value === true })} /></Field>
            </fieldset> : null}
      </>}
    </div>
  </FormModal>;
}
