import { Check, CircleDashed, Loader2, ShieldAlert, X } from "lucide-react";
import type { Language } from "@/i18n/I18nContext";
import { formatLocaleNumber } from "@/i18n/locale";
import { cn } from "../../lib/cn";

type OperationTimelineStepState = "done" | "active" | "warning" | "failed" | "pending";

export interface OperationTimelineStep {
  label: string;
  detail: string;
  state: OperationTimelineStepState;
}

const STATE_STYLE: Record<OperationTimelineStepState, { icon: typeof Check; badge: string }> = {
  done: { icon: Check, badge: "bg-success-subtle text-success-subtle-foreground" },
  active: { icon: Loader2, badge: "bg-muted text-foreground" },
  warning: { icon: ShieldAlert, badge: "bg-warning-subtle text-warning-subtle-foreground" },
  failed: { icon: X, badge: "bg-destructive-subtle text-destructive-subtle-foreground" },
  pending: { icon: CircleDashed, badge: "bg-muted text-muted-foreground" },
};

/**
 * A sequence of operation steps — readiness chains (backup), rollout stages
 * (provisioning). "active" is neutral + a spinning icon, never a hue, so
 * in-progress never reads as "the blue one" (docs/design-system).
 */
export function OperationTimeline({
  steps,
  title,
  description,
  lang = "en",
}: {
  steps: OperationTimelineStep[];
  title?: string;
  description?: string;
  lang?: Language;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 text-card-foreground">
      {(title || description) && (
        <div className="mb-5">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
      )}
      <ol className="grid gap-3 md:grid-cols-4">
        {steps.map((step, index) => {
          const { icon: Icon, badge } = STATE_STYLE[step.state];
          return (
            <li key={step.label} className="rounded-lg border border-border bg-muted/40 p-4">
              <div className="flex items-center gap-3">
                <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", badge)}>
                  <Icon className={cn("size-4", step.state === "active" && "animate-spin motion-reduce:animate-none")} aria-hidden="true" />
                </span>
                <div>
                  <span className="text-xs text-muted-foreground">
                    {formatLocaleNumber(lang, index + 1, { minimumIntegerDigits: 2 })}
                  </span>
                  <h3 className="text-sm font-semibold">{step.label}</h3>
                </div>
              </div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">{step.detail}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
