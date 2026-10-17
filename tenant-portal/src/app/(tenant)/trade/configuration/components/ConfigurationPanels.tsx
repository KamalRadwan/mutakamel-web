"use client";

import { useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  FlaskConical,
  Layers,
  Play,
  Plus,
  Rocket,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  Badge,
  Button,
  ConfirmActionModal,
  DegradedBanner,
  DetailSection,
  ErrorState,
  Field,
  IdentifierText,
  Input,
  SWATCH_SURFACE_PALETTES,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  cn,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDateTime } from "@/lib/format/date";
import { useConfigurationResolve } from "../hooks/useConfigurationResolve";
import { useDefaultPriceBooks } from "../hooks/useDefaultPriceBooks";
import {
  PRICE_BOOK_PURPOSES,
  isConfigurationScope,
  isRiskClass,
  isVersionStatus,
  type ConfigurationDefinition,
  type ConfigurationVersion,
  type PriceBookPurpose,
  type VersionTestReport,
} from "../configuration-contract";
import {
  CONFIG_UI_COPY,
  POLICY_STARTER_TEMPLATES,
  RISK_CLASS_PALETTES,
  describeTestDiagnostic,
  formatPolicyValueHumanReadable,
} from "../configuration-catalogue-metadata";

const CURRENCY_QUICK_PRESETS = ["EGP", "USD", "SAR", "EUR", "AED", "GBP"] as const;

