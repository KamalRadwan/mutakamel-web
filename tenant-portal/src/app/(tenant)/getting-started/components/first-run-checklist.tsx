"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  CircleDashed,
  CircleHelp,
  Lock,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import {
  Badge,
  type BadgeProps,
  Button,
  Card,
  CardContent,
  DegradedBanner,
  PageHeader,
  buttonVariantClasses,
  cn,
  proseMeasure,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import {
  ONBOARDING_STEPS,
  type OnboardingStepId,
  type OnboardingStepStatus,
} from "../onboarding-contract";
import { useFirstRunChecklist } from "../hooks/useFirstRunChecklist";

const STATUS_ICONS: Record<OnboardingStepStatus, LucideIcon> = {
  done: Check,
  todo: ArrowRight,
  blocked: CircleDashed,
  unauthorized: Lock,
  unchecked: CircleHelp,
  checking: Loader2,
};

// Tone through `Badge`, so the ramp stays inside the design system and the
// colour flips with the theme without a `dark:` variant here. `done` is the
// only positive outcome; nothing on this screen is a failure, so nothing takes
// `negative` — a step somebody else performs is a category, not a problem, and
// docs/design/tokens.md gives a category `neutral`, never a colour.
const STATUS_TONES: Record<OnboardingStepStatus, BadgeProps["tone"]> = {
  done: "positive",
  todo: "brand",
  blocked: "neutral",
  unauthorized: "neutral",
  unchecked: "neutral",
  checking: "neutral",
};

export function FirstRunChecklist() {
  const { t } = useI18n();
  const router = useRouter();
  const copy = t.gettingStarted;
  const checklist = useFirstRunChecklist();
  const { nextStep } = checklist;

  // Not a language branch — two different facts about the account, each with
  // its own key in both dictionaries (docs/design/i18n.md).
  const scopeExplanation = checklist.isTenantOwner
    ? copy.scopeOwnerNote
    : copy.scopeMemberNote;

  const nextHref = ONBOARDING_STEPS.find((step) => step.id === nextStep)?.href;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title={copy.title}
        description={copy.description}
        primaryAction={
          nextStep && nextHref
            ? {
                label: formatTemplate(copy.startWith, {
                  name: copy.steps[nextStep].name,
                }),
                onClick: () => router.push(nextHref),
              }
            : undefined
        }
      />

      {checklist.isZeroData ? (
        <Card>
          <CardContent className={cn("pt-6 text-sm text-foreground", proseMeasure)}>
            {copy.zeroDataSummary}
          </CardContent>
        </Card>
      ) : null}

      {/* Every error surface carries a real retry — docs/design/states.md. A
          probe that could not be asked is not an answer, so the only honest
          control here is one that asks again. */}
      {checklist.degradedSteps.length > 0 ? (
        <div className="flex items-start gap-2">
          <DegradedBanner message={copy.probeDegraded} className="grow" />
          <Button variant="outline" size="sm" onClick={checklist.retry}>
            {t.common.retry}
          </Button>
        </div>
      ) : null}

      <ol className="flex flex-col gap-2">
        {ONBOARDING_STEPS.map((step, index) => (
          <ChecklistRow
            key={step.id}
            index={index + 1}
            stepId={step.id}
            href={step.href}
            status={checklist.statuses[step.id]}
            isNext={nextStep === step.id}
          />
        ))}
      </ol>

      <p className={cn("text-xs text-muted-foreground", proseMeasure)}>
        {scopeExplanation}
      </p>
    </div>
  );
}

interface ChecklistRowProps {
  index: number;
  stepId: OnboardingStepId;
  href: string;
  status: OnboardingStepStatus;
  isNext: boolean;
}

function ChecklistRow({ index, stepId, href, status, isNext }: ChecklistRowProps) {
  const { t } = useI18n();
  const copy = t.gettingStarted;
  const step = copy.steps[stepId];
  const Icon = STATUS_ICONS[status];
  // Every row names its own next action — 13.14's rule, and the whole point of
  // this screen. `blocked` and `unauthorized` name a DIFFERENT action (finish
  // the previous step; ask the person who can), never a dead end.
  const detail = copy.statusDetail[status];

  return (
    <li>
      <Card className={cn(isNext && "border-primary")}>
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">
                {formatTemplate(copy.stepHeading, { index: String(index), name: step.name })}
              </span>
              <span className={cn("text-xs text-muted-foreground", proseMeasure)}>
                {step.description}
              </span>
              {/* Colour is reinforcement, never the only signal: the badge
                  always carries the sentence as well as the tone. */}
              <Badge tone={STATUS_TONES[status]} className="max-w-full">
                <Icon
                  className={cn(
                    "size-3 shrink-0",
                    status === "checking" && "animate-spin motion-reduce:animate-none",
                  )}
                  aria-hidden="true"
                />
                <span className="wrap-anywhere">{detail}</span>
              </Badge>
            </div>
          </div>

          {/* Always `outline`: the one filled primary on this screen is the
              "start with" action in PageHeader — AGENTS.md#design. */}
          {status === "unauthorized" || status === "blocked" ? null : (
            <Link
              href={href}
              className={cn(buttonVariantClasses("outline", "sm"), "shrink-0")}
            >
              {step.action}
              <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
            </Link>
          )}
        </CardContent>
      </Card>
    </li>
  );
}
