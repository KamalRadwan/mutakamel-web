import { describe, expect, it } from 'vitest';
import { SelectedRow } from '../lead-bulk.model';
import {
  buildBulkActivitySchedule,
  computeBatchActivitySchedule,
  fromBulkActivitySchedule,
  parseBulkActivitySchedule,
} from './bulk-schedule';

const OWNERS = new Map<string, string>([
  ['u1', 'Kamal Radwan'],
  ['u2', 'Mona Adel'],
  ['u3', 'Omar Fathy'],
]);

function row(id: string, ownerUserId: string | null): SelectedRow {
  return {
    id,
    displayName: `Lead ${id}`,
    ownerUserId,
    stageId: 'stage-new',
    stageFlag: 'NEW',
    status: 'OPEN',
  };
}

describe('computeBatchActivitySchedule', () => {
  const start = new Date('2026-11-22T09:00:00.000Z');

  it('spaces sequentially in table order when spacePerAssignee is false', () => {
    const result = computeBatchActivitySchedule({
      rows: [row('lead-1', 'u2'), row('lead-2', 'u3'), row('lead-3', 'u2')],
      start,
      gapMinutes: 15,
      durationMinutes: 30,
      order: 'table',
      assigneeMode: 'owner',
      chosenAssigneeId: '',
      spacePerAssignee: false,
      currentUserId: 'u1',
      currentUserName: 'Kamal Radwan',
      ownerNames: OWNERS,
    });

    expect(result.items.map((item) => item.row.id)).toEqual(['lead-1', 'lead-2', 'lead-3']);
    expect(result.items.map((item) => item.assigneeUserId)).toEqual(['u2', 'u3', 'u2']);
    expect(result.items.map((item) => item.dueAt)).toEqual([
      '2026-11-22T09:00:00.000Z',
      '2026-11-22T09:15:00.000Z',
      '2026-11-22T09:30:00.000Z',
    ]);
    expect(result.items.map((item) => item.endsAt)).toEqual([
      '2026-11-22T09:30:00.000Z',
      '2026-11-22T09:45:00.000Z',
      '2026-11-22T10:00:00.000Z',
    ]);
    expect(result.firstStart?.toISOString()).toBe('2026-11-22T09:00:00.000Z');
    expect(result.lastStart?.toISOString()).toBe('2026-11-22T09:30:00.000Z');
    expect(result.lastMoment?.toISOString()).toBe('2026-11-22T10:00:00.000Z');
    expect(result.noOwnerCount).toBe(0);
  });

  it('spaces independently per assignee while keeping table order', () => {
    const result = computeBatchActivitySchedule({
      rows: [row('lead-1', 'u2'), row('lead-2', 'u3'), row('lead-3', 'u2'), row('lead-4', 'u3')],
      start,
      gapMinutes: 20,
      durationMinutes: null,
      order: 'table',
      assigneeMode: 'owner',
      chosenAssigneeId: '',
      spacePerAssignee: true,
      currentUserId: 'u1',
      currentUserName: 'Kamal Radwan',
      ownerNames: OWNERS,
    });

    expect(result.items.map((item) => item.row.id)).toEqual(['lead-1', 'lead-2', 'lead-3', 'lead-4']);
    expect(result.items.map((item) => item.dueAt)).toEqual([
      '2026-11-22T09:00:00.000Z',
      '2026-11-22T09:00:00.000Z',
      '2026-11-22T09:20:00.000Z',
      '2026-11-22T09:20:00.000Z',
    ]);
    expect(result.items.every((item) => item.endsAt === null)).toBe(true);
    expect(result.firstStart?.toISOString()).toBe('2026-11-22T09:00:00.000Z');
    expect(result.lastStart?.toISOString()).toBe('2026-11-22T09:20:00.000Z');
  });

  it('sorts stably by owner display name when order is owner', () => {
    const result = computeBatchActivitySchedule({
      rows: [row('lead-1', 'u3'), row('lead-2', 'u2'), row('lead-3', 'u3'), row('lead-4', 'u1')],
      start,
      gapMinutes: 10,
      durationMinutes: 15,
      order: 'owner',
      assigneeMode: 'owner',
      chosenAssigneeId: '',
      spacePerAssignee: true,
      currentUserId: 'u1',
      currentUserName: 'Kamal Radwan',
      ownerNames: OWNERS,
    });

    expect(result.items.map((item) => item.row.id)).toEqual(['lead-4', 'lead-2', 'lead-1', 'lead-3']);
    expect(result.items.map((item) => item.dueAt)).toEqual([
      '2026-11-22T09:00:00.000Z',
      '2026-11-22T09:00:00.000Z',
      '2026-11-22T09:00:00.000Z',
      '2026-11-22T09:10:00.000Z',
    ]);
  });

  it('falls back unassigned leads to currentUserId and counts noOwnerCount', () => {
    const result = computeBatchActivitySchedule({
      rows: [row('lead-1', null), row('lead-2', 'u1'), row('lead-3', null)],
      start,
      gapMinutes: 15,
      durationMinutes: null,
      order: 'table',
      assigneeMode: 'owner',
      chosenAssigneeId: '',
      spacePerAssignee: true,
      currentUserId: 'u1',
      currentUserName: 'Kamal Radwan',
      ownerNames: OWNERS,
    });

    expect(result.noOwnerCount).toBe(2);
    expect(result.items.map((item) => item.assigneeUserId)).toEqual(['u1', 'u1', 'u1']);
    expect(result.items.map((item) => item.dueAt)).toEqual([
      '2026-11-22T09:00:00.000Z',
      '2026-11-22T09:15:00.000Z',
      '2026-11-22T09:30:00.000Z',
    ]);
  });

  it('assigns all activities to me or chosen assignee regardless of spacePerAssignee', () => {
    const meResult = computeBatchActivitySchedule({
      rows: [row('lead-1', 'u2'), row('lead-2', 'u3')],
      start,
      gapMinutes: 10,
      durationMinutes: null,
      order: 'table',
      assigneeMode: 'me',
      chosenAssigneeId: 'u3',
      spacePerAssignee: true,
      currentUserId: 'u1',
      currentUserName: 'Kamal Radwan',
      ownerNames: OWNERS,
    });

    expect(meResult.items.map((item) => item.assigneeUserId)).toEqual(['u1', 'u1']);
    expect(meResult.items.map((item) => item.dueAt)).toEqual([
      '2026-11-22T09:00:00.000Z',
      '2026-11-22T09:10:00.000Z',
    ]);

    const otherResult = computeBatchActivitySchedule({
      rows: [row('lead-1', 'u1'), row('lead-2', 'u2')],
      start,
      gapMinutes: 10,
      durationMinutes: null,
      order: 'table',
      assigneeMode: 'other',
      chosenAssigneeId: 'u3',
      spacePerAssignee: true,
      currentUserId: 'u1',
      currentUserName: 'Kamal Radwan',
      ownerNames: OWNERS,
    });

    expect(otherResult.items.map((item) => item.assigneeUserId)).toEqual(['u3', 'u3']);
    expect(otherResult.items.map((item) => item.dueAt)).toEqual([
      '2026-11-22T09:00:00.000Z',
      '2026-11-22T09:10:00.000Z',
    ]);
  });

  it('detects runsPastMidnight and handles empty rows', () => {
    const lateStart = new Date(2026, 10, 22, 23, 50, 0, 0);
    const midnightResult = computeBatchActivitySchedule({
      rows: [row('lead-1', 'u1'), row('lead-2', 'u1')],
      start: lateStart,
      gapMinutes: 15,
      durationMinutes: null,
      order: 'table',
      assigneeMode: 'me',
      chosenAssigneeId: '',
      spacePerAssignee: false,
      currentUserId: 'u1',
      currentUserName: 'Kamal Radwan',
      ownerNames: OWNERS,
    });
    expect(midnightResult.runsPastMidnight).toBe(true);

    const emptyResult = computeBatchActivitySchedule({
      rows: [],
      start,
      gapMinutes: 15,
      durationMinutes: 30,
      order: 'table',
      assigneeMode: 'owner',
      chosenAssigneeId: '',
      spacePerAssignee: true,
      currentUserId: 'u1',
      currentUserName: 'Kamal Radwan',
      ownerNames: OWNERS,
    });
    expect(emptyResult).toEqual({
      items: [],
      firstStart: null,
      lastStart: null,
      lastMoment: null,
      runsPastMidnight: false,
      noOwnerCount: 0,
    });
  });
});

