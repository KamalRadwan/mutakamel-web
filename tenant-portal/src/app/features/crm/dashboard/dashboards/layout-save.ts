import type { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { ApiError, newIdempotencyKey } from '../../../../shared/widgets/dashboard/analytics-api';
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

export type SaveLayoutResult = { detail: DashboardDetail & { adjusted: boolean } } | { reload: true } | null;

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
export function placementIdFromPath(source: unknown, sent: readonly { placementId: string }[]): string | null {
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
    super(source.status, source.code, source.details);
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
    (error.code === 'CRM_DASHBOARD_REVISION_CONFLICT' || error.code === 'CRM_DASHBOARD_LAYOUT_STALE')
  );
}

async function pinAdded(dashboardId: string, placementId: string, versionNumber: number): Promise<void> {
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

/**
 * Saves a dashboard layout, using a fresh UUIDv7 idempotency key per attempt and resolving 409 conflicts.
 * The removals and additions made in edit mode are sent here, never before Save.
 */
export async function saveLayoutResolving(
  id: string,
  revision: number,
  items: SaveLayoutItem[],
  confirm: ConfirmDialog,
  plan: SaveEditPlan = { removedPlacementIds: [], adds: [] },
): Promise<SaveLayoutResult> {
  let currentRevision = revision;
  const appliedRemovedIds: string[] = [];
  const idMap = new Map<string, string>();
  const snapshotApplied = (): AppliedStructuralEdits => ({
    removedPlacementIds: [...appliedRemovedIds],
    addedIdMap: Object.fromEntries(idMap),
    revision: currentRevision,
  });

  for (const placementId of plan.removedPlacementIds) {
    currentRevision = (await removePlacement(id, placementId)).dashboardRevision;
    appliedRemovedIds.push(placementId);
  }
  for (const add of plan.adds) {
    const box = items.find((item) => item.placementId === add.tempId);
    try {
      const added = await addPlacement(
        id,
        { widgetId: add.widgetId, ...(box ? { x: box.x, y: box.y, w: box.w, h: box.h } : {}) },
        newIdempotencyKey(),
      );
      idMap.set(add.tempId, added.id);
      currentRevision = added.dashboardRevision;
    } catch (error) {
      if (isLayoutSizeInvalid(error)) {
        throw new LayoutSizeInvalidError(error, snapshotApplied(), add.tempId);
      }
      throw error;
    }
  }

  // A layout save names the box by `placementId`, else by its `items.<n>` path in the body that was sent.
  const sizeErrorOf = (error: ApiError, sent: readonly SaveLayoutItem[]) =>
    new LayoutSizeInvalidError(error, snapshotApplied(), detailString(error, 'placementId') ?? placementIdFromPath(error, sent));

  const mapped = items.map((item) => ({ ...item, placementId: idMap.get(item.placementId) ?? item.placementId }));
  const finish = async (
    saved: DashboardDetail & { adjusted: boolean },
  ): Promise<{ detail: DashboardDetail & { adjusted: boolean } }> => {
    const pins = plan.adds.filter((add) => add.pinnedVersionNumber !== null && idMap.has(add.tempId));
    if (pins.length === 0) return { detail: saved };
    for (const add of pins) {
      try {
        await pinAdded(id, idMap.get(add.tempId)!, add.pinnedVersionNumber!);
      } catch {
        // The widget stays on "follow the active version"; the dashboard still shows it.
      }
    }
    return { detail: { ...(await getDashboard(id)), adjusted: saved.adjusted } };
  };

  try {
    const detail = await saveLayout(id, { revision: currentRevision, breakpointKey: 'desktop', items: mapped }, newIdempotencyKey());
    return await finish(detail);
  } catch (error) {
    if (isLayoutSizeInvalid(error)) {
      throw sizeErrorOf(error, mapped);
    }
    if (!isStaleConflict(error)) throw error;
  }

  const keepMine = await confirm.open();
  if (!keepMine) return { reload: true };

  const latest = await getDashboard(id);
  currentRevision = latest.revision;
  const known = new Set(latest.placements.map((placement) => placement.id));
  const retryItems = mapped.filter((item) => known.has(item.placementId));
  try {
    const detail = await saveLayout(
      id,
      { revision: latest.revision, breakpointKey: 'desktop', items: retryItems },
      newIdempotencyKey(),
    );
    return await finish(detail);
  } catch (error) {
    if (isLayoutSizeInvalid(error)) {
      throw sizeErrorOf(error, retryItems);
    }
    if (isStaleConflict(error)) return { reload: true };
    throw error;
  }
}
