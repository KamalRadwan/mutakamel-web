"use client";

import { Pencil } from "lucide-react";
import {
  Button,
  IdentifierText,
  iconSize,
  type ColumnDef,
} from "@/design-system";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { Language } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { companyLabel, type CompanyOption } from "../../company-options";
import { formatNumberingValue, type NumberingSequence } from "../numbering-contract";

interface BuildNumberingColumnsOptions {
  readonly t: Dictionary;
  readonly lang: Language;
  readonly companies: readonly CompanyOption[];
  readonly canManage: boolean;
  readonly canManageScope: (companyId: string | null) => boolean;
  readonly isSubmitting: boolean;
  readonly onEdit: (sequence: NumberingSequence) => void;
}

export function buildNumberingColumns({
  t,
  lang,
  companies,
  canManage,
  canManageScope,
  isSubmitting,
  onEdit,
}: BuildNumberingColumnsOptions): ColumnDef<NumberingSequence>[] {
  return [
    {
      id: "code",
      sortable: true,
      header: t.coreSettings.numberingCode,
      cell: (sequence) => (
        <IdentifierText className="text-foreground">{sequence.code}</IdentifierText>
      ),
    },
    {
      id: "scope",
      header: t.coreIdentity.cascade.company,
      cell: (sequence) => (
        <span className="text-foreground">
          <bdi>
            {companyLabel(
              companies,
              sequence.companyId,
              t.coreSettings.numberingTenantWide,
              t.coreSettings.unknownCompany,
            )}
          </bdi>
        </span>
      ),
    },
    {
      id: "prefix",
      header: t.coreSettings.numberingPrefix,
      cell: (sequence) =>
        sequence.prefix ? (
          <IdentifierText className="text-foreground">{sequence.prefix}</IdentifierText>
        ) : (
          <span className="text-muted-foreground">{t.audit.valueEmpty}</span>
        ),
    },
    {
      id: "padding",
      header: t.coreSettings.numberingPadding,
      align: "end",
      numeric: true,
      cell: (sequence) => (
        <span className="tabular-nums text-foreground">{formatNumber(sequence.padding, lang)}</span>
      ),
    },
    {
      id: "next",
      sortable: true,
      sortField: "nextValue",
      header: t.coreSettings.numberingNextNumber,
      // The counter is a bigint string; `formatNumberingValue` pads text and
      // never converts it to a number.
      cell: (sequence) => (
        <IdentifierText className="text-foreground">
          {formatNumberingValue(sequence.prefix ?? "", sequence.padding, sequence.nextValue)}
        </IdentifierText>
      ),
    },
    ...(canManage
      ? [
          {
            id: "actions",
            header: t.common.actions,
            align: "end" as const,
            sticky: "end" as const,
            cell: (sequence: NumberingSequence) =>
              canManageScope(sequence.companyId) ? (
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={isSubmitting}
                  aria-label={`${t.coreSettings.numberingEditTitle}: ${sequence.code}`}
                  onClick={() => onEdit(sequence)}
                >
                  <Pencil className={iconSize({ size: "sm" })} aria-hidden="true" />
                  <span>{t.crmTags.edit}</span>
                </Button>
              ) : null,
          },
        ]
      : []),
  ];
}
