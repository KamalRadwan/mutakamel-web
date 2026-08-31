import {
  ACTIVITY_DESCRIPTION_MAX,
  ACTIVITY_SUBJECT_MAX,
  type Activity,
  type ActivityDirection,
  type ActivityPriority,
  type ActivityTargetApp,
} from "./activities-contract";

export interface ActivityFormValues {
  targetApp: ActivityTargetApp;
  targetType: string;
  targetId: string;
  type: string;
  subject: string;
  description: string;
  direction: "" | ActivityDirection;
  priority: ActivityPriority;
  /** `datetime-local` text; converted to an ISO instant at the boundary. */
  dueAt: string;
  assigneeUserId: string;
}

export const EMPTY_ACTIVITY_FORM: ActivityFormValues = {
  targetApp: "CRM",
  targetType: "LEAD",
  targetId: "",
  type: "TODO",
  subject: "",
  description: "",
  direction: "",
  priority: "NORMAL",
  dueAt: "",
  assigneeUserId: "",
};

export function toActivityForm(activity: Activity): ActivityFormValues {
  const target = activity.targets[0];
  return {
    targetApp: (target?.targetApp ?? "CRM") as ActivityTargetApp,
    targetType: target?.targetType ?? "LEAD",
    targetId: target?.targetId ?? "",
    type: activity.type,
    subject: activity.subject,
    description: activity.description ?? "",
    direction: (activity.direction ?? "") as ActivityFormValues["direction"],
    priority: activity.priority as ActivityPriority,
    dueAt: toLocalInput(activity.dueAt),
    assigneeUserId: activity.assigneeUserId,
  };
}

/** `datetime-local` needs `YYYY-MM-DDTHH:mm` in the viewer's own zone. */
function toLocalInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function requireDueAt(value: string): string {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) throw new Error("ACTIVITY_FORM_DUE_AT");
  return date.toISOString();
}

function requireSubject(value: string): string {
  const subject = value.trim();
  if (subject.length === 0 || subject.length > ACTIVITY_SUBJECT_MAX) {
    throw new Error("ACTIVITY_FORM_SUBJECT");
  }
  return subject;
}

/** `CreateActivityDto`. `target` is required and is what the service authorises against. */
export function buildCreateActivityRequest(
  values: ActivityFormValues,
): Record<string, unknown> {
  if (!values.targetId) throw new Error("ACTIVITY_FORM_TARGET");
  if (!values.assigneeUserId) throw new Error("ACTIVITY_FORM_ASSIGNEE");
  const description = values.description.trim().slice(0, ACTIVITY_DESCRIPTION_MAX);
  return {
    target: { app: values.targetApp, type: values.targetType, id: values.targetId },
    type: values.type,
    subject: requireSubject(values.subject),
    ...(description ? { description } : {}),
    ...(values.direction ? { direction: values.direction } : {}),
    priority: values.priority,
    dueAt: requireDueAt(values.dueAt),
    assigneeUserId: values.assigneeUserId,
  };
}

/**
 * `UpdateActivityDto` — no `target`. An activity's target is fixed at creation,
 * so a form that appeared to move it would be describing a route that does not
 * exist.
 */
export function buildUpdateActivityRequest(
  current: Activity,
  values: ActivityFormValues,
): Record<string, unknown> {
  const request: Record<string, unknown> = {};
  if (values.type !== current.type) request.type = values.type;
  const subject = requireSubject(values.subject);
  if (subject !== current.subject) request.subject = subject;
  const description = values.description.trim().slice(0, ACTIVITY_DESCRIPTION_MAX);
  if (description !== (current.description ?? "")) request.description = description || null;
  if (values.direction !== (current.direction ?? "")) {
    request.direction = values.direction || null;
  }
  if (values.priority !== current.priority) request.priority = values.priority;
  const dueAt = requireDueAt(values.dueAt);
  if (new Date(dueAt).getTime() !== new Date(current.dueAt).getTime()) request.dueAt = dueAt;
  if (values.assigneeUserId && values.assigneeUserId !== current.assigneeUserId) {
    request.assigneeUserId = values.assigneeUserId;
  }
  return request;
}
