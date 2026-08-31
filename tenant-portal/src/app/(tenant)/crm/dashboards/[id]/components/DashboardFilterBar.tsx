"use client";

import {
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  COMPARE_MODES,
  DATE_PRESETS,
  type DashboardFilterSelection,
} from "../../dashboard-run-contract";

interface DashboardFilterBarProps {
  selection: DashboardFilterSelection;
  onChange: (selection: DashboardFilterSelection) => void;
  branchIds: readonly string[];
  currencyCodes: readonly string[];
  disabled: boolean;
}

const ANY = "__any__";

/**
 * The four run filters this screen can offer honestly.
 *
 * `DashboardFiltersDto` also carries `ownerUserId`, `pipelineId`, `dateFrom`,
 * `dateTo`, `staleDays`, `closingWindowDays` and `limit`. Owner and pipeline
 * are omitted because neither picker has a source reachable from this screen —
 * fabricating a UUID field for them would be a control nobody can use. The
 * currency list is not invented either: it is exactly what the last run
 * reported through its `CURRENCIES:` warnings (Q102).
 */
export function DashboardFilterBar({
  selection,
  onChange,
  branchIds,
  currencyCodes,
  disabled,
}: DashboardFilterBarProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-sm border border-border bg-card p-2.5">
      <div className="flex min-w-40 flex-col gap-1">
        <Label htmlFor="dashboard-date-preset">{t.crmDashboards.datePreset}</Label>
        <Select
          value={selection.datePreset ?? ANY}
          disabled={disabled}
          onValueChange={(next) =>
            onChange({
              ...selection,
              datePreset: next === ANY ? null : (next as DashboardFilterSelection["datePreset"]),
            })
          }
        >
          <SelectTrigger id="dashboard-date-preset">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>{t.crmDashboards.dashboardDefault}</SelectItem>
            {DATE_PRESETS.map((preset) => (
              <SelectItem key={preset} value={preset}>
                {t.crmDashboards.datePresets[preset]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex min-w-40 flex-col gap-1">
        <Label htmlFor="dashboard-compare">{t.crmDashboards.compare}</Label>
        <Select
          value={selection.compare ?? ANY}
          disabled={disabled}
          onValueChange={(next) =>
            onChange({
              ...selection,
              compare: next === ANY ? null : (next as DashboardFilterSelection["compare"]),
            })
          }
        >
          <SelectTrigger id="dashboard-compare">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>{t.crmDashboards.dashboardDefault}</SelectItem>
            {COMPARE_MODES.map((mode) => (
              <SelectItem key={mode} value={mode}>
                {t.crmDashboards.compareModes[mode]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {branchIds.length > 0 ? (
        <div className="flex min-w-52 flex-col gap-1">
          <Label htmlFor="dashboard-branch">{t.crmDashboards.branch}</Label>
          <Select
            value={selection.branchId ?? ANY}
            disabled={disabled}
            onValueChange={(next) =>
              onChange({ ...selection, branchId: next === ANY ? null : next })
            }
          >
            {/* Branch ids, not names: `/auth/me` returns `accessibleBranches`
                as bare identifiers and no branch-name source is reachable
                from CRM. Same treatment as `TenantBranchSelect`, which every
                other CRM workspace uses. */}
            <SelectTrigger id="dashboard-branch" className="font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>{t.crmDashboards.allBranches}</SelectItem>
              {branchIds.map((branchId) => (
                <SelectItem key={branchId} value={branchId}>
                  {branchId}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {currencyCodes.length > 0 ? (
        <div className="flex min-w-36 flex-col gap-1">
          <Label htmlFor="dashboard-currency">{t.crmDashboards.currency}</Label>
          <Select
            value={selection.currencyCode ?? ANY}
            disabled={disabled}
            onValueChange={(next) =>
              onChange({ ...selection, currencyCode: next === ANY ? null : next })
            }
          >
            <SelectTrigger id="dashboard-currency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>{t.crmDashboards.allCurrencies}</SelectItem>
              {currencyCodes.map((code) => (
                <SelectItem key={code} value={code}>
                  {code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </div>
  );
}
