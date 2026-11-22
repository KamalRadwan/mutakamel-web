import { buildActorMeSync } from '../../staff/shared/staff.fake';
import type { Me } from '../../staff/shared/staff.model';

/**
 * The actor the operations fakes authorize. Defaults to the staff fake actor;
 * specs set an override to exercise scoped grants (branch-only, none) that the
 * staff fake's preset actors do not cover. Deleted with the fakes in Phase 5.
 */
let override: Me | null = null;

export function fakeActorMe(): Me {
  return override ?? buildActorMeSync();
}

export function setFakeActorOverride(me: Me | null): void {
  override = me;
}
