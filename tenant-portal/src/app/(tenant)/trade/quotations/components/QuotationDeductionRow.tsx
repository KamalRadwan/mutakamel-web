import { Money, TableCell, TableRow, cn } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { compareFixedDecimal } from "../../documents/fixed-decimal";

const discountTone = "bg-destructive/10 text-destructive";

export function QuotationDeductionRow({ amount, currencyCode, promotion = false, labelColumns, hasActions }: {
  amount?: string | null;
  currencyCode?: string;
  promotion?: boolean;
  labelColumns?: number;
  hasActions?: boolean;
}) {
  const { t } = useI18n();
  const label = promotion ? t.quotationDiscount.promotionDiscount : t.quotationDiscount.discount;
  const value = amount == null ? "—" : <Money
    value={compareFixedDecimal(amount, "0") > 0 ? `-${amount}` : amount} currency={currencyCode}
    minimumFractionDigits={currencyCode ? undefined : 2} maximumFractionDigits={8} />;

  if (labelColumns !== undefined) {
    return <TableRow className={cn(discountTone, "h-7 hover:bg-destructive/10")}>
      <th scope="row" colSpan={labelColumns} className="px-2.5 py-1 text-start text-xs font-semibold">{label}</th>
      <TableCell className="px-2.5 py-1 text-end text-xs font-semibold text-destructive">{value}</TableCell>
      {hasActions ? <TableCell className="p-0" /> : null}
    </TableRow>;
  }
  return <div className={cn(discountTone, "flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-xs font-semibold lg:hidden")}>
    <span>{label}</span>{value}
  </div>;
}
