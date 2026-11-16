"use client";

import { Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  Field,
  IdentifierText,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  ToggleGroup,
  ToggleGroupItem,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import {
  localizedRecordName,
  type PricingReferenceAccount,
  type PricingReferenceBranch,
  type PricingReferenceChannel,
  type PricingReferenceItem,
  type PricingReferenceUom,
  type PromotionBenefitType,
} from "../pricing-contract";
import { formatDraftValidationIssue } from "../pricing-messages";
import type { DraftValidationIssue, PromotionRuleDraft } from "../version-draft";

const ANY_VALUE = "__ANY__";

interface VersionPromotionEditorCardProps {
  purpose: string;
  currencyCode: string;
  promo: PromotionRuleDraft;
  rowIndex: number;
  rowKey: string;
  editable: boolean;
  items: PricingReferenceItem[];
  uoms: PricingReferenceUom[];
  branches: PricingReferenceBranch[];
  channels: PricingReferenceChannel[];
  channelBranchIdsByChannel: Record<string, string[]>;
  accounts: PricingReferenceAccount[];
  rowIssues: DraftValidationIssue[];
  onUpdate: (patch: Partial<PromotionRuleDraft>) => void;
  onRemove: () => void;
}

export function VersionPromotionEditorCard({
  purpose,
  currencyCode,
  promo,
  rowIndex,
  rowKey,
  editable,
  items,
  uoms,
  branches,
  channels,
  channelBranchIdsByChannel,
  accounts,
  rowIssues,
  onUpdate,
  onRemove,
}: VersionPromotionEditorCardProps) {
  const { t, lang } = useI18n();

  const issueFor = (field: string): string | undefined => {
    const found = rowIssues.find((i) => i.field === field);
    return found ? formatDraftValidationIssue(found, t.tradePricing) : undefined;
  };

  const eligibleItems = items.filter(
    (it) => it.itemId === promo.itemId || (purpose === "PURCHASE" ? it.canPurchase : it.canSell),
  );
  const expectedRole = purpose === "PURCHASE" ? "SUPPLIER" : "CUSTOMER";
  const eligibleAccounts = accounts.filter(
    (acc) => acc.partyId === promo.partyId || acc.accountRole === "BOTH" || acc.accountRole === expectedRole,
  );
  const hasChannelMappings = Object.keys(channelBranchIdsByChannel).length > 0;
  const eligibleChannels =
    promo.branchId && hasChannelMappings
      ? channels.filter(
          (ch) => ch.id === promo.channelId || (channelBranchIdsByChannel[ch.id] ?? []).includes(promo.branchId),
        )
      : channels;

  const handleBranchChange = (val: string) => {
    const nextBranch = val === ANY_VALUE ? "" : val;
    if (
      nextBranch &&
      promo.channelId &&
      hasChannelMappings &&
      !(channelBranchIdsByChannel[promo.channelId] ?? []).includes(nextBranch)
    ) {
      onUpdate({ branchId: nextBranch, channelId: "" });
      return;
    }
    onUpdate({ branchId: nextBranch });
  };

  const accountFieldLabel =
    purpose === "PURCHASE"
      ? t.tradePricing.promoSupplierSelectorLabel
      : t.tradePricing.promoCustomerSelectorLabel;

  return (
    <section
      aria-label={editable ? t.tradePricing.editPromotionTitle : t.tradePricing.inspectPromotionTitle}
      className="flex flex-col gap-3.5 rounded-card border border-border bg-card p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2.5">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-foreground">
            {editable ? t.tradePricing.editPromotionTitle : t.tradePricing.inspectPromotionTitle}
          </h3>
          <Badge tone="neutral">#{rowIndex + 1}</Badge>
          {promo.code ? <IdentifierText className="text-xs text-muted-foreground">{promo.code}</IdentifierText> : null}
        </div>
        {editable ? (
          <Button size="xs" variant="ghost" onClick={onRemove} className="text-destructive">
            <Trash2 className="me-1 size-3.5" aria-hidden="true" />
            {t.tradePricing.removePromotionAction}
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={t.tradePricing.promotionCode} required showLabel error={issueFor("code")}>
          <Input id={`promo-${rowKey}-code`} size="sm" dir="ltr" disabled={!editable} value={promo.code} onChange={(e) => onUpdate({ code: e.target.value })} />
        </Field>
        <Field label={t.tradePricing.promotionName} required showLabel error={issueFor("name")}>
          <Input id={`promo-${rowKey}-name`} size="sm" disabled={!editable} value={promo.name} onChange={(e) => onUpdate({ name: e.target.value })} />
        </Field>
        <Field label={t.tradePricing.benefitType} showLabel>
          <ToggleGroup
            type="single"
            size="sm"
            value={promo.benefitType}
            onValueChange={(next) => {
              if (editable && (next === "PERCENTAGE" || next === "FIXED_AMOUNT")) {
                onUpdate({ benefitType: next as PromotionBenefitType });
              }
            }}
            className="w-full justify-start"
          >
            <ToggleGroupItem value="PERCENTAGE" disabled={!editable} className="flex-1 text-xs">
              {tradeStatusLabel(t.tradeStatus, "PERCENTAGE", "%")}
            </ToggleGroupItem>
            <ToggleGroupItem value="FIXED_AMOUNT" disabled={!editable} className="flex-1 text-xs">
              {currencyCode}
            </ToggleGroupItem>
          </ToggleGroup>
        </Field>
        <Field
          label={promo.benefitType === "PERCENTAGE" ? `${t.tradePricing.discountValue} (%)` : `${t.tradePricing.discountValue} (${currencyCode})`}
          required
          showLabel
          error={issueFor("discountValue")}
        >
          <Input id={`promo-${rowKey}-discountValue`} size="sm" dir="ltr" inputMode="decimal" disabled={!editable} value={promo.discountValue} onChange={(e) => onUpdate({ discountValue: e.target.value })} />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Field label={t.tradePricing.evalItemLabel} showLabel>
          <Select disabled={!editable} value={promo.itemId || ANY_VALUE} onValueChange={(v) => onUpdate({ itemId: v === ANY_VALUE ? "" : v })}>
            <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY_VALUE}>{t.tradePricing.promoTargetAllItems}</SelectItem>
              {eligibleItems.map((it) => (
                <SelectItem key={it.itemId} value={it.itemId}>
                  {`${it.canonicalCode} · ${localizedRecordName(it.localizedNames, it.canonicalCode, lang)}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label={t.tradePricing.uomColumn} showLabel>
          <Select disabled={!editable} value={promo.uomId || ANY_VALUE} onValueChange={(v) => onUpdate({ uomId: v === ANY_VALUE ? "" : v })}>
            <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY_VALUE}>{t.tradePricing.promoAllEligibleScope}</SelectItem>
              {uoms.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {`${u.code} · ${localizedRecordName(u.localizedNames, u.displayName, lang)}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label={t.tradePricing.branchId} showLabel>
          <Select disabled={!editable} value={promo.branchId || ANY_VALUE} onValueChange={handleBranchChange}>
            <SelectTrigger textSize="compact" size="sm"><SelectValue /></SelectTrigger>
            <SelectContent textSize="compact">
              <SelectItem value={ANY_VALUE}>{t.trade.scopeAllBranches}</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          label={t.tradePricing.channelId}
          hint={promo.branchId ? t.tradePricing.promoChannelFilteredByBranchHint : undefined}
          showLabel
        >
          <Select disabled={!editable} value={promo.channelId || ANY_VALUE} onValueChange={(v) => onUpdate({ channelId: v === ANY_VALUE ? "" : v })}>
            <SelectTrigger textSize="compact" size="sm"><SelectValue /></SelectTrigger>
            <SelectContent textSize="compact">
              <SelectItem value={ANY_VALUE}>{t.trade.scopeAllChannels}</SelectItem>
              {eligibleChannels.map((ch) => (
                <SelectItem key={ch.id} value={ch.id}>{ch.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label={accountFieldLabel} showLabel>
          <Select disabled={!editable} value={promo.partyId || ANY_VALUE} onValueChange={(v) => onUpdate({ partyId: v === ANY_VALUE ? "" : v })}>
            <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY_VALUE}>{t.tradePricing.selectPartyPlaceholder}</SelectItem>
              {eligibleAccounts.map((acc) => (
                <SelectItem key={acc.partyId} value={acc.partyId}>{acc.displayName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-3 border-t border-border pt-3 sm:grid-cols-2 lg:grid-cols-5">
        <Field label={t.tradePricing.colFromIncluded} required showLabel error={issueFor("minimumQuantity")}>
          <Input id={`promo-${rowKey}-minimumQuantity`} size="sm" dir="ltr" inputMode="decimal" disabled={!editable} value={promo.minimumQuantity} onChange={(e) => onUpdate({ minimumQuantity: e.target.value })} />
        </Field>
        <Field label={t.tradePricing.colBelowExcluded} hint={t.tradePricing.optionalHint} showLabel error={issueFor("maximumQuantity")}>
          <Input id={`promo-${rowKey}-maximumQuantity`} size="sm" dir="ltr" inputMode="decimal" disabled={!editable} placeholder={t.tradePricing.noUpperLimitSymbol} value={promo.maximumQuantity} onChange={(e) => onUpdate({ maximumQuantity: e.target.value })} />
        </Field>
        <Field label={t.tradePricing.stackGroup} hint={t.tradePricing.guideStackGroup} required showLabel error={issueFor("stackGroup")}>
          <Input id={`promo-${rowKey}-stackGroup`} size="sm" dir="ltr" disabled={!editable} value={promo.stackGroup} onChange={(e) => onUpdate({ stackGroup: e.target.value })} />
        </Field>
        <Field label={t.tradePricing.priority} hint={t.tradePricing.priorityHint} required showLabel error={issueFor("priority")}>
          <Input id={`promo-${rowKey}-priority`} size="sm" dir="ltr" inputMode="numeric" disabled={!editable} value={promo.priority} onChange={(e) => onUpdate({ priority: e.target.value })} />
        </Field>
        <Field label={t.tradePricing.exclusive} hint={t.tradePricing.guideExclusive} showLabel>
          <div className="flex h-(--size-control-sm) items-center gap-2">
            <Switch disabled={!editable} checked={promo.exclusive} onCheckedChange={(checked) => onUpdate({ exclusive: checked })} />
            <span className="text-xs text-muted-foreground">
              {promo.exclusive ? t.tradePricing.exclusiveRuleBadge : t.tradePricing.competingStackBadge}
            </span>
          </div>
        </Field>
      </div>
    </section>
  );
}
