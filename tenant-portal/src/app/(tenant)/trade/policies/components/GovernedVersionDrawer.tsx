"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  GitBranch,
  Layers,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  Badge,
  Button,
  Field,
  FormModal,
  Input,
  SWATCH_SURFACE_PALETTES,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
  cn,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import {
  EMPTY_POLICY_VISUAL_RULE,
  EMPTY_POLICY_VISUAL_TEST,
  EMPTY_VERSION_FORM,
  EMPTY_WORKFLOW_VISUAL_TEST,
  EMPTY_WORKFLOW_VISUAL_TRANSITION,
  POLICY_FACT_REGISTRY,
  POLICY_OPERATORS,
  POLICY_OUTCOMES,
  WORKFLOW_ACTIONS,
  serializePolicyVisualDraft,
  serializeWorkflowVisualDraft,
  validateWorkflowGraphClient,
  type GovernanceFamily,
  type GovernedVersion,
  type PolicyOperator,
  type PolicyOutcome,
  type PolicyVisualRuleDraft,
  type PolicyVisualTestCaseDraft,
  type VersionFormValues,
  type WorkflowActionVerb,
  type WorkflowVisualTestCaseDraft,
  type WorkflowVisualTransitionDraft,
} from "../governance-contract";

interface GovernedVersionDrawerProps {
  family?: GovernanceFamily;
  mode?: "create" | "edit";
  definitionCode: string;
  initialVersion?: GovernedVersion | null;
  onClose: () => void;
  onSubmit: (values: VersionFormValues) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
}

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 16);
}

