"use client";

import { Search } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Checkbox,
  EmptyState,
  Input,
  Progress,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/design-system";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { Language } from "@/i18n/useLanguage";
import { localizedValue } from "@/lib/format/localized";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import type { PermissionGroup } from "../hooks/usePermissionCatalogue";

interface PermissionCatalogueMatrixProps {
  t: Dictionary;
  lang: Language;
  groups: PermissionGroup[];
  filteredGroups: PermissionGroup[];
  permissionSearch: string;
  onPermissionSearchChange: (value: string) => void;
  onClearPermissionSearch: () => void;
  isCatalogueLoaded: boolean;
  selectedCount: number;
  selectedSet: ReadonlySet<string>;
  maxPermissions: number;
  isOverCap: boolean;
  canEditPermissions: boolean;
  canGrantPermission: (permissionId: string) => boolean;
  isSubmitting: boolean;
  onToggle: (permissionId: string) => void;
}

export function PermissionCatalogueMatrix({
  t,
  lang,
  groups,
  filteredGroups,
  permissionSearch,
  onPermissionSearchChange,
  onClearPermissionSearch,
  isCatalogueLoaded,
  selectedCount,
  selectedSet,
  maxPermissions,
  isOverCap,
  canEditPermissions,
  canGrantPermission,
  isSubmitting,
  onToggle,
}: PermissionCatalogueMatrixProps) {
  const copy = t.coreIdentity.roles;
  const selectedCountText = formatTemplate(copy.selectedCount, {
    count: formatNumber(selectedCount, lang),
    max: formatNumber(maxPermissions, lang),
  });

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-3 py-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-48 flex-1 flex-col gap-1.5">
              <p className="text-xs font-medium text-foreground tabular-nums">
                {selectedCountText}
              </p>
              <Progress
                value={Math.min(selectedCount, maxPermissions)}
                max={maxPermissions}
                label={selectedCountText}
                valueText={selectedCountText}
              />
            </div>
            <div className="relative w-full sm:w-72">
              <Search
                className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                size="sm"
                type="search"
                aria-label={t.common.search}
                placeholder={t.common.search}
                value={permissionSearch}
                onChange={(event) => onPermissionSearchChange(event.target.value)}
                disabled={!isCatalogueLoaded || groups.length === 0}
                className="ps-8"
              />
            </div>
          </div>

          {isOverCap ? (
            <p
              role="alert"
              className="rounded-sm border border-caution-200 bg-caution-100 p-2.5 text-xs text-caution-800 dark:border-caution-800 dark:bg-caution-950 dark:text-caution-300"
            >
              {formatTemplate(copy.overCap, {
                max: formatNumber(maxPermissions, lang),
              })}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {!isCatalogueLoaded ? (
        <div className="flex flex-col gap-3" role="status" aria-busy="true">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="py-2">
            <EmptyState title={t.common.noData} />
          </CardContent>
        </Card>
      ) : filteredGroups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-6">
            <p className="text-sm text-muted-foreground">{t.common.noData}</p>
            <Button size="sm" variant="outline" onClick={onClearPermissionSearch}>
              {t.filters.clearAll}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <TooltipProvider>
          {filteredGroups.map((group) => {
            const selectedInGroup = group.permissions.filter((permission) =>
              selectedSet.has(permission.id),
            ).length;

            return (
              <Card key={group.key}>
                <CardContent className="flex flex-col gap-3 py-4">
                  <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
                    <h2 className="text-xs font-semibold text-foreground">{group.label}</h2>
                    <Badge tone="neutral" className="tabular-nums">
                      {formatNumber(selectedInGroup, lang)} /{" "}
                      {formatNumber(group.permissions.length, lang)}
                    </Badge>
                  </div>

                  <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {group.permissions.map((permission) => {
                      const grantable = canGrantPermission(permission.id);
                      const checked = selectedSet.has(permission.id);
                      const labelText = localizedValue(
                        permission.nameAr,
                        permission.nameEn,
                        lang,
                      );

                      return (
                        <li key={permission.id}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <label
                                tabIndex={grantable ? undefined : 0}
                                className={`flex items-start gap-2.5 rounded-md border p-2.5 transition-colors ${
                                  checked
                                    ? "border-primary/40 bg-accent/50"
                                    : "border-border bg-card"
                                } ${
                                  grantable && canEditPermissions
                                    ? "cursor-pointer hover:border-primary/60"
                                    : "opacity-80"
                                }`}
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={() => onToggle(permission.id)}
                                  disabled={!canEditPermissions || !grantable || isSubmitting}
                                  aria-label={labelText}
                                  className="mt-0.5"
                                />
                                <span className="flex min-w-0 flex-col gap-0.5">
                                  {/* The catalogue ships localized labels; never write a
                                      second description for a permission key here. */}
                                  <span className="text-xs font-medium text-foreground">
                                    {labelText}
                                  </span>
                                  <span
                                    dir="ltr"
                                    className="truncate font-mono text-2xs text-muted-foreground"
                                  >
                                    {permission.key}
                                  </span>
                                </span>
                              </label>
                            </TooltipTrigger>
                            {!grantable ? (
                              <TooltipContent>{copy.permissionNotGrantable}</TooltipContent>
                            ) : null}
                          </Tooltip>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </TooltipProvider>
      )}
    </div>
  );
}
