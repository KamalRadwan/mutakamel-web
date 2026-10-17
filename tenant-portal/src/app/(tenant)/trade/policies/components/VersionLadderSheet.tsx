"use client";

import { useState } from "react";
import { Edit3, GitBranch, ShieldCheck } from "lucide-react";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  IdentifierText,
  Input,
  SWATCH_SURFACE_PALETTES,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  cn,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDateTime } from "@/lib/format/date";
import type { Language } from "@/i18n/useLanguage";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import {
  GOVERNANCE_ACTIONS,
  GOVERNANCE_REASON_MAX_LENGTH,
  GOVERNED_VERSION_STATUSES,
  type GovernanceAction,
  type GovernedDefinition,
  type GovernedVersion,
} from "../governance-contract";

interface VersionLadderSheetProps {
  definition: GovernedDefinition;
  lang: Language;
  canManage?: boolean;
  canRun: (action: GovernanceAction) => boolean;
  pendingAction: GovernanceAction | null;
  onRun: (version: GovernedVersion, action: GovernanceAction, reason: string) => Promise<void>;
  onEditVersion?: (version: GovernedVersion) => void;
  onClose: () => void;
}

export function VersionLadderSheet({
  definition,
  lang,
  canManage = false,
  canRun,
  pendingAction,
  onRun,
  onEditVersion,
  onClose,
}: VersionLadderSheetProps) {
  const { t } = useI18n();
  const [reason, setReason] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
    definition.versions[0]?.id ?? null,
  );
  const selected =
    definition.versions.find((version) => version.id === selectedId) ?? definition.versions[0];

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="w-full max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <GitBranch className="size-4 text-primary" aria-hidden="true" />
            <span>{`${t.tradeGovernance.ladderTitle} · ${definition.code}`}</span>
          </SheetTitle>
          <SheetDescription>{t.tradeGovernance.ladderDescription}</SheetDescription>
        </SheetHeader>

        {definition.versions.length === 0 ? (
          <EmptyState
            title={t.tradeGovernance.noVersions}
            description={t.tradeGovernance.noVersionsDescription}
          />
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            {/* Version Selector Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                {definition.versions.map((version) => (
                  <Button
                    key={version.id}
                    variant={version.id === selected?.id ? "primary" : "outline"}
                    size="xs"
                    onClick={() => setSelectedId(version.id)}
                  >
                    <IdentifierText className="text-xs">{`v${version.versionNumber}`}</IdentifierText>
                    <Badge tone={version.status === "PUBLISHED" ? "positive" : "neutral"}>
                      {tradeStatusLabel(t.tradeStatus, version.status, t.common.unknownCode)}
                    </Badge>
                  </Button>
                ))}
              </div>
              {selected && canManage && onEditVersion && (
                <Button
                  size="xs"
                  variant="outline"
                  disabled={pendingAction !== null}
                  onClick={() => onEditVersion(selected)}
                >
                  <Edit3 className="size-3.5" aria-hidden="true" />
                  {t.tradeGovernance.editDraftVersion}
                </Button>
              )}
            </div>

            {selected ? (
              <>
                {/* 7-Stage Governance Ladder Stepper */}
                <div
                  className={cn(
                    "flex flex-wrap items-center gap-1.5 rounded-lg border p-3",
                    SWATCH_SURFACE_PALETTES.indigo.sectionCard,
                  )}
                >
                  {GOVERNED_VERSION_STATUSES.map((st, idx) => {
                    const isCurrent = selected.status === st;
                    return (
                      <div key={st} className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold",
                            isCurrent
                              ? SWATCH_SURFACE_PALETTES.indigo.badge
                              : "border-border bg-card text-muted-foreground",
                          )}
                        >
                          <IdentifierText className="text-xs">{String(idx + 1)}</IdentifierText>
                          {tradeStatusLabel(t.tradeStatus, st, t.common.unknownCode)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Maker-Checker Segregation Callout */}
                <div
                  className={cn(
                    "flex items-start gap-2 rounded-lg border p-3 text-xs",
                    SWATCH_SURFACE_PALETTES.amber.sectionCard,
                  )}
                >
                  <ShieldCheck
                    className={cn("mt-0.5 size-4 shrink-0", SWATCH_SURFACE_PALETTES.amber.iconText)}
                    aria-hidden="true"
                  />
                  <span className="text-foreground">{t.tradeGovernance.makerCheckerWarning}</span>
                </div>

                <dl className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-card p-3 text-xs">
                  <dt className="text-muted-foreground">{t.tradeGovernance.effectiveFrom}</dt>
                  <dd className="font-medium text-foreground">
                    {formatDateTime(selected.effectiveFrom, lang)}
                  </dd>
                  <dt className="text-muted-foreground">{t.tradeGovernance.effectiveTo}</dt>
                  <dd className="font-medium text-foreground">
                    {selected.effectiveTo ? formatDateTime(selected.effectiveTo, lang) : "—"}
                  </dd>
                  <dt className="text-muted-foreground">{t.tradeGovernance.approvedAt}</dt>
                  <dd className="font-medium text-foreground">
                    {selected.approvedAt ? formatDateTime(selected.approvedAt, lang) : "—"}
                  </dd>
                  <dt className="text-muted-foreground">{t.tradeCommon.version}</dt>
                  <dd className="font-medium text-foreground">
                    <IdentifierText className="tabular-nums">{String(selected.version)}</IdentifierText>
                  </dd>
                </dl>

                <Field
                  label={t.tradeGovernance.reason}
                  hint={t.tradeGovernance.reasonHint}
                  showLabel
                  hintPlacement="tooltip"
                >
                  <Input
                    size="sm"
                    placeholder={t.tradeGovernance.reason}
                    value={reason}
                    maxLength={GOVERNANCE_REASON_MAX_LENGTH}
                    disabled={pendingAction !== null}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </Field>

                {/* 8 Ladder Action Verbs */}
                <div className="flex flex-wrap gap-2">
                  {GOVERNANCE_ACTIONS.map((action) => (
                    <Button
                      key={action}
                      variant={action === "publish" || action === "approve" ? "primary" : "outline"}
                      size="sm"
                      disabled={!canRun(action) || pendingAction !== null}
                      loading={pendingAction === action}
                      onClick={() => void onRun(selected, action, reason)}
                    >
                      {t.tradeGovernance.actions[action]}
                    </Button>
                  ))}
                </div>

                {/* Version Content & Test Cases Preview */}
                {selected.content && Object.keys(selected.content).length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-foreground">
                      {t.tradeGovernance.content}
                    </span>
                    <pre
                      dir="ltr"
                      className="max-h-48 overflow-auto rounded-lg border border-border bg-muted/30 p-3 font-mono text-xs text-foreground"
                    >
                      {JSON.stringify(selected.content, null, 2)}
                    </pre>
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
