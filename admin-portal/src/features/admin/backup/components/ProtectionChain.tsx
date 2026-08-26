import { Check, CircleDashed, ShieldAlert } from "lucide-react";

export interface ProtectionChainStep {
  label: string;
  detail: string;
  state: "ready" | "attention" | "unknown";
}

export function ProtectionChain({
  steps,
  title = "Protection chain",
  description = "Readiness evidence from access through recoverability. Unknown means the API returned no proof.",
}: {
  steps: ProtectionChainStep[];
  title?: string;
  description?: string;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm dark:border-slate-800">
      <div className="mb-5">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-slate-400">
          {description}
        </p>
      </div>
      <ol className="grid gap-3 md:grid-cols-4">
        {steps.map((step, index) => {
          const Icon =
            step.state === "ready"
              ? Check
              : step.state === "attention"
                ? ShieldAlert
                : CircleDashed;
          return (
            <li key={step.label} className="relative rounded-xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-center gap-3">
                <span
                  className={`grid size-8 shrink-0 place-items-center rounded-full ${
                    step.state === "ready"
                      ? "bg-emerald-500/15 text-emerald-300"
                      : step.state === "attention"
                        ? "bg-amber-500/15 text-amber-300"
                        : "bg-slate-800 text-slate-400"
                  }`}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <span className="text-xs text-slate-500">0{index + 1}</span>
                  <h3 className="text-sm font-semibold">{step.label}</h3>
                </div>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-400">{step.detail}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
