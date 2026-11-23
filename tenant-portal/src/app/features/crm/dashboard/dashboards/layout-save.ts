import { ApiError } from '../../../../shared/widgets/dashboard/analytics-api';
import {
  addPlacement,
  getDashboard,
  getVersionBinding,
  previewVersionPolicy,
  removePlacement,
  saveLayout,
  setVersionPolicy,
} from './dashboards.api';
import type { DashboardDetail } from './dashboards.model';
import { detailInt, detailIssues, detailString } from '../shared/api-error-details';
import { retainWriteIntent, writeIntent, type WriteIntent } from '../shared/write-state';

export interface SaveLayoutItem {
  placementId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  zIndex: number;
  isHidden: boolean;
}

/** A widget added in edit mode. It lives only in the browser until Save, under a temporary placement id. */
export interface PendingAdd {
  tempId: string;
  widgetId: string;
  pinnedVersionNumber: number | null;
}

/** The structural changes of one edit session, applied by Save together with the layout. */
export interface SaveEditPlan {
  removedPlacementIds: string[];
  adds: PendingAdd[];
}

export type SaveLayoutResult =
  | { detail: DashboardDetail & { adjusted: boolean } }
  | { reload: true }
  | { conflict: true; revision: number }
  | null;

export interface LayoutSizeInvalidDetails {
  placementId: string | null;
  minW: number | null;
  minH: number | null;
}

export interface AppliedStructuralEdits {
  removedPlacementIds: string[];
  addedIdMap: Record<string, string>;
  revision: number;
}

export function isLayoutSizeInvalid(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    error.status === 422 &&
    error.code === 'CRM_DASHBOARD_LAYOUT_SIZE_INVALID'
  );
}

/** The placement a body-relative `items.<n>.<field>` path points at in the items that were sent, or null. */
export function placementIdFromPath(
  source: unknown,
  sent: readonly { placementId: string }[],
): string | null {
  for (const { path } of detailIssues(source)) {
    const match = /^items\.(\d+)(?:\.|$)/.exec(path);
    const item = match ? sent[Number(match[1])] : undefined;
    if (item) return item.placementId;
  }
  return null;
}

export class LayoutSizeInvalidError extends ApiError {
  readonly sizeDetails: LayoutSizeInvalidDetails;
  readonly applied: AppliedStructuralEdits;

  /**
   * `knownPlacementId` is the box the client sent and wins when given: on an add the backend names the placement it
   * was about to create, which is not on the canvas (the canvas holds the temporary id).
   */
  constructor(source: ApiError, applied: AppliedStructuralEdits, knownPlacementId?: string | null) {
    // { path: ['items.3.w', 'items.3.h'], code: ['min_width', 'min_height'], placementId: ['…'], minW: ['16'], minH: ['10'] }
    const placementId = knownPlacementId ?? detailString(source, 'placementId');
    super(source.status, source.code, source.details, { correlationId: source.correlationId });
    this.sizeDetails = {
      placementId,
      minW: detailInt(source, 'minW'),
      minH: detailInt(source, 'minH'),
    };
    this.applied = applied;
  }
}

/**
 * The dialog is a two-way confirm: the confirm button keeps the user's changes, and the cancel button, Esc and the
 * close control all mean "cancel", which reloads the dashboard. Dismissing must never overwrite the other user's work.
 */
export const conflictDialogTexts = {
  tone: 'warning',
  title: 'dashEdit.conflictTitle',
  text: 'dashEdit.conflictText',
  confirmLabel: 'dashEdit.keepMine',
  cancelLabel: 'dashEdit.reload',
} as const;

function isStaleConflict(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 409 &&
    (error.code === 'CRM_DASHBOARD_REVISION_CONFLICT' ||
      error.code === 'CRM_DASHBOARD_LAYOUT_STALE' ||
      error.code === 'CRM_DASHBOARD_PLACEMENT_VERSION_STALE')
  );
}

