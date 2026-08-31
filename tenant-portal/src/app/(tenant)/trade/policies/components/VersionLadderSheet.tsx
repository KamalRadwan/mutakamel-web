"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDateTime } from "@/lib/format/date";
import type { Language } from "@/i18n/useLanguage";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import {
  GOVERNANCE_ACTIONS,
  GOVERNANCE_REASON_MAX_LENGTH,
  type GovernanceAction,
  type GovernedDefinition,
  type GovernedVersion,
} from "../governance-contract";

interface VersionLadderSheetProps {
  definition: GovernedDefinition;
  lang: Language;
  canRun: (action: GovernanceAction) => boolean;
  pendingAction: GovernanceAction | null;
  onRun: (version: GovernedVersion, action: GovernanceAction, reason: string) => Promise<void>;
  onClose: () => void;
}

/**
 * The nine-verb ladder over seven states.
 *
 * `SCHEDULED` and `SUPERSEDED` are reached without any user action — a version
 * becomes SCHEDULED because its `effectiveFrom` is in the future and
 * SUPERSEDED because a later version published over it — so both render as
 * states with no verb rather than being omitted.
 *
 * Every verb is offered on every version: source states no state machine that
 * closes which action is legal from which status, and the refusal
 * (409 `PUBLISH_NOT_ALLOWED`, 409 `MAKER_CHECKER_REQUIRED`) is the server's to
 * make. Disabling a button on a guessed transition table would hide actions
 * the server would have allowed.
 */
export function VersionLadderSheet({
  definition,
  lang,
  canRun,
  pendingAction,
  onRun,
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
      <SheetContent className="w-full max-w-xl">
        <SheetHeader>
          <SheetTitle>{`${t.tradeGovernance.ladderTitle} · ${definition.code}`}</SheetTitle>
          <SheetDescription>{t.tradeGovernance.ladderDescription}</SheetDescription>
        </SheetHeader>

        {definition.versions.length === 0 ? (
          <EmptyState
            title={t.tradeGovernance.noVersions}
            description={t.tradeGovernance.noVersionsDescription}
          />
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {definition.versions.map((version) => (
                <Button
                  key={version.id}
                  variant={version.id === selected?.id ? "outline" : "ghost"}
                  size="sm"
                  onClick={() => setSelectedId(version.id)}
                >
                  {`v${version.versionNumber}`}
                  <Badge tone={version.status === "PUBLISHED" ? "positive" : "neutral"}>
                    {tradeStatusLabel(t.tradeStatus, version.status)}
                  </Badge>
                </Button>
              ))}
            </div>

            {selected ? (
              <>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt className="text-muted-foreground">{t.tradeGovernance.effectiveFrom}</dt>
                  <dd className="text-foreground">
                    {formatDateTime(selected.effectiveFrom, lang)}
                  </dd>
                  <dt className="text-muted-foreground">{t.tradeGovernance.effectiveTo}</dt>
                  <dd className="text-foreground">
                    {selected.effectiveTo ? formatDateTime(selected.effectiveTo, lang) : "—"}
                  </dd>
                  <dt className="text-muted-foreground">{t.tradeGovernance.approvedAt}</dt>
                  <dd className="text-foreground">
                    {selected.approvedAt ? formatDateTime(selected.approvedAt, lang) : "—"}
                  </dd>
                  <dt className="text-muted-foreground">{t.tradeCommon.version}</dt>
                  <dd className="text-foreground">{selected.version}</dd>
                </dl>

                <Field
                  label={t.tradeGovernance.reason}
                  hint={t.tradeGovernance.reasonHint}
                >
                  <Input
                    value={reason}
                    maxLength={GOVERNANCE_REASON_MAX_LENGTH}
                    disabled={pendingAction !== null}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </Field>

                <div className="flex flex-wrap gap-2">
                  {GOVERNANCE_ACTIONS.map((action) => (
                    <Button
                      key={action}
                      variant="outline"
                      size="sm"
                      disabled={!canRun(action) || pendingAction !== null}
                      loading={pendingAction === action}
                      onClick={() => void onRun(selected, action, reason)}
                    >
                      {t.tradeGovernance.actions[action]}
                    </Button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
