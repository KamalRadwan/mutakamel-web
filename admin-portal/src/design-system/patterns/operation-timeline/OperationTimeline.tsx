import { Check, CircleDashed, Loader2, ShieldAlert, X } from "lucide-react";
import { cn } from "../../lib/cn";

export type OperationTimelineStepState = "done" | "active" | "warning" | "failed" | "pending";

export interface OperationTimelineStep {
  label: string;
  detail: string;
  state: OperationTimelineStepState;
}

const STATE_STYLE: Record<OperationTimelineStepState, { icon: typeof Check; badge: string }> = {
  done: { icon: Check, badge: "bg-brand-500/15 text-brand-300" },
  active: { icon: Loader2, badge: "bg-ink-700 text-ink-200" },
  warning: { icon: ShieldAlert, badge: "bg-warn-500/15 text-warn-300" },
  failed: { icon: X, badge: "bg-danger-500/15 text-danger-300" },
  pending: { icon: CircleDashed, badge: "bg-ink-800 text-ink-400" },
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
}: {
  steps: OperationTimelineStep[];
  title?: string;
  description?: string;
}) {
  return (
    <section className="rounded-lg border border-border bg-ink-950 p-5 text-white">
      {(title || description) && (
        <div className="mb-5">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {description && <p className="mt-1 text-sm text-ink-400">{description}</p>}
        </div>
      )}
      <ol className="grid gap-3 md:grid-cols-4">
        {steps.map((step, index) => {
          const { icon: Icon, badge } = STATE_STYLE[step.state];
          return (
            <li key={step.label} className="rounded-lg border border-ink-800 bg-ink-900 p-4">
              <div className="flex items-center gap-3">
                <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", badge)}>
                  <Icon className={cn("size-4", step.state === "active" && "animate-spin")} aria-hidden="true" />
                </span>
                <div>
                  <span className="text-xs text-ink-500">0{index + 1}</span>
                  <h3 className="text-sm font-semibold">{step.label}</h3>
                </div>
              </div>
              <p className="mt-3 text-xs leading-5 text-ink-400">{step.detail}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