async function pinAdded(
  dashboardId: string,
  placementId: string,
  versionNumber: number,
): Promise<void> {
  const binding = await getVersionBinding(dashboardId, placementId);
  const body = {
    versionPolicy: 'PINNED' as const,
    pinnedVersionNumber: versionNumber,
    expectedDashboardRevision: binding.dashboardRevision,
    expectedWidgetRevision: binding.widgetRevision,
    expectedGovernanceRevision: binding.governanceRevision,
  };
  const preview = await previewVersionPolicy(dashboardId, placementId, body);
  await setVersionPolicy(dashboardId, placementId, {
    ...body,
    expectedSelectedVersionNumber: preview.proposed.selectedVersionNumber,
    expectedPlacement: preview.proposed.placement,
  });
}

export class LayoutSaveSession {
  readonly removed = new Set<string>();
  readonly added = new Map<string, string>();
  readonly pinned = new Set<string>();
  readonly pendingPins = new Map<string, number>();
  readonly intents = new Map<string, WriteIntent>();
  revision: number | null = null;
}

/** Structural calls are remembered across a failed Save so retry never recreates an applied placement. */
export async function saveLayoutResolving(
  id: string,
  revision: number,
  items: SaveLayoutItem[],
  confirm: { open(): Promise<boolean> },
  plan: SaveEditPlan = { removedPlacementIds: [], adds: [] },
  session = new LayoutSaveSession(),
): Promise<SaveLayoutResult> {
  session.revision ??= revision;
  const snapshotApplied = (): AppliedStructuralEdits => ({
    removedPlacementIds: [...session.removed],
    addedIdMap: Object.fromEntries(session.added),
    revision: session.revision!,
  });
  const keyed = async <T>(
    action: string,
    body: unknown,
    run: (key: string) => Promise<T>,
  ): Promise<T> => {
    const intent = writeIntent(body, session.intents.get(action));
    session.intents.set(action, intent);
    try {
      return await run(intent.key);
    } catch (error) {
      if (!retainWriteIntent(error)) session.intents.delete(action);
      throw error;
    }
  };
  let sent = items;
  try {
    for (const placementId of plan.removedPlacementIds) {
      if (session.removed.has(placementId)) continue;
      session.revision = (await removePlacement(id, placementId)).dashboardRevision;
      session.removed.add(placementId);
      session.pendingPins.delete(placementId);
    }
    for (const add of plan.adds) {
      if (session.added.has(add.tempId)) continue;
      const box = items.find((item) => item.placementId === add.tempId);
      const body = {
        widgetId: add.widgetId,
        ...(box ? { x: box.x, y: box.y, w: box.w, h: box.h } : {}),
      };
      try {
        const added = await keyed(`add:${add.tempId}`, body, (key) => addPlacement(id, body, key));
        session.added.set(add.tempId, added.id);
        if (add.pinnedVersionNumber !== null)
          session.pendingPins.set(added.id, add.pinnedVersionNumber);
        session.revision = added.dashboardRevision;
      } catch (error) {
        if (isLayoutSizeInvalid(error))
          throw new LayoutSizeInvalidError(error, snapshotApplied(), add.tempId);
        throw error;
      }
    }
    sent = items.map((item) => ({
      ...item,
      placementId: session.added.get(item.placementId) ?? item.placementId,
    }));
    const body = { revision: session.revision, breakpointKey: 'desktop' as const, items: sent };
    const saved = await keyed('layout', body, (key) => saveLayout(id, body, key));
    session.revision = saved.revision;
    for (const [placementId, versionNumber] of session.pendingPins) {
      if (session.pinned.has(placementId)) continue;
      await pinAdded(id, placementId, versionNumber);
      session.pinned.add(placementId);
    }
    return {
      detail: session.pinned.size
        ? { ...(await getDashboard(id)), adjusted: saved.adjusted }
        : saved,
    };
  } catch (error) {
    if (error instanceof LayoutSizeInvalidError) throw error;
    if (isLayoutSizeInvalid(error)) {
      throw new LayoutSizeInvalidError(
        error,
        snapshotApplied(),
        detailString(error, 'placementId') ?? placementIdFromPath(error, sent),
      );
    }
    if (!isStaleConflict(error)) throw error;
    if (!(await confirm.open())) return { reload: true };
    const latest = await getDashboard(id);
    session.revision = latest.revision;
    // Keep the canvas and pending edits. A second Save is a new action with the re-read revision.
    session.intents.delete('layout');
    return { conflict: true, revision: latest.revision };
  }
}