export function VersionsPanel({
  definition,
  canManage,
  canPublish,
  isSubmitting,
  report,
  onCreate,
  onAction,
}: {
  definition: ConfigurationDefinition;
  canManage: boolean;
  canPublish: boolean;
  isSubmitting: boolean;
  report: VersionTestReport | null;
  onCreate: () => void;
  onAction: (version: ConfigurationVersion, action: "test" | "publish") => void;
}) {
  const { t, lang } = useI18n();
  const copy = CONFIG_UI_COPY[lang];
  const riskKey = isRiskClass(definition.riskClass) ? definition.riskClass : "MEDIUM";
  const riskPalette = RISK_CLASS_PALETTES[riskKey];
  const isHighRisk = definition.riskClass === "HIGH" || definition.riskClass === "CRITICAL";

  return (
    <DetailSection
      title={t.trade.versionsTitle}
      description={t.trade.versionsDescription}
      action={
        canManage ? (
          <Button variant="primary" size="sm" onClick={onCreate} disabled={isSubmitting}>
            <Plus className="size-3.5" aria-hidden="true" />
            {t.trade.versionCreate}
          </Button>
        ) : null
      }
    >
      <div className="flex flex-col gap-3">
        {/* Selected Definition Summary & Maker-Checker Governance Banner */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/25 p-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <IdentifierText className="font-semibold text-foreground">
              {definition.key}
            </IdentifierText>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-semibold",
                riskPalette.badgeClass,
              )}
            >
              <span className={cn("size-1.5 rounded-full", riskPalette.dotClass)} />
              {isRiskClass(definition.riskClass)
                ? t.trade[`riskClass_${definition.riskClass}`]
                : definition.riskClass}
            </span>
          </div>
          {isHighRisk && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5",
                SWATCH_SURFACE_PALETTES.amber.iconText,
              )}
            >
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              {copy.makerCheckerActive}
            </span>
          )}
        </div>

        {report && !report.passed ? (
          <DegradedBanner message={t.trade.versionTestReported} />
        ) : null}

        {/* Human-Readable Test Diagnostics Panel */}
        {report && (
          <div
            className={cn(
              "rounded-lg border p-3 text-xs",
              report.passed
                ? SWATCH_SURFACE_PALETTES.green.sectionCard
                : SWATCH_SURFACE_PALETTES.red.sectionCard,
            )}
          >
            <div className="flex items-center gap-2 font-semibold text-foreground">
              {report.passed ? (
                <CheckCircle2
                  className={cn("size-4", SWATCH_SURFACE_PALETTES.green.iconText)}
                  aria-hidden="true"
                />
              ) : (
                <AlertTriangle
                  className={cn("size-4", SWATCH_SURFACE_PALETTES.red.iconText)}
                  aria-hidden="true"
                />
              )}
              <span>
                {report.passed
                  ? copy.versionPassedAllChecks
                  : copy.versionDiagnosticFindings}
              </span>
            </div>
            {report.diagnostics.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1.5 ps-5">
                {report.diagnostics.map((diagCode, idx) => (
                  <li key={`${diagCode}-${idx}`} className="list-disc">
                    <IdentifierText className="me-1.5 font-semibold">{diagCode}</IdentifierText>
                    <span>{describeTestDiagnostic(diagCode, lang)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {definition.versions.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t.trade.versionEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {definition.versions.map((version) => (
              <li
                key={version.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/20"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {t.trade.versionNumber} {version.versionNumber}
                    </span>
                    <Badge tone="neutral">
                      {isConfigurationScope(version.scopeTarget)
                        ? t.trade[`scopeTarget_${version.scopeTarget}`]
                        : version.scopeTarget}
                    </Badge>
                    <IdentifierText className="rounded border border-border bg-muted/40 px-2 py-0.5 text-xs font-semibold text-foreground">
                      {formatPolicyValueHumanReadable(version.value, lang)}
                    </IdentifierText>
                  </div>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {formatDateTime(version.effectiveFrom, lang)}
                    {version.effectiveTo
                      ? ` → ${formatDateTime(version.effectiveTo, lang)}`
                      : ""}
                  </span>
                </div>
                <span className="flex shrink-0 items-center gap-2">
                  <Badge
                    tone={
                      version.status === "PUBLISHED"
                        ? "positive"
                        : version.status === "TESTED"
                          ? "brand"
                          : "neutral"
                    }
                  >
                    {isVersionStatus(version.status) ? (
                      t.trade[`versionStatus_${version.status}`]
                    ) : (
                      <IdentifierText>{version.status}</IdentifierText>
                    )}
                  </Badge>
                  {canManage ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isSubmitting}
                      onClick={() => onAction(version, "test")}
                    >
                      <FlaskConical className="size-3.5" aria-hidden="true" />
                      {t.trade.versionTest}
                    </Button>
                  ) : null}
                  {/* Publishing needs `trade.policy.publish`, which
                      configuration-manage does not include. Absent, not disabled. */}
                  {canPublish ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isSubmitting}
                      onClick={() => onAction(version, "publish")}
                    >
                      <Rocket className="size-3.5" aria-hidden="true" />
                      {t.trade.versionPublish}
                    </Button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </DetailSection>
  );
}

export function ResolvePanel() {
  const { t, lang } = useI18n();
  const copy = CONFIG_UI_COPY[lang];
  const resolve = useConfigurationResolve();
  const [showRawResponse, setShowRawResponse] = useState(false);
  if (!resolve.canRead) return null;

  function appendKey(keyToAdd: string) {
    const existing = resolve.keys
      .split(/[\n,]+/u)
      .map((k) => k.trim())
      .filter(Boolean);
    if (!existing.includes(keyToAdd)) {
      resolve.setKeys([...existing, keyToAdd].join("\n"));
    }
  }

  function applyFactPreset(presetJson: Record<string, unknown>) {
    resolve.setFacts(JSON.stringify(presetJson, null, 2));
  }

  return (
    <DetailSection title={t.trade.resolveTitle} description={t.trade.resolveDescription}>
      <div className="flex flex-col gap-4">
        {/* Quick Policy Keys Selector Pills */}
        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
            <span>{copy.quickAddPolicyKeys}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {POLICY_STARTER_TEMPLATES.map((tpl) => (
              <Button
                key={tpl.id}
                type="button"
                size="xs"
                variant="outline"
                disabled={resolve.isSubmitting}
                onClick={() => appendKey(tpl.key)}
                className="font-mono text-xs"
              >
                <Plus className="size-3 text-primary" aria-hidden="true" />
                {tpl.key}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Field
            label={t.trade.resolveKeys}
            hint={t.trade.resolveKeysHint}
            error={resolve.formError ?? undefined}
            required
          >
            <Textarea
              placeholder={t.trade.resolveKeys}
              dir="ltr"
              className="font-mono text-xs"
              value={resolve.keys}
              onChange={(event) => resolve.setKeys(event.target.value)}
              disabled={resolve.isSubmitting}
              required
            />
          </Field>

          <Field label={t.trade.resolveFacts} hint={t.trade.resolveFactsHint}>
            <Textarea
              placeholder={t.trade.resolveFacts}
              dir="ltr"
              className="font-mono text-xs"
              value={resolve.facts}
              onChange={(event) => resolve.setFacts(event.target.value)}
              disabled={resolve.isSubmitting}
            />
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">{copy.contextPresets}</span>
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={resolve.isSubmitting}
                onClick={() =>
                  applyFactPreset({ channelType: "POS", currencyCode: "EGP" })
                }
              >
                {copy.posRetailPreset}
              </Button>
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={resolve.isSubmitting}
                onClick={() =>
                  applyFactPreset({
                    channelType: "B2B_PORTAL",
                    accountRole: "CUSTOMER",
                    currencyCode: "USD",
                  })
                }
              >
                {copy.b2bWholesalePreset}
              </Button>
            </div>
          </Field>
        </div>

        <div>
          <Button
            size="sm"
            variant="primary"
            loading={resolve.isSubmitting}
            onClick={() => void resolve.resolve()}
          >
            <Play className="size-3.5" aria-hidden="true" />
            {t.trade.resolveRun}
          </Button>
        </div>

        {resolve.resolved ? (
          <div
            className={cn(
              "flex flex-col gap-3 rounded-lg border p-3.5",
              SWATCH_SURFACE_PALETTES.green.sectionCard,
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 text-xs font-semibold",
                  SWATCH_SURFACE_PALETTES.green.iconText,
                )}
              >
                <Layers className="size-4" aria-hidden="true" />
                {copy.resolvedEffectiveValues}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {t.trade.resolveEvaluatedAt}:{" "}
                  {formatDateTime(resolve.resolved.evaluatedAt, lang)}
                </span>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() => setShowRawResponse((prev) => !prev)}
                >
                  {showRawResponse ? copy.hideResponseSource : copy.showResponseSource}
                </Button>
              </div>
            </div>

            {Object.keys(resolve.resolved.values).length > 0 && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(resolve.resolved.values).map(([k, v]) => (
                  <div
                    key={k}
                    className="rounded-md border border-border bg-card p-2.5 shadow-2xs"
                  >
                    <IdentifierText className="block truncate text-xs font-semibold text-muted-foreground">
                      {k}
                    </IdentifierText>
                    <p className="mt-1 font-mono text-sm font-semibold text-foreground">
                      {formatPolicyValueHumanReadable(v, lang)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <pre
              dir="ltr"
              className={cn(
                "overflow-x-auto rounded-md border border-border bg-card p-2.5 font-mono text-xs",
                !showRawResponse && "sr-only",
              )}
            >
              {JSON.stringify(resolve.resolved.values, null, 2)}
            </pre>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t.trade.resolveEmpty}</p>
        )}
      </div>
    </DetailSection>
  );
}

export function DefaultPriceBooksPanel() {
  const { t, lang } = useI18n();
  const copy = CONFIG_UI_COPY[lang];
  const books = useDefaultPriceBooks();
  if (!books.canRead) return null;

  return (
    <DetailSection title={t.trade.priceBooksTitle} description={t.trade.priceBooksDescription}>
      {books.scopeGap ? (
        <p className="text-xs text-muted-foreground">{t.trade.priceBookScopeRequired}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Quick Purpose Cards */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {PRICE_BOOK_PURPOSES.map((purpose) => {
              const selected = books.purpose === purpose;
              return (
                <Button
                  key={purpose}
                  type="button"
                  size="sm"
                  variant={selected ? "primary" : "outline"}
                  disabled={books.isSubmitting}
                  onClick={() => books.setPurpose(purpose)}
                  className="h-auto justify-between p-3 text-start"
                >
                  <div className="flex items-center gap-2.5">
                    <BookOpen className="size-4 shrink-0" aria-hidden="true" />
                    <div>
                      <p className="text-xs font-semibold">{t.trade[`purpose_${purpose}`]}</p>
                      <p className="text-xs opacity-80">
                        {purpose === "SALES"
                          ? copy.purposeSalesHint
                          : copy.purposePurchaseHint}
                      </p>
                    </div>
                  </div>
                  <Badge tone={selected ? "brand" : "neutral"}>{purpose}</Badge>
                </Button>
              );
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t.trade.priceBookPurpose} required>
              <Select
                value={books.purpose}
                onValueChange={(next) => books.setPurpose(next as PriceBookPurpose)}
                disabled={books.isSubmitting}
              >
                <SelectTrigger size="sm" aria-label={t.trade.priceBookPurpose}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRICE_BOOK_PURPOSES.map((purpose) => (
                    <SelectItem key={purpose} value={purpose}>
                      {t.trade[`purpose_${purpose}`]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field
              label={t.trade.priceBookCurrency}
              hint={t.trade.accountCurrencyHint}
              error={books.formError ?? undefined}
              required
            >
              <Input
                size="sm"
                placeholder={t.trade.priceBookCurrency}
                dir="ltr"
                value={books.currencyCode}
                onChange={(event) => books.setCurrencyCode(event.target.value.toUpperCase())}
                maxLength={3}
                disabled={books.isSubmitting}
                required
              />
              <div className="mt-1.5 flex flex-wrap gap-1">
                {CURRENCY_QUICK_PRESETS.map((curr) => (
                  <Button
                    key={curr}
                    type="button"
                    size="xs"
                    variant={
                      books.currencyCode.toUpperCase() === curr ? "primary" : "outline"
                    }
                    disabled={books.isSubmitting}
                    onClick={() => books.setCurrencyCode(curr)}
                    className="font-mono text-xs"
                  >
                    {curr}
                  </Button>
                ))}
              </div>
            </Field>
            <Field label={t.trade.priceBookId} hint={t.trade.priceBookVersionZeroHint}>
              <Input
                size="sm"
                placeholder={t.trade.priceBookId}
                dir="ltr"
                className="font-mono"
                value={books.priceBookId}
                onChange={(event) => books.setPriceBookId(event.target.value)}
                disabled={books.isSubmitting || !books.canManage}
                readOnly={!books.canManage}
              />
            </Field>
          </div>

          {books.mapping && (
            <div
              className={cn(
                "flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-xs",
                SWATCH_SURFACE_PALETTES.green.sectionCard,
              )}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2
                  className={cn("size-4", SWATCH_SURFACE_PALETTES.green.iconText)}
                  aria-hidden="true"
                />
                <span className="font-semibold text-foreground">
                  {books.mapping.purpose === "PURCHASE"
                    ? t.trade.purpose_PURCHASE
                    : t.trade.purpose_SALES}{" "}
                  ({books.mapping.currencyCode}):
                </span>
                <IdentifierText className="font-semibold text-foreground">
                  {books.mapping.priceBookId}
                </IdentifierText>
              </div>
              <Badge tone="positive">{t.common.active}</Badge>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              loading={books.isLoading}
              onClick={() => void books.load()}
            >
              {t.trade.priceBookLoad}
            </Button>
            {books.canManage ? (
              <Button
                size="sm"
                variant="primary"
                loading={books.isSubmitting}
                onClick={() => void books.save()}
              >
                {t.trade.priceBookSave}
              </Button>
            ) : null}
            {books.canManage && books.mapping ? (
              <Button
                size="sm"
                variant="outline"
                onClick={books.openDelete}
                disabled={books.isSubmitting}
              >
                {t.trade.priceBookDelete}
              </Button>
            ) : null}
          </div>

          {/* A missing mapping is an ordinary answer, not a failure. */}
          {books.notFound ? (
            <p className="text-xs text-muted-foreground">{t.trade.priceBookNotFound}</p>
          ) : null}

          {books.error ? (
            <ErrorState
              title={t.trade.priceBookSaveFailed}
              onRetry={() => void books.load()}
              retryLabel={t.common.retry}
            />
          ) : null}

          <ConfirmActionModal
            open={books.deleteOpen}
            onOpenChange={(open) => {
              if (!open) books.closeDelete();
            }}
            title={t.trade.priceBookDeleteTitle}
            description={t.trade.priceBookDeleteDescription}
            confirmLabel={t.trade.priceBookDelete}
            cancelLabel={t.common.cancel}
            onConfirm={() => void books.remove()}
            loading={books.isSubmitting}
          />
        </div>
      )}
    </DetailSection>
  );
}
