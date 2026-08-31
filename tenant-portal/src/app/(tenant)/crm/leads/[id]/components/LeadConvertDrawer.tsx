"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  AmbiguousOutcomePanel,
  Button,
  DetailSection,
  FormDrawer,
  Stepper,
  cn,
  iconSize,
  mirrorInRtl,
  type StepState,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import { useAmbiguousOutcomeLabels } from "../../../shared/hooks/useAmbiguousOutcomeLabels";
import { useCrmErrorText } from "../../../shared/hooks/useCrmErrorText";
import {
  CONVERSION_STEPS,
  type ConversionStep,
  type ConversionStepValidity,
  type useLeadConvert,
} from "../hooks/useLeadConvert";
import {
  ConversionContactStep,
  ConversionOpportunityStep,
  ConversionProfileStep,
} from "./LeadConvertSteps";

export interface LeadConvertDrawerProps {
  convert: ReturnType<typeof useLeadConvert>;
}

/**
 * Lead conversion — MASTER-PLAN 8.2, docs/design/detail-screens.md#lead-conversion.
 *
 * A drawer rather than a dialog: the form is long and the user needs to re-read
 * the lead behind it. The last step is a read-only review, because this write
 * is not reversible from the UI.
 *
 * On success the drawer keeps a **persistent** panel with links to the new
 * customer and opportunity instead of closing with a toast. A toast disappears
 * in four seconds and takes the only reference to two freshly-created records
 * with it.
 */
export function LeadConvertDrawer({ convert }: LeadConvertDrawerProps) {
  const { t, lang } = useI18n();
  const describeError = useCrmErrorText();
  const ambiguousLabels = useAmbiguousOutcomeLabels();
  const { form, step, stepValidity, result } = convert;

  const stepIndex = CONVERSION_STEPS.indexOf(step);
  const isLastStep = step === "review";
  // A lookup rather than a ternary chain: the review step is always advanceable
  // because it adds no input of its own, and nested ternaries around control
  // flow are exactly what docs/design/anti-patterns.md warns about.
  const canAdvance = isLastStep || stepValidity[step];
  const allValid =
    stepValidity.profile && stepValidity.contact && stepValidity.opportunity;

  return (
    <FormDrawer
      open={convert.open}
      onOpenChange={(open) => {
        if (!open) convert.closeDrawer();
      }}
      title={t.crmLeadConvert.title}
      description={t.crmLeadConvert.description}
      isDirty={result === null}
      isSubmitting={convert.isSubmitting}
      submitDisabled={result !== null || !isLastStep || !allValid}
      onSubmit={() => void convert.submit()}
      error={describeError(convert.error) ?? undefined}
      footerLeading={
        result === null && !isLastStep ? (
          <Button
            variant="outline"
            size="sm"
            disabled={!canAdvance}
            onClick={() =>
              convert.setStep(CONVERSION_STEPS[stepIndex + 1] as ConversionStep)
            }
          >
            {t.crmLeadConvert.next}
            <ArrowRight
              className={cn(iconSize({ size: "sm" }), mirrorInRtl)}
              aria-hidden="true"
            />
          </Button>
        ) : undefined
      }
      labels={{
        submit: t.crmLeadConvert.confirm,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
      }}
    >
      {result ? (
        <ConversionSuccessPanel
          customerProfileId={result.customerProfileId}
          opportunityId={result.opportunityId}
        />
      ) : (
        form && (
          <div className="flex flex-col gap-4">
            <Stepper
              label={t.crmLeadConvert.title}
              steps={CONVERSION_STEPS.map((id, index) => ({
                id,
                label: t.crmLeadConvert.steps[id],
                state: resolveStepState(id, step, index, stepIndex, stepValidity),
              }))}
              onStepSelect={(id) => convert.setStep(id as ConversionStep)}
            />

            {convert.ambiguous && (
              <AmbiguousOutcomePanel
                operation={t.crmLeadConvert.operation}
                idempotencyKey={convert.attempt?.idempotencyKey ?? ""}
                description={t.crmLeadConvert.ambiguousDescription}
                correlationId={convert.ambiguous.correlationId}
                retrying={convert.isSubmitting}
                onRetry={() => void convert.submit()}
                onDismiss={convert.dismissAmbiguous}
                labels={ambiguousLabels}
              />
            )}

            {step === "profile" && (
              <ConversionProfileStep form={form} setField={convert.setField} />
            )}
            {step === "contact" && (
              <ConversionContactStep form={form} setField={convert.setField} />
            )}
            {step === "opportunity" && (
              <ConversionOpportunityStep
                form={form}
                setField={convert.setField}
                pipelines={convert.pipelines}
                stages={convert.selectableStages}
                pipelinesFailed={convert.pipelinesFailed}
              />
            )}
            {step === "review" && (
              <DetailSection
                title={t.crmLeadConvert.reviewTitle}
                description={t.crmLeadConvert.reviewDescription}
                emptyValueLabel={t.detail.notRecorded}
                fields={[
                  {
                    label: t.crmLeadConvert.profileType,
                    value: t.crmCustomerProfiles.profileTypes[form.profileType],
                  },
                  {
                    label: t.crmLeads.name,
                    value:
                      form.profileType === "CORPORATE"
                        ? form.companyName || form.displayName
                        : form.displayName,
                  },
                  {
                    label: t.crmLeadConvert.contactFullName,
                    value: form.contactFullName,
                  },
                  {
                    label: t.crmLeadConvert.createOpportunity,
                    value: form.createOpportunity
                      ? t.crmShared.booleanYes
                      : t.crmShared.booleanNo,
                  },
                  ...(form.createOpportunity
                    ? [
                        {
                          label: t.crmOpportunities.pipeline,
                          value: localizedName(
                            convert.pipelines.find(
                              ({ id }) => id === form.pipelineId,
                            ) ?? null,
                            lang,
                          ),
                        },
                        {
                          label: t.crmOpportunities.stage,
                          value: localizedName(
                            convert.selectableStages.find(
                              ({ id }) => id === form.stageId,
                            ) ?? null,
                            lang,
                          ),
                        },
                        { label: t.crmOpportunities.title, value: form.title },
                      ]
                    : []),
                ]}
              />
            )}
          </div>
        )
      )}
    </FormDrawer>
  );
}

function resolveStepState(
  id: ConversionStep,
  current: ConversionStep,
  index: number,
  currentIndex: number,
  validity: ConversionStepValidity,
): StepState {
  if (id === current) return "current";
  if (index > currentIndex) return "upcoming";
  return validity[id] ? "complete" : "invalid";
}

function ConversionSuccessPanel({
  customerProfileId,
  opportunityId,
}: {
  customerProfileId: string;
  opportunityId: string | null;
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-3 rounded-sm border border-positive-200 bg-positive-50 p-4 dark:border-positive-800 dark:bg-positive-950">
      <p className="text-sm font-medium text-foreground">
        {t.crmLeadConvert.successTitle}
      </p>
      <p className="text-xs text-muted-foreground">
        {t.crmLeadConvert.successDescription}
      </p>
      <div className="flex flex-col gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/crm/customer-profiles/${customerProfileId}`}>
            {t.crmLeadConvert.viewCustomer}
          </Link>
        </Button>
        {opportunityId && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/crm/opportunities/${opportunityId}`}>
              {t.crmLeadConvert.viewOpportunity}
            </Link>
          </Button>
        )}
        <Button variant="ghost" size="sm" asChild>
          <Link href="/crm/leads">{t.crmLeadConvert.backToLeads}</Link>
        </Button>
      </div>
    </div>
  );
}