describe('buildBulkActivitySchedule (backend CREATE_ACTIVITY schedule)', () => {
  const base = { start: new Date('2026-11-22T09:00:00.000Z'), gapMinutes: 15, chosenAssigneeId: 'u3', spacePerAssignee: true };

  it('sends schedule.assignee.mode LEAD_OWNER and uppercase order for the owner mode', () => {
    expect(buildBulkActivitySchedule({ ...base, order: 'owner', assigneeMode: 'owner' })).toEqual({
      startAt: '2026-11-22T09:00:00.000Z',
      gapMinutes: 15,
      order: 'OWNER',
      assignee: { mode: 'LEAD_OWNER' },
      spacePerAssignee: true,
    });
  });

  it('sends ME without userId and forces spacePerAssignee false', () => {
    const body = buildBulkActivitySchedule({ ...base, order: 'table', assigneeMode: 'me' });
    expect(body.assignee).toEqual({ mode: 'ME' });
    expect(body.order).toBe('TABLE');
    expect(body.spacePerAssignee).toBe(false);
    expect(body).not.toHaveProperty('assigneeMode');
  });

  it('sends USER with the chosen userId', () => {
    const body = buildBulkActivitySchedule({ ...base, order: 'table', assigneeMode: 'other' });
    expect(body.assignee).toEqual({ mode: 'USER', userId: 'u3' });
    expect(Object.keys(body).sort()).toEqual(['assignee', 'gapMinutes', 'order', 'spacePerAssignee', 'startAt']);
  });

  it('round-trips through the strict parser and back to UI enums', () => {
    const body = buildBulkActivitySchedule({ ...base, order: 'owner', assigneeMode: 'other' });
    const parsed = parseBulkActivitySchedule(body);
    expect(parsed).toEqual(body);
    expect(fromBulkActivitySchedule(parsed!)).toEqual({ order: 'owner', assigneeMode: 'other', chosenAssigneeId: 'u3' });
  });

  it('rejects the old flat assigneeMode shape', () => {
    expect(
      parseBulkActivitySchedule({
        startAt: '2026-11-22T09:00:00.000Z',
        gapMinutes: 15,
        order: 'table',
        assigneeMode: 'other',
        assigneeUserId: 'u3',
        spacePerAssignee: false,
      }),
    ).toBeNull();
    expect(
      parseBulkActivitySchedule({
        startAt: '2026-11-22T09:00:00.000Z',
        gapMinutes: 15,
        order: 'TABLE',
        assignee: { mode: 'LEAD_OWNER' },
        assigneeMode: 'owner',
        spacePerAssignee: true,
      }),
    ).toBeNull();
  });
});
