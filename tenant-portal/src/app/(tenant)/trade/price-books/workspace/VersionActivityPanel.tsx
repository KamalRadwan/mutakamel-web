"use client";

import Link from "next/link";
import { ArrowUpRight, Lock, Users } from "lucide-react";
import {
  Badge,
  Button,
  IdentifierText,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDateTime } from "@/lib/format/date";
import { formatNumber } from "@/lib/format/number";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import type { GovernanceAuditEvent, PriceBookDetail } from "../pricing-contract";
import { localizedAuditAction } from "../pricing-messages";

interface VersionActivityPanelProps {
  bookDetail?: PriceBookDetail | null;
  auditTrail: readonly GovernanceAuditEvent[];
}

export function VersionActivityPanel({ bookDetail, auditTrail }: VersionActivityPanelProps) {
  const { t, lang } = useI18n();

  return (
    <div className="flex flex-col gap-3">
      {bookDetail ? (
        <section className="flex flex-col gap-2.5 rounded-card border border-border bg-card p-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" aria-hidden="true" />
              <h3 className="font-semibold text-foreground">{t.tradePricing.linkedAccountsTitle}</h3>
              <Badge tone="neutral">{formatNumber(bookDetail.linkedAccounts.length, lang)}</Badge>
            </div>
            <Button size="xs" variant="outline" asChild>
              <Link href={TENANT_ROUTES.tradeCommercialAccounts}>
                {t.tradePricing.manageAccountsLink}
                <ArrowUpRight className="ms-1 size-3" aria-hidden="true" />
              </Link>
            </Button>
          </div>
          <p className="text-caption text-muted-foreground">{t.tradePricing.linkedAccountsCappedHint}</p>
          {bookDetail.linkedAccounts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.tradePricing.evalCommercialAccountLabel}</TableHead>
                  <TableHead>{t.trade.accountRole}</TableHead>
                  <TableHead>{t.common.status}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookDetail.linkedAccounts.map((acc) => (
                  <TableRow key={acc.id} className="font-normal">
                    <TableCell className="font-normal text-xs">{acc.displayName}</TableCell>
                    <TableCell className="font-normal">
                      <Badge tone="neutral">
                        {tradeStatusLabel(t.tradeStatus, acc.accountRole, t.common.unknownCode)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-normal">
                      <Badge tone={acc.status === "ACTIVE" ? "positive" : "neutral"}>
                        {tradeStatusLabel(t.tradeStatus, acc.status, t.common.unknownCode)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground">{t.tradePricing.linkedAccountsEmpty}</p>
          )}
          <div className="flex items-center gap-2 border-t border-border pt-2.5 text-caption text-muted-foreground">
            <Lock className="size-3.5 shrink-0" aria-hidden="true" />
            <span>
              {t.tradePricing.activeLocksCountMeta.replace(
                "{count}",
                formatNumber(bookDetail.activeLocksCount, lang),
              )}{" "}
              — {t.tradePricing.activeLocksInfoNote}
            </span>
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-2.5 rounded-card border border-border bg-card p-4 text-xs">
        <h3 className="font-semibold text-foreground">{t.tradePricing.governanceAuditTitle}</h3>
        {auditTrail.length === 0 ? (
          <p className="text-muted-foreground">{t.tradePricing.governanceAuditEmpty}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.common.status}</TableHead>
                <TableHead>{t.tradePricing.makerColumn}</TableHead>
                <TableHead>{t.tradePricing.retiredReasonLabel}</TableHead>
                <TableHead className="text-end">{t.tradePricing.evaluatedAtLabel}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditTrail.map((ev) => (
                <TableRow key={ev.id} className="font-normal">
                  <TableCell className="font-normal text-xs">
                    {localizedAuditAction(ev.action, t.tradePricing)}
                  </TableCell>
                  <TableCell className="font-normal text-xs">
                    {ev.actorDisplayName ?? ev.actorEmail ?? "—"}
                  </TableCell>
                  <TableCell className="font-normal text-xs text-muted-foreground">
                    {ev.reason ?? "—"}
                  </TableCell>
                  <TableCell className="text-end font-normal text-xs">
                    <IdentifierText className="text-caption">
                      {formatDateTime(ev.occurredAt, lang)}
                    </IdentifierText>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