export function GovernedVersionDrawer({
  family = "policy",
  mode = "create",
  definitionCode,
  initialVersion,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: GovernedVersionDrawerProps) {
  const { t } = useI18n();
  const [builderMode, setBuilderMode] = useState<"visual" | "json">("visual");

  // Policy visual state
  const [defaultOutcome, setDefaultOutcome] = useState<PolicyOutcome>("ALLOW");
  const [policyRules, setPolicyRules] = useState<PolicyVisualRuleDraft[]>([
    EMPTY_POLICY_VISUAL_RULE,
  ]);
  const [policyTests] = useState<PolicyVisualTestCaseDraft[]>([EMPTY_POLICY_VISUAL_TEST]);

  // Workflow visual state
  const [statesCsv, setStatesCsv] = useState("DRAFT, PENDING_APPROVAL, CONFIRMED, CANCELLED");
  const [initialState, setInitialState] = useState("DRAFT");
  const [terminalStatesCsv, setTerminalStatesCsv] = useState("CONFIRMED, CANCELLED");
  const [workflowTransitions, setWorkflowTransitions] = useState<WorkflowVisualTransitionDraft[]>([
    EMPTY_WORKFLOW_VISUAL_TRANSITION,
    {
      code: "TR_APPROVE",
      from: "PENDING_APPROVAL",
      action: "APPROVE",
      to: "CONFIRMED",
      requiresApproval: false,
    },
  ]);
  const [workflowTests] = useState<WorkflowVisualTestCaseDraft[]>([EMPTY_WORKFLOW_VISUAL_TEST]);

  const initialFormValues = useMemo<VersionFormValues>(() => {
    if (mode === "edit" && initialVersion) {
      return {
        content: JSON.stringify(initialVersion.content ?? {}, null, 2),
        testCases: JSON.stringify(initialVersion.testCases ?? [], null, 2),
        effectiveFrom: toDatetimeLocalValue(initialVersion.effectiveFrom),
        effectiveTo: toDatetimeLocalValue(initialVersion.effectiveTo),
      };
    }
    return EMPTY_VERSION_FORM;
  }, [mode, initialVersion]);

  const [values, setValues] = useState<VersionFormValues>(initialFormValues);
  const isDirty = JSON.stringify(values) !== JSON.stringify(initialFormValues);

  const workflowDiagnostics = useMemo(
    () =>
      family === "workflow"
        ? validateWorkflowGraphClient(
            statesCsv,
            initialState,
            terminalStatesCsv,
            workflowTransitions,
          )
        : null,
    [family, statesCsv, initialState, terminalStatesCsv, workflowTransitions],
  );

  const applyPolicyVisualUpdate = (
    nextOutcome: PolicyOutcome,
    nextRules: PolicyVisualRuleDraft[],
  ) => {
    setDefaultOutcome(nextOutcome);
    setPolicyRules(nextRules);
    const serialized = serializePolicyVisualDraft(nextOutcome, nextRules, policyTests);
    setValues((current) => ({
      ...current,
      content: serialized.content,
      testCases: serialized.testCases,
    }));
  };

  const applyWorkflowVisualUpdate = (
    nextStatesCsv: string,
    nextInitialState: string,
    nextTerminalStatesCsv: string,
    nextTransitions: WorkflowVisualTransitionDraft[],
  ) => {
    setStatesCsv(nextStatesCsv);
    setInitialState(nextInitialState);
    setTerminalStatesCsv(nextTerminalStatesCsv);
    setWorkflowTransitions(nextTransitions);
    const serialized = serializeWorkflowVisualDraft(
      nextStatesCsv,
      nextInitialState,
      nextTerminalStatesCsv,
      nextTransitions,
      workflowTests,
    );
    setValues((current) => ({
      ...current,
      content: serialized.content,
      testCases: serialized.testCases,
    }));
  };

  const loadStarterTemplateIntoForm = () => {
    if (family === "policy") {
      applyPolicyVisualUpdate(defaultOutcome, policyRules);
    } else {
      applyWorkflowVisualUpdate(statesCsv, initialState, terminalStatesCsv, workflowTransitions);
    }
  };

  return (
    <FormModal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      size="full"
      title={
        mode === "edit"
          ? `${t.tradeGovernance.versionEditTitle} · ${definitionCode}`
          : `${t.tradeGovernance.versionCreateTitle} · ${definitionCode}`
      }
      description={
        mode === "edit"
          ? t.tradeGovernance.versionEditDescription
          : t.tradeGovernance.versionCreateDescription
      }
      headerIcon={
        <div
          className={cn(
            "flex size-9 items-center justify-center rounded-lg border",
            family === "policy"
              ? SWATCH_SURFACE_PALETTES.indigo.iconBoxIdle
              : SWATCH_SURFACE_PALETTES.teal.iconBoxIdle,
          )}
        >
          {family === "policy" ? (
            <ShieldCheck className="size-4" aria-hidden="true" />
          ) : (
            <GitBranch className="size-4" aria-hidden="true" />
          )}
        </div>
      }
      titleBadge={
        <div className="flex items-center gap-1.5">
          <Badge tone={mode === "edit" ? "caution" : "brand"}>
            {mode === "edit" ? "PATCH" : "POST"}
          </Badge>
          {initialVersion && <Badge tone="neutral">{`v${initialVersion.versionNumber}`}</Badge>}
        </div>
      }
      headerAside={
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="xs"
            variant={builderMode === "visual" ? "primary" : "outline"}
            onClick={() => setBuilderMode("visual")}
          >
            <Sparkles className="size-3.5" aria-hidden="true" />
            {t.tradeGovernance.builderModeVisual}
          </Button>
          <Button
            type="button"
            size="xs"
            variant={builderMode === "json" ? "primary" : "outline"}
            onClick={() => setBuilderMode("json")}
          >
            <Code2 className="size-3.5" aria-hidden="true" />
            {t.tradeGovernance.builderModeJson}
          </Button>
        </div>
      }
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      onSubmit={() => void onSubmit(values)}
      error={error ?? undefined}
      asideSlot={
        <div className="flex flex-col gap-3 p-4">
          {family === "workflow" && workflowDiagnostics ? (
            <div
              className={cn(
                "rounded-lg border p-3.5",
                workflowDiagnostics.valid
                  ? SWATCH_SURFACE_PALETTES.green.sectionCard
                  : SWATCH_SURFACE_PALETTES.red.sectionCard,
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  {workflowDiagnostics.valid ? (
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
                  {t.tradeGovernance.graphValidatorTitle}
                </span>
                <Badge tone={workflowDiagnostics.valid ? "positive" : "negative"}>
                  {workflowDiagnostics.valid ? "BFS OK" : "ERR"}
                </Badge>
              </div>
              {workflowDiagnostics.valid ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {t.tradeGovernance.graphValidatorHealthy}
                </p>
              ) : (
                <ul className="mt-2 flex flex-col gap-1.5 text-xs text-foreground">
                  {workflowDiagnostics.unreachableStates.length > 0 && (
                    <li className="rounded border border-border bg-card p-2">
                      {formatTemplate(t.tradeGovernance.graphUnreachableStates, {
                        initial: initialState,
                        states: workflowDiagnostics.unreachableStates.join(", "),
                      })}
                    </li>
                  )}
                  {workflowDiagnostics.terminalOutgoingTransitions.length > 0 && (
                    <li className="rounded border border-border bg-card p-2">
                      {formatTemplate(t.tradeGovernance.graphTerminalOutgoing, {
                        states: workflowDiagnostics.terminalOutgoingTransitions.join(", "),
                      })}
                    </li>
                  )}
                </ul>
              )}
            </div>
          ) : (
            <div
              className={cn(
                "rounded-lg border p-3.5",
                SWATCH_SURFACE_PALETTES.indigo.sectionCard,
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-foreground">
                  {t.tradeGovernance.policyRulesTitle}
                </span>
                <Badge tone="brand">{String(policyRules.length)}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {t.tradeGovernance.versionCreateDescription}
              </p>
              <div className="mt-2.5">
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={loadStarterTemplateIntoForm}
                >
                  <Sparkles className="size-3.5" aria-hidden="true" />
                  {t.tradeGovernance.builderModeVisual}
                </Button>
              </div>
            </div>
          )}

          <div
            className={cn(
              "rounded-lg border p-3.5",
              SWATCH_SURFACE_PALETTES.amber.sectionCard,
            )}
          >
            <span className="text-xs font-semibold text-foreground">
              {t.tradePricing.makerCheckerCardTitle}
            </span>
            <p className="mt-1 text-xs text-muted-foreground">
              {t.tradeGovernance.makerCheckerWarning}
            </p>
          </div>
        </div>
      }
      labels={{
        submit: t.common.save,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
        sections: t.tradeGovernance.versionCreateTitle,
        sectionInvalid: t.tradeCommon.actionFailed,
      }}
    >
      <div className="flex flex-col gap-5">
        {/* Effective Window */}
        <div
          className={cn(
            "grid gap-3 rounded-lg border p-4 md:grid-cols-2",
            SWATCH_SURFACE_PALETTES.indigo.sectionCard,
          )}
        >
          <Field
            label={t.tradeGovernance.effectiveFrom}
            hint={t.tradePricing.guideEffectiveFrom}
            showLabel
            hintPlacement="tooltip"
            required
          >
            <Input
              size="sm"
              placeholder={t.tradeGovernance.effectiveFrom}
              type="datetime-local"
              value={values.effectiveFrom}
              disabled={isSubmitting}
              onChange={(event) =>
                setValues((current) => ({ ...current, effectiveFrom: event.target.value }))
              }
            />
          </Field>
          <Field
            label={t.tradeGovernance.effectiveTo}
            hint={t.tradeGovernance.effectiveToHint}
            showLabel
            hintPlacement="tooltip"
          >
            <Input
              size="sm"
              placeholder={t.tradeGovernance.effectiveTo}
              type="datetime-local"
              value={values.effectiveTo}
              disabled={isSubmitting}
              onChange={(event) =>
                setValues((current) => ({ ...current, effectiveTo: event.target.value }))
              }
            />
          </Field>
        </div>

        {/* Visual Builder Section */}
        {builderMode === "visual" && family === "policy" && (
          <div className="flex flex-col gap-4 rounded-lg border border-border bg-muted/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Layers className="size-4 text-primary" aria-hidden="true" />
                <span className="text-sm font-semibold text-foreground">
                  {t.tradeGovernance.policyRulesTitle}
                </span>
              </div>
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={isSubmitting}
                onClick={() =>
                  applyPolicyVisualUpdate(defaultOutcome, [
                    ...policyRules,
                    {
                      ...EMPTY_POLICY_VISUAL_RULE,
                      code: `RULE_0${policyRules.length + 1}`,
                      priority: String((policyRules.length + 1) * 100),
                    },
                  ])
                }
              >
                <Plus className="size-3.5" aria-hidden="true" />
                {t.tradeGovernance.addPolicyRule}
              </Button>
            </div>

            {policyRules.map((rule, rIdx) => (
              <div
                key={rIdx}
                className={cn(
                  "flex flex-col gap-3 rounded-lg border border-s-4 bg-card p-3.5",
                  SWATCH_SURFACE_PALETTES.indigo.accentBorder,
                )}
              >
                <div className="grid gap-3 md:grid-cols-4">
                  <Field label={t.tradeGovernance.ruleCodeLabel} showLabel>
                    <Input
                      size="sm"
                      dir="ltr"
                      className="font-mono uppercase"
                      value={rule.code}
                      disabled={isSubmitting}
                      onChange={(e) => {
                        const nextRules = [...policyRules];
                        nextRules[rIdx] = { ...rule, code: e.target.value.toUpperCase() };
                        applyPolicyVisualUpdate(defaultOutcome, nextRules);
                      }}
                    />
                  </Field>
                  <Field label={t.tradeGovernance.ruleOutcomeLabel} showLabel>
                    <Select
                      value={rule.outcome}
                      disabled={isSubmitting}
                      onValueChange={(next) => {
                        const nextRules = [...policyRules];
                        nextRules[rIdx] = { ...rule, outcome: next as PolicyOutcome };
                        applyPolicyVisualUpdate(defaultOutcome, nextRules);
                      }}
                    >
                      <SelectTrigger size="sm" aria-label={t.tradeGovernance.ruleOutcomeLabel}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {POLICY_OUTCOMES.map((out) => (
                          <SelectItem key={out} value={out}>
                            {out}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label={t.tradeGovernance.ruleReasonCodeLabel} showLabel>
                    <Input
                      size="sm"
                      dir="ltr"
                      className="font-mono uppercase"
                      value={rule.reasonCode}
                      disabled={isSubmitting}
                      onChange={(e) => {
                        const nextRules = [...policyRules];
                        nextRules[rIdx] = { ...rule, reasonCode: e.target.value.toUpperCase() };
                        applyPolicyVisualUpdate(defaultOutcome, nextRules);
                      }}
                    />
                  </Field>
                  <div className="flex items-end justify-between gap-2">
                    <Field label={t.tradeGovernance.rulePriorityLabel} showLabel className="flex-1">
                      <Input
                        size="sm"
                        dir="ltr"
                        type="number"
                        className="font-mono tabular-nums"
                        value={rule.priority}
                        disabled={isSubmitting}
                        onChange={(e) => {
                          const nextRules = [...policyRules];
                          nextRules[rIdx] = { ...rule, priority: e.target.value };
                          applyPolicyVisualUpdate(defaultOutcome, nextRules);
                        }}
                      />
                    </Field>
                    {policyRules.length > 1 && (
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        disabled={isSubmitting}
                        onClick={() => {
                          const nextRules = policyRules.filter((_, i) => i !== rIdx);
                          applyPolicyVisualUpdate(defaultOutcome, nextRules);
                        }}
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid gap-2 rounded-md border border-border bg-muted/25 p-2.5 md:grid-cols-3">
                  <Field label={t.tradeGovernance.factKeyLabel} showLabel>
                    <Select
                      value={rule.fact}
                      disabled={isSubmitting}
                      onValueChange={(next) => {
                        const nextRules = [...policyRules];
                        nextRules[rIdx] = { ...rule, fact: next };
                        applyPolicyVisualUpdate(defaultOutcome, nextRules);
                      }}
                    >
                      <SelectTrigger size="sm" aria-label={t.tradeGovernance.factKeyLabel}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {POLICY_FACT_REGISTRY.map((fact) => (
                          <SelectItem key={fact.key} value={fact.key}>
                            {`${fact.key} (${fact.valueType})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label={t.tradeGovernance.operatorLabel} showLabel>
                    <Select
                      value={rule.operator}
                      disabled={isSubmitting}
                      onValueChange={(next) => {
                        const nextRules = [...policyRules];
                        nextRules[rIdx] = { ...rule, operator: next as PolicyOperator };
                        applyPolicyVisualUpdate(defaultOutcome, nextRules);
                      }}
                    >
                      <SelectTrigger size="sm" aria-label={t.tradeGovernance.operatorLabel}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {POLICY_OPERATORS.map((op) => (
                          <SelectItem key={op} value={op}>
                            {op}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label={t.tradeGovernance.expectedValueLabel} showLabel>
                    <Input
                      size="sm"
                      dir="ltr"
                      className="font-mono"
                      value={rule.value}
                      disabled={isSubmitting}
                      onChange={(e) => {
                        const nextRules = [...policyRules];
                        nextRules[rIdx] = { ...rule, value: e.target.value };
                        applyPolicyVisualUpdate(defaultOutcome, nextRules);
                      }}
                    />
                  </Field>
                </div>
              </div>
            ))}
          </div>
        )}

        {builderMode === "visual" && family === "workflow" && (
          <div className="flex flex-col gap-4 rounded-lg border border-border bg-muted/20 p-4">
            <div className="grid gap-3 md:grid-cols-3">
              <Field label={t.tradeGovernance.workflowStatesTitle} showLabel>
                <Input
                  size="sm"
                  dir="ltr"
                  className="font-mono uppercase"
                  value={statesCsv}
                  disabled={isSubmitting}
                  onChange={(e) =>
                    applyWorkflowVisualUpdate(
                      e.target.value.toUpperCase(),
                      initialState,
                      terminalStatesCsv,
                      workflowTransitions,
                    )
                  }
                />
              </Field>
              <Field label={t.tradeGovernance.stateCodeLabel} showLabel>
                <Input
                  size="sm"
                  dir="ltr"
                  className="font-mono uppercase"
                  value={initialState}
                  disabled={isSubmitting}
                  onChange={(e) =>
                    applyWorkflowVisualUpdate(
                      statesCsv,
                      e.target.value.toUpperCase(),
                      terminalStatesCsv,
                      workflowTransitions,
                    )
                  }
                />
              </Field>
              <Field label={t.tradeGovernance.terminalStateLabel} showLabel>
                <Input
                  size="sm"
                  dir="ltr"
                  className="font-mono uppercase"
                  value={terminalStatesCsv}
                  disabled={isSubmitting}
                  onChange={(e) =>
                    applyWorkflowVisualUpdate(
                      statesCsv,
                      initialState,
                      e.target.value.toUpperCase(),
                      workflowTransitions,
                    )
                  }
                />
              </Field>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <span className="text-sm font-semibold text-foreground">
                {t.tradeGovernance.workflowTransitionsTitle}
              </span>
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={isSubmitting}
                onClick={() =>
                  applyWorkflowVisualUpdate(statesCsv, initialState, terminalStatesCsv, [
                    ...workflowTransitions,
                    {
                      code: `TR_0${workflowTransitions.length + 1}`,
                      from: initialState,
                      action: "SUBMIT",
                      to: "CONFIRMED",
                      requiresApproval: false,
                    },
                  ])
                }
              >
                <Plus className="size-3.5" aria-hidden="true" />
                {t.tradeGovernance.addTransitionEdge}
              </Button>
            </div>

            {workflowTransitions.map((tr, tIdx) => (
              <div
                key={tIdx}
                className="grid gap-2.5 rounded-lg border border-border bg-card p-3 md:grid-cols-4"
              >
                <Field label={t.tradeGovernance.fromStateLabel} showLabel>
                  <Input
                    size="sm"
                    dir="ltr"
                    className="font-mono uppercase"
                    value={tr.from}
                    disabled={isSubmitting}
                    onChange={(e) => {
                      const nextTr = [...workflowTransitions];
                      nextTr[tIdx] = { ...tr, from: e.target.value.toUpperCase() };
                      applyWorkflowVisualUpdate(statesCsv, initialState, terminalStatesCsv, nextTr);
                    }}
                  />
                </Field>
                <Field label={t.tradeGovernance.actionVerbLabel} showLabel>
                  <Select
                    value={tr.action}
                    disabled={isSubmitting}
                    onValueChange={(next) => {
                      const nextTr = [...workflowTransitions];
                      nextTr[tIdx] = { ...tr, action: next as WorkflowActionVerb };
                      applyWorkflowVisualUpdate(statesCsv, initialState, terminalStatesCsv, nextTr);
                    }}
                  >
                    <SelectTrigger size="sm" aria-label={t.tradeGovernance.actionVerbLabel}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WORKFLOW_ACTIONS.map((act) => (
                        <SelectItem key={act} value={act}>
                          {act}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={t.tradeGovernance.toStateLabel} showLabel>
                  <Input
                    size="sm"
                    dir="ltr"
                    className="font-mono uppercase"
                    value={tr.to}
                    disabled={isSubmitting}
                    onChange={(e) => {
                      const nextTr = [...workflowTransitions];
                      nextTr[tIdx] = { ...tr, to: e.target.value.toUpperCase() };
                      applyWorkflowVisualUpdate(statesCsv, initialState, terminalStatesCsv, nextTr);
                    }}
                  />
                </Field>
                <Field label={t.tradeGovernance.requiresApprovalLabel} showLabel>
                  <Switch
                    checked={tr.requiresApproval}
                    disabled={isSubmitting}
                    onCheckedChange={(checked) => {
                      const nextTr = [...workflowTransitions];
                      nextTr[tIdx] = { ...tr, requiresApproval: checked };
                      applyWorkflowVisualUpdate(statesCsv, initialState, terminalStatesCsv, nextTr);
                    }}
                  />
                </Field>
              </div>
            ))}
          </div>
        )}

        {/* Synced JSON Payload Controls (Always present for exact contract fidelity) */}
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label={t.tradeGovernance.content}
            hint={t.tradeGovernance.contentHint}
            showLabel
            hintPlacement="tooltip"
            required
          >
            <Textarea
              dir="ltr"
              className="font-mono text-xs"
              placeholder={t.tradeGovernance.content}
              value={values.content}
              rows={8}
              disabled={isSubmitting}
              onChange={(event) =>
                setValues((current) => ({ ...current, content: event.target.value }))
              }
            />
          </Field>
          <Field
            label={t.tradeGovernance.testCases}
            hint={t.tradeGovernance.testCasesHint}
            showLabel
            hintPlacement="tooltip"
            required
          >
            <Textarea
              dir="ltr"
              className="font-mono text-xs"
              placeholder={t.tradeGovernance.testCases}
              value={values.testCases}
              rows={8}
              disabled={isSubmitting}
              onChange={(event) =>
                setValues((current) => ({ ...current, testCases: event.target.value }))
              }
            />
          </Field>
        </div>
      </div>
    </FormModal>
  );
}
