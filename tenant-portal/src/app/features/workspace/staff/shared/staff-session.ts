import { Service, signal } from '@angular/core';
import { getMe } from './staff.api';
import { FAKE_ACTOR, FakeActor, buildActorMeSync, setFakeActor } from './staff.fake';
import { Me } from './staff.model';

export { FAKE_ACTOR, setFakeActor };
export type { FakeActor };

@Service()
export class StaffSession {
  readonly me = signal<Me | null>(buildActorMeSync());
  /** Load state of the session: pages show a retry state when it is 'failed' and no session is held. */
  readonly state = signal<'pending' | 'ready' | 'failed'>(this.me() ? 'ready' : 'pending');

  get actor(): FakeActor {
    return FAKE_ACTOR;
  }

  setActor(actor: FakeActor): void {
    setFakeActor(actor);
    this.me.set(buildActorMeSync(actor));
  }

  async load(): Promise<Me> {
    this.state.set('pending');
    try {
      const loaded = await getMe();
      this.me.set(loaded);
      this.state.set('ready');
      return loaded;
    } catch (error) {
      this.state.set('failed');
      throw error;
    }
  }

  isOwner(): boolean {
    return Boolean(this.me()?.isTenantOwner);
  }

  isTenantWide(permission: string): boolean {
    const current = this.me();
    if (!current) return false;
    if (current.isTenantOwner) return true;
    return Boolean(current.permissionScopes[permission]?.tenantWide);
  }

  can(permission: string, scope?: { branchId?: string | null; companyId?: string | null }): boolean {
    const current = this.me();
    if (!current) return false;
    if (current.isTenantOwner) return true;
    const entry = current.permissionScopes[permission];
    if (!entry) return false;
    if (entry.tenantWide) return true;
    if (!scope || (!scope.branchId && !scope.companyId)) {
      return entry.branchIds.length > 0 || entry.companyIds.length > 0 || current.permissions.includes(permission);
    }
    if (scope.branchId) {
      return entry.branchIds.includes(scope.branchId);
    }
    if (scope.companyId) {
      return entry.companyIds.includes(scope.companyId);
    }
    return false;
  }
}
