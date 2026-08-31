"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { readCrmBody } from "@/lib/api/envelope";
import { normalizeApiError } from "@/lib/api/errors";
import {
  ONBOARDING_PROBES,
  ONBOARDING_PROBE_RESPONSE_LIMIT_BYTES,
  ONBOARDING_STEPS,
  ONBOARDING_STEP_IDS,
  isZeroDataTenant,
  nextActionableStep,
  parseCatalogueOccupancy,
  type OnboardingStepId,
  type OnboardingStepStatus,
} from "../onboarding-contract";

type ProbeId = keyof typeof ONBOARDING_PROBES;
const PROBE_IDS = Object.keys(ONBOARDING_PROBES) as ProbeId[];

type StepStatuses = Record<OnboardingStepId, OnboardingStepStatus>;

export interface FirstRunChecklist {
  statuses: StepStatuses;
  /** True while any probe is still in flight. */
  isChecking: boolean;
  /**
   * A probe failed for a reason that is not a refusal, so the list is degraded
   * and says so. A 403 is deliberately NOT here: it is a per-step answer, it
   * lands on that step as `unauthorized`, and a second banner saying the same
   * thing would be duplication rather than information.
   */
  degradedSteps: OnboardingStepId[];
  nextStep: OnboardingStepId | null;
  /** The tenant has no company or no branch — nothing else can work yet. */
  isZeroData: boolean;
  /**
   * The owner reading of an empty scope list ("the tenant has none") versus the
   * member reading ("none is granted to you"). Two different sentences.
   */
  isTenantOwner: boolean;
  retry: () => void;
}

type ProbeVerdict = "occupied" | "empty" | "denied" | "failed";

/** One completed probe round, tagged with the probe set it answers. */
interface ProbeOutcome {
  key: string;
  results: Partial<Record<ProbeId, ProbeVerdict>>;
}

const EMPTY_PROBES: Partial<Record<ProbeId, ProbeVerdict>> = {};

function emptyStatuses(): StepStatuses {
  return Object.fromEntries(
    ONBOARDING_STEP_IDS.map((id) => [id, "unchecked" as OnboardingStepStatus]),
  ) as StepStatuses;
}

function holds(permissions: readonly string[], permission: string): boolean {
  return permissions.includes(permission);
}

/**
 * The first-run checklist — MASTER-PLAN 13.23.
 *
 * Company and branch come from `/auth/me`, which the shell already holds, so
 * the zero-data case is answered with no request at all. Only the three CRM
 * catalogues are probed, and each settles on its own: a 403 on lead stages must
 * not blank a checklist whose other five rows are perfectly well known
 * (docs/design/states.md#partial-failure-needs-promiseallsettled).
 */
export function useFirstRunChecklist(): FirstRunChecklist {
  const { user } = useTenantAuth();
  const permissions = useMemo(() => user?.permissions ?? [], [user]);
  // The only state the effect writes, and it is written after the await. The
  // "still checking" flag and the discard of a superseded reply are both
  // derived from whether the stored outcome's key matches the current probe
  // set — no synchronous setState in an effect body, and no epoch counter.
  const [outcome, setOutcome] = useState<ProbeOutcome | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const retry = useCallback(() => setReloadToken((token) => token + 1), []);

  const probeable = useMemo(
    () =>
      PROBE_IDS.filter((id) => {
        const step = ONBOARDING_STEPS.find((candidate) => candidate.id === id);
        return step !== undefined && holds(permissions, step.permission);
      }),
    [permissions],
  );

  const probeKey = `${probeable.join("+")}::${reloadToken}`;

  useEffect(() => {
    if (probeable.length === 0) return;
    const controller = new AbortController();

    void (async () => {
      const settled = await Promise.allSettled(
        probeable.map((id) =>
          readCrmBody(ONBOARDING_PROBES[id], {
            signal: controller.signal,
            cache: "no-store",
            maxResponseBytes: ONBOARDING_PROBE_RESPONSE_LIMIT_BYTES,
          }).then(parseCatalogueOccupancy),
        ),
      );
      if (controller.signal.aborted) return;

      const next: ProbeOutcome["results"] = {};
      probeable.forEach((id, index) => {
        const settledProbe = settled[index];
        if (settledProbe.status === "fulfilled") {
          next[id] = settledProbe.value ? "occupied" : "empty";
          return;
        }
        next[id] =
          normalizeApiError(settledProbe.reason).status === 403 ? "denied" : "failed";
      });
      setOutcome({ key: probeKey, results: next });
    })();

    return () => controller.abort();
  }, [probeKey, probeable]);

  const isCurrent = outcome !== null && outcome.key === probeKey;
  const probeResults = isCurrent ? (outcome as ProbeOutcome).results : EMPTY_PROBES;
  const isChecking = probeable.length > 0 && !isCurrent;

  const statuses = useMemo(() => {
    const next = emptyStatuses();
    const scopeDone = {
      company: (user?.accessibleCompanies.length ?? 0) > 0,
      branch: (user?.accessibleBranches.length ?? 0) > 0,
    };

    for (const step of ONBOARDING_STEPS) {
      // Blocked outranks unauthorized: a branch cannot be created before a
      // company exists no matter who is asking, so naming the missing
      // prerequisite is more useful than naming a permission.
      const prerequisite = step.requires === null ? null : next[step.requires];
      if (prerequisite === "todo" || prerequisite === "blocked") {
        next[step.id] = "blocked";
        continue;
      }
      if (!holds(permissions, step.permission)) {
        next[step.id] = "unauthorized";
        continue;
      }
      if (step.id === "company" || step.id === "branch") {
        next[step.id] = scopeDone[step.id] ? "done" : "todo";
        continue;
      }
      if (step.id === "items") {
        // Deliberately never probed — see onboarding-contract.ts.
        next.items = "unchecked";
        continue;
      }
      const probe = probeResults[step.id as ProbeId];
      if (probe === undefined) {
        next[step.id] = isChecking ? "checking" : "unchecked";
        continue;
      }
      next[step.id] =
        probe === "occupied"
          ? "done"
          : probe === "empty"
            ? "todo"
            : probe === "denied"
              ? "unauthorized"
              : "unchecked";
    }
    return next;
  }, [permissions, probeResults, isChecking, user]);

  const degradedSteps = useMemo(
    () => PROBE_IDS.filter((id) => probeResults[id] === "failed") as OnboardingStepId[],
    [probeResults],
  );

  return {
    statuses,
    isChecking,
    degradedSteps,
    nextStep: nextActionableStep(statuses),
    isZeroData: isZeroDataTenant(statuses),
    isTenantOwner: user?.isTenantOwner ?? false,
    retry,
  };
}
