"use client";

import { useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useAccessMode } from "@/hooks/useAccessMode";
import {
  ACTIVITY_TARGET_APPS,
  type Activity,
  type ActivityTargetApp,
  type ActivityTargetSelection,
  type ActivityType,
} from "../activity-contract";
import { activityToForm, createActivityForm, nextActivityForm } from "../activity-form";
import { buildCreateActivityBody, buildUpdateActivityBody } from "../activity-form-rules";
import {
  activityCreateStatuses,
  canActOnActivity,
  canAssignActivities,
  canCreateActivities,
  isOpenActivityStatus,
  primaryActivityTarget,
  type ActivityAction,
} from "../activity-presentation";
import type { ActivityModalProps, ActivityModalRequest } from "../ActivityModal";
import { useActivityCommands, type ActivityCommandResult } from "./useActivityCommands";
import { useActivityDetail } from "./useActivityDetail";
import { useActivityFormState } from "./useActivityFormState";
import { useActivityOutcome } from "./useActivityOutcome";
import { useRecordActivities } from "./useRecordActivities";

type ModalScreen = "create" | "view" | "edit";

interface ModalMachine {
  screen: ModalScreen;
  /** The activity a view or edit screen is about: the request's snapshot until a newer copy arrives. */
  activity: Activity | null;
  /** Edit opened from the view screen returns there; opened directly, it closes the modal. */
  editFromView: boolean;
}

function initialMachine(request: ActivityModalRequest): ModalMachine {
  return request.kind === "create"
    ? { screen: "create", activity: null, editFromView: false }
    : { screen: request.kind, activity: request.activity, editFromView: false };
}

// What makes two requests the same intent. A caller that rebuilds an identical
// request object on every render must not restart the modal under the user.
function requestKey(request: ActivityModalRequest): string {
  if (request.kind !== "create") return `${request.kind}:${request.activity.id}`;
  const { target, agenda, defaults } = request;
  return ["create", target?.type, target?.id, agenda, defaults?.type, defaults?.start?.getTime()].join(":");
}

/**
 * Which request the modal is showing, and whether it is open.
 *
 * Each new request starts a new generation — the caller keys the surface on it,
 * so every hook inside starts clean — while a close keeps the last request, so
 * the surface fades out showing what it showed rather than an empty shell.
 */
export function useActivityModalSession(request: ActivityModalRequest | null) {
  const key = request ? requestKey(request) : null;
  const [session, setSession] = useState({ generation: 0, key, request });
  if (key !== session.key) {
    setSession({ generation: key === null ? session.generation : session.generation + 1, key, request: request ?? session.request });
  }
  return { generation: session.generation, request: request ?? session.request, open: request !== null };
}

export interface ActivityModalSurfaceInput extends Omit<ActivityModalProps, "request"> {
  request: ActivityModalRequest;
  open: boolean;
}

function newer(fresh: Activity | null, snapshot: Activity | null): Activity | null {
  if (!fresh || !snapshot || fresh.id !== snapshot.id) return snapshot ?? fresh;
  return fresh.version >= snapshot.version ? fresh : snapshot;
}

function isTargetApp(value: string): value is ActivityTargetApp {
  return (ACTIVITY_TARGET_APPS as readonly string[]).includes(value);
}

function activityTargetSelection(activity: Activity | null): ActivityTargetSelection | null {
  if (!activity) return null;
  const target = primaryActivityTarget(activity);
  if (!target || !isTargetApp(target.targetApp)) return null;
  return {
    app: target.targetApp,
    type: target.targetType,
    id: target.targetId,
    label: target.label,
  };
}

/**
 * Why the form on screen cannot be saved, when it cannot. The form then stays
 * readable but locked, and says so: a Save that is simply not there reads as a
 * broken screen.
 */
export type ActivityFormBlock = "readOnly" | "notPermitted" | "terminal" | "gone";

