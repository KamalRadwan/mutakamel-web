import { Injectable } from '@angular/core';

import {
  FAKE_BRANCHES,
  FAKE_PEOPLE,
  FAKE_TEAMS,
  type FakeBranch,
  type FakePerson,
  type FakeTeam,
} from './fake/fake-org';
import { FAKE_NOW } from './analytics-api';

export type OrgBranch = FakeBranch;
export type OrgTeam = FakeTeam;
export type OrgUser = FakePerson;

/**
 * Organisation directory and clock for the dashboard-style features. Components read through this API
 * and never import the fake data modules; the real HTTP implementation replaces the fake source here.
 * The synchronous snapshots serve templates and computed signals; the list/get methods are the async
 * contract for callers that load on demand.
 */
@Injectable({ providedIn: 'root' })
export class OrgApi {
  readonly branches: readonly OrgBranch[] = FAKE_BRANCHES;
  readonly teams: readonly OrgTeam[] = FAKE_TEAMS;
  readonly users: readonly OrgUser[] = FAKE_PEOPLE;

  listBranches(): Promise<readonly OrgBranch[]> {
    return Promise.resolve(this.branches);
  }

  listTeams(branchId?: string): Promise<readonly OrgTeam[]> {
    return Promise.resolve(branchId ? this.teams.filter((t) => t.branchId === branchId) : this.teams);
  }

  listUsers(branchId?: string): Promise<readonly OrgUser[]> {
    return Promise.resolve(branchId ? this.users.filter((u) => u.branchId === branchId) : this.users);
  }

  getUser(id: string): Promise<OrgUser | null> {
    return Promise.resolve(this.users.find((u) => u.id === id) ?? null);
  }

  /** Current instant as an ISO string. Fake mode returns the fixed FAKE_NOW. */
  now(): string {
    return FAKE_NOW;
  }
}
