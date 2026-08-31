"use client";

import {
  Badge,
  Button,
  ConfirmActionModal,
  DegradedBanner,
  DetailSection,
  ErrorState,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDateTime } from "@/lib/format/date";
import { useConfigurationResolve } from "../hooks/useConfigurationResolve";
import { useDefaultPriceBooks } from "../hooks/useDefaultPriceBooks";
import {
  PRICE_BOOK_PURPOSES,
  isVersionStatus,
  type ConfigurationDefinition,
  type ConfigurationVersion,
  type PriceBookPurpose,
  type VersionTestReport,
} from "../configuration-contract";



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

  return (
    <DetailSection
      title={t.trade.versionsTitle}
      description={t.trade.versionsDescription}
      action={
        canManage ? (
          <Button variant="outline" size="sm" onClick={onCreate} disabled={isSubmitting}>
            {t.trade.versionCreate}
          </Button>
        ) : null
      }
    >
      {report && !report.passed ? <DegradedBanner message={t.trade.versionTestReported} /> : null}

      {definition.versions.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t.trade.versionEmpty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {definition.versions.map((version) => (
            <li
              key={version.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-border p-2"
            >
              <span className="min-w-0">
                <span className="block text-sm text-foreground">
                  {t.trade.versionNumber} {version.versionNumber}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {formatDateTime(version.effectiveFrom, lang)}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <Badge tone={version.status === "PUBLISHED" ? "positive" : "neutral"}>
                  {isVersionStatus(version.status) ? (
                    t.trade[`versionStatus_${version.status}`]
                  ) : (
                    <span className="font-mono">{version.status}</span>
                  )}
                </Badge>
                {canManage ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isSubmitting}
                    onClick={() => onAction(version, "test")}
                  >
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
                    {t.trade.versionPublish}
                  </Button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </DetailSection>
  );
}

export function ResolvePanel() {
  const { t, lang } = useI18n();
  const resolve = useConfigurationResolve();
  if (!resolve.canRead) return null;

  return (
    <DetailSection title={t.trade.resolveTitle} description={t.trade.resolveDescription}>
      <div className="flex flex-col gap-4">
        <Field
          label={t.trade.resolveKeys}
          hint={t.trade.resolveKeysHint}
          error={resolve.formError ?? undefined}
          required
        >
          <Textarea
            dir="ltr"
            className="font-mono"
            value={resolve.keys}
            onChange={(event) => resolve.setKeys(event.target.value)}
            disabled={resolve.isSubmitting}
            required
          />
        </Field>
        <Field label={t.trade.resolveFacts} hint={t.trade.resolveFactsHint}>
          <Textarea
            dir="ltr"
            className="font-mono"
            value={resolve.facts}
            onChange={(event) => resolve.setFacts(event.target.value)}
            disabled={resolve.isSubmitting}
          />
        </Field>
        <div>
          <Button
            variant="outline"
            loading={resolve.isSubmitting}
            onClick={() => void resolve.resolve()}
          >
            {t.trade.resolveRun}
          </Button>
        </div>
        {resolve.resolved ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              {t.trade.resolveEvaluatedAt}: {formatDateTime(resolve.resolved.evaluatedAt, lang)}
            </p>
            <pre className="overflow-x-auto rounded-sm border border-border p-2 font-mono text-xs">
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
  const { t } = useI18n();
  const books = useDefaultPriceBooks();
  if (!books.canRead) return null;

  return (
    <DetailSection title={t.trade.priceBooksTitle} description={t.trade.priceBooksDescription}>
      {books.scopeGap ? (
        <p className="text-xs text-muted-foreground">{t.trade.priceBookScopeRequired}</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t.trade.priceBookPurpose} required>
              <Select
                value={books.purpose}
                onValueChange={(next) => books.setPurpose(next as PriceBookPurpose)}
                disabled={books.isSubmitting}
              >
                <SelectTrigger aria-label={t.trade.priceBookPurpose}>
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
                dir="ltr"
                value={books.currencyCode}
                onChange={(event) => books.setCurrencyCode(event.target.value.toUpperCase())}
                maxLength={3}
                disabled={books.isSubmitting}
                required
              />
            </Field>
            <Field label={t.trade.priceBookId} hint={t.trade.priceBookVersionZeroHint}>
              <Input
                dir="ltr"
                className="font-mono"
                value={books.priceBookId}
                onChange={(event) => books.setPriceBookId(event.target.value)}
                disabled={books.isSubmitting || !books.canManage}
                readOnly={!books.canManage}
              />
            </Field>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" loading={books.isLoading} onClick={() => void books.load()}>
              {t.trade.priceBookLoad}
            </Button>
            {books.canManage ? (
              <Button
                variant="outline"
                loading={books.isSubmitting}
                onClick={() => void books.save()}
              >
                {t.trade.priceBookSave}
              </Button>
            ) : null}
            {books.canManage && books.mapping ? (
              <Button variant="outline" onClick={books.openDelete} disabled={books.isSubmitting}>
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
