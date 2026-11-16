import { Badge, Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useTemplateDesignerBasePolicy, type TemplateDesignerBasePolicyProps } from "../hooks/useTemplateDesignerBasePolicy";

export function TemplateDesignerBasePolicy(props: TemplateDesignerBasePolicyProps) {
  const { t, dir } = useI18n();
  const copy = t.applications.baseFeaturePolicy;
  const { policy, intent, isOpen, isSubmitting, isRefreshing, errorMessage, failure, status, errorRef, needsRefresh, canChange, requestChange, submit, refresh, close } = useTemplateDesignerBasePolicy(props);
  return (
    <section className="rounded-md border border-border bg-muted/30 p-4" aria-label={copy.title}>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0 space-y-2">
          <h3 className="text-sm font-semibold text-foreground">{copy.title}</h3>
          <Badge tone={policy ? policy.baseIncluded ? "success" : "neutral" : "warn"}>
            {policy ? policy.baseIncluded ? copy.included : copy.excluded : copy.unavailable}
          </Badge>
          <p className="max-w-2xl text-xs text-muted-foreground">{copy.description}</p>
          {policy ? <p className="text-xs text-muted-foreground">{copy.revision} {policy.baseGrantRevision}</p> : null}
          {!props.canMutate ? <p className="text-xs text-muted-foreground">{copy.permissionRequired}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" loading={isRefreshing} disabled={isSubmitting} onClick={() => void refresh()}>{copy.refresh}</Button>
          {canChange ? <Button type="button" variant="outline" size="sm" disabled={isSubmitting || isRefreshing} onClick={requestChange}>
            {intent ? copy.reviewPending : policy?.baseIncluded ? copy.exclude : copy.include}
          </Button> : null}
        </div>
      </div>
      {status ? <p role="status" className="mt-3 text-xs text-foreground">{status}</p> : null}
      {errorMessage && !isOpen ? <p role="alert" className="mt-3 text-xs text-destructive">{errorMessage}</p> : null}
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) close(); }}>
        <DialogContent dir={dir} showCloseButton={!isSubmitting} aria-busy={isSubmitting || undefined}>
          <DialogHeader>
            <DialogTitle>{intent?.included ? copy.confirmInclude : copy.confirmExclude}</DialogTitle>
            <DialogDescription>{intent?.included ? copy.includeConsequence : copy.excludeConsequence}</DialogDescription>
          </DialogHeader>
          <p className="text-sm font-semibold text-foreground">{props.feature.name}</p>
          <p className="mt-1 break-all text-xs text-muted-foreground"><code dir="ltr">{props.feature.key}</code></p>
          <p className="mt-3 rounded-md border border-warning bg-warning-subtle p-3 text-xs text-warning-subtle-foreground">{copy.scope}</p>
          {errorMessage ? <div ref={errorRef} role="alert" tabIndex={-1} className="mt-3 rounded-md border border-destructive bg-destructive-subtle p-3 text-xs text-destructive-subtle-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <p>{errorMessage}</p>
            {failure?.correlationId ? <p className="mt-2 break-all">{copy.correlationId}: <code dir="ltr">{failure.correlationId}</code></p> : null}
          </div> : null}
          {!props.canMutate ? <p role="alert" className="mt-3 text-xs text-destructive">{copy.permissionRequired}</p> : null}
          <DialogFooter className="flex-wrap">
            <Button type="button" variant="ghost" size="sm" disabled={isSubmitting} onClick={close}>{t.common.cancel}</Button>
            {failure ? <Button type="button" variant="outline" size="sm" loading={isRefreshing} disabled={isSubmitting} onClick={() => void refresh()}>{copy.refresh}</Button> : null}
            <Button type="button" variant={intent?.included ? "primary" : "destructive"} size="sm" loading={isSubmitting} disabled={!canChange || needsRefresh || isRefreshing} onClick={() => void submit()}>
              {failure && !needsRefresh ? copy.retrySame : intent?.included ? copy.include : copy.exclude}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