/** The template modal's state machine: create | view | edit, how each was entered, and every action. */
export function useActivityModalState({ request, open, onClose, onChanged }: ActivityModalSurfaceInput) {
  const { user } = useTenantAuth();
  const [machine, setMachine] = useState<ModalMachine>(() => initialMachine(request));
  // Whether the create an unresolved retry belongs to was "save and add another".
  const [addingAnother, setAddingAnother] = useState(false);
  // A create that applied but could not be read. Nothing may be saved again.
  const [applied, setApplied] = useState(false);
  const addAnotherPress = useRef(false);

  // A tenant in a read-only access mode keeps reading its activities and changes none of them.
  const { canMutate } = useAccessMode();
  const commands = useActivityCommands();
  const detail = useActivityDetail(open && machine.activity ? machine.activity.id : null);
  const current = newer(detail.activity, machine.activity);
  // Gone, or out of sight: nothing on it can be changed from here.
  const gone = detail.error?.status === 404;
  const writable = canMutate && !gone;

  const fixedTarget =
    request.kind === "create"
      ? request.target ?? null
      : activityTargetSelection(current ?? request.activity);
  const createForm = useActivityFormState(() => createActivityForm({
    type: request.kind === "create" ? request.defaults?.type : undefined,
    start: request.kind === "create" ? request.defaults?.start : undefined,
    target: fixedTarget,
  }), { mode: "create" });
  const agendaTarget = fixedTarget ?? createForm.values.target;
  const agenda = useRecordActivities(agendaTarget, open);
  const editForm = useActivityFormState(
    () => (request.kind === "edit" ? activityToForm(request.activity) : createActivityForm({})),
    { mode: "edit", activityStatus: current?.status },
  );
  // The copy the edit form was filled from: the base of its diff, and the
  // version its save sends in If-Match, so a save only ever lands on the
  // activity the user was shown.
  const [editBase, setEditBase] = useState<Activity | null>(() => (request.kind === "edit" ? request.activity : null));
  // A newer copy (the detail read answering, or a save made elsewhere) refills
  // a form nobody has touched yet. Once the user has typed, the form keeps its
  // base: Core answers the save with a 409 and their edits are rebased onto
  // the newer copy in front of them, never silently written over it.
  if (
    machine.screen === "edit" && current && editBase && current.id === editBase.id
    && current.version > editBase.version && !editForm.isDirty
  ) {
    setEditBase(current);
    editForm.reset(activityToForm(current));
  }

  function show(activity: Activity) {
    if (activity.id === machine.activity?.id) detail.replace(activity);
    setMachine((state) => (state.activity?.id === activity.id ? { ...state, activity } : state));
  }

  // "row" is any write on an existing activity other than the edit form's save.
  function settle(kind: "create" | "update" | "row", result: ActivityCommandResult, another: boolean) {
    if (result.kind === "applied") {
      setApplied(true);
      agenda.reload();
      // Saved, but unreadable here: the screens behind read it for themselves.
      onChanged(null);
    } else if (result.kind === "reloaded") {
      show(result.activity);
      if (kind === "update") {
        editForm.rebase(activityToForm(result.activity));
        setEditBase(result.activity);
      }
    } else if (result.kind === "saved" && kind === "create") {
      onChanged(result.activity);
      if (!another) {
        onClose();
        return;
      }
      createForm.reset(nextActivityForm(createForm.values));
      agenda.reload();
    } else if (result.kind === "saved") {
      onChanged(result.activity);
      show(result.activity);
      agenda.reload();
      if (kind === "update") setMachine((state) => ({ ...state, screen: "view", activity: result.activity }));
    }
  }

  const outcome = useActivityOutcome(commands, (result) => settle("row", result, false));

  async function submit() {
    // Read before the first await: the press that set it has already returned.
    const another = addAnotherPress.current;
    addAnotherPress.current = false;
    if (machine.screen === "view") {
      if (current) outcome.start("complete", current);
      return;
    }
    if (machine.screen === "create") {
      if (Object.keys(createForm.reveal()).length > 0) return;
      setAddingAnother(another);
      settle("create", await commands.create(buildCreateActivityBody(createForm.values)), another);
      return;
    }
    const base = editBase ?? current;
    if (!base || Object.keys(editForm.reveal()).length > 0) return;
    const body = buildUpdateActivityBody(editForm.values, editForm.seed, base);
    // Nothing changed: there is no request to send, and no success to announce.
    if (Object.keys(body).length === 0) {
      setMachine((state) => ({ ...state, screen: "view" }));
      return;
    }
    settle("update", await commands.update(base, body), false);
  }

  const canCreate = canCreateActivities(user);
  const canUpdate = current !== null && canActOnActivity(user, "update", current);
  const formBlock: ActivityFormBlock | null =
    machine.screen === "view" ? null
      : !canMutate ? "readOnly"
      : machine.screen === "create" ? (canCreate ? null : "notPermitted")
      : gone ? "gone"
      : current && !isOpenActivityStatus(current.status) ? "terminal"
      : canUpdate ? null
      : "notPermitted";

  const actorName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email || null
    : null;

  return {
    open,
    screen: machine.screen,
    editFromView: machine.editFromView,
    current,
    fixedTarget,
    commands,
    detailError: detail.error,
    applied,
    createForm,
    editForm,
    // A refused read is not an empty agenda — 403 is not an empty state — so the strip is left out.
    agenda: agenda.readable && !agenda.denied ? agenda : null,
    outcome,
    actorId: user?.id ?? null,
    actorName,
    createStatuses: activityCreateStatuses(user),
    formBlock,
    can: {
      create: canMutate && canCreate,
      assign: canAssignActivities(user),
      update: writable && canUpdate,
      complete: writable && current !== null && canActOnActivity(user, "complete", current),
      cancel: writable && current !== null && canActOnActivity(user, "cancel", current),
      /** The same admission for any other row the modal lists — the agenda's menus. */
      row: (action: ActivityAction, activity: Activity) => canMutate && canActOnActivity(user, action, activity),
    },
    submit,
    /** "Save and add another" submits the real form, so the focus-the-first-invalid-field rule applies to it too. */
    saveAndAddAnother: (form: HTMLFormElement | null) => {
      addAnotherPress.current = true;
      form?.requestSubmit();
      addAnotherPress.current = false;
    },
    requestClose: () => {
      if (commands.pendingKind) return;
      commands.clearError();
      if (machine.screen === "edit" && machine.editFromView) setMachine((state) => ({ ...state, screen: "view" }));
      else if ((machine.screen === "view" || machine.screen === "edit") && request.kind === "create") setMachine(initialMachine(request));
      else {
        // Closed on an unknown outcome: the screens behind read again, which
        // is what shows whether it landed.
        if (commands.ambiguous) onChanged(null);
        onClose();
      }
    },
    startEdit: () => {
      if (!current) return;
      commands.clearError();
      editForm.reset(activityToForm(current));
      setEditBase(current);
      setMachine((state) => ({ ...state, screen: "edit", editFromView: true }));
    },
    editActivity: (activity: Activity) => {
      commands.clearError();
      editForm.reset(activityToForm(activity));
      setEditBase(activity);
      setMachine({ screen: "edit", activity, editFromView: false });
    },
    startCreate: (type?: ActivityType) => {
      commands.clearError();
      if (type) createForm.setType(type);
      setMachine((state) => ({ ...state, screen: "create", editFromView: false }));
    },
    changeStatus: async (status: "PLANNED" | "IN_PROGRESS") => {
      if (current) settle("row", await commands.setStatus(current, status), false);
    },
    viewActivity: (activity: Activity) => {
      commands.clearError();
      setMachine({ screen: "view", activity, editFromView: false });
    },
    retry: async () => {
      const kind = commands.ambiguous?.kind;
      if (!kind) return;
      settle(kind === "create" || kind === "update" ? kind : "row", await commands.retry(), addingAnother);
    },
    dismissAmbiguous: () => {
      // The user accepts not knowing. Re-reading is what shows them whether it landed.
      commands.dismissAmbiguous();
      agenda.reload();
      detail.reload();
      onChanged(null);
    },
  };
}
