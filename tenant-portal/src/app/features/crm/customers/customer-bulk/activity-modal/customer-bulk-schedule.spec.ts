import { describe, expect, it } from 'vitest';
import { SelectedCustomerRow } from '../customer-bulk.model';
import {
  computeCustomerBatchActivitySchedule,
  fromWireCustomerActivitySchedule,
  parseCustomerBulkActivitySchedule,
  roundUpTo15Minutes,
  toWireCustomerActivitySchedule,
} from './customer-bulk-schedule';

const OWNER_NAMES = new Map<string, string>([
  ['u1', 'Kamal Radwan'],
  ['u2', 'Mona Adel'],
  ['u3', 'Omar Fathy'],
]);

const ROWS: SelectedCustomerRow[] = [
  {
    id: 'c-1',
    displayName: 'Acme Corp',
    ownerUserId: 'u2',
    status: 'ACTIVE_CUSTOMER',
    updatedAt: '2026-11-20T10:00:00.000Z',
  },
  {
    id: 'c-2',
    displayName: 'Beta Trading',
    ownerUserId: 'u3',
    status: 'PROSPECT',
    updatedAt: '2026-11-20T10:00:00.000Z',
  },
  {
    id: 'c-3',
    displayName: 'Delta Imports',
    ownerUserId: 'u2',
    status: 'PROSPECT',
    updatedAt: '2026-11-20T10:00:00.000Z',
  },
  {
    id: 'c-4',
    displayName: 'Unassigned LLC',
    ownerUserId: null,
    status: 'INACTIVE',
    updatedAt: '2026-11-20T10:00:00.000Z',
  },
];

const START = new Date(2026, 10, 21, 10, 0, 0, 0);

describe('customer-bulk-schedule', () => {
  it('rounds start time up to the next 15-minute boundary', () => {
    const exactlyTen = new Date(2026, 10, 21, 10, 0, 0, 0);
    expect(roundUpTo15Minutes(exactlyTen).getMinutes()).toBe(15);

    const tenZeroSeven = new Date(2026, 10, 21, 10, 7, 30, 0);
    expect(roundUpTo15Minutes(tenZeroSeven).getMinutes()).toBe(15);

    const tenTwentyTwo = new Date(2026, 10, 21, 10, 22, 0, 0);
    expect(roundUpTo15Minutes(tenTwentyTwo).getMinutes()).toBe(30);
  });

  it('spaces activities per customer owner when mode is owner and spacePerAssignee is true', () => {
    const result = computeCustomerBatchActivitySchedule({
      rows: ROWS,
      start: START,
      gapMinutes: 15,
      durationMinutes: 30,
      order: 'table',
      assigneeMode: 'owner',
      chosenAssigneeId: '',
      spacePerAssignee: true,
      currentUserId: 'u1',
      currentUserName: 'Kamal Radwan',
      ownerNames: OWNER_NAMES,
    });

    expect(result.noOwnerCount).toBe(1);
    expect(result.items.map((item) => item.row.id)).toEqual(['c-1', 'c-2', 'c-3', 'c-4']);
    expect(result.items[0].assigneeUserId).toBe('u2');
    expect(result.items[0].dueDate.getTime()).toBe(START.getTime());
    expect(result.items[0].endDate?.getTime()).toBe(START.getTime() + 30 * 60_000);
    // u3's first activity starts at START
    expect(result.items[1].assigneeUserId).toBe('u3');
    expect(result.items[1].dueDate.getTime()).toBe(START.getTime());
    // u2's second activity advances by gapMinutes
    expect(result.items[2].assigneeUserId).toBe('u2');
    expect(result.items[2].dueDate.getTime()).toBe(START.getTime() + 15 * 60_000);
    // ownerless customer falls back to current user u1 at START
    expect(result.items[3].assigneeUserId).toBe('u1');
    expect(result.items[3].dueDate.getTime()).toBe(START.getTime());
  });

  it('stacks sequentially in table order when spacePerAssignee is false', () => {
    const result = computeCustomerBatchActivitySchedule({
      rows: ROWS,
      start: START,
      gapMinutes: 10,
      durationMinutes: null,
      order: 'table',
      assigneeMode: 'owner',
      chosenAssigneeId: '',
      spacePerAssignee: false,
      currentUserId: 'u1',
      currentUserName: 'Kamal Radwan',
      ownerNames: OWNER_NAMES,
    });

    expect(result.items.map((item) => (item.dueDate.getTime() - START.getTime()) / 60_000)).toEqual([0, 10, 20, 30]);
    expect(result.items.every((item) => item.endsAt === null)).toBe(true);
  });

  it('groups by assignee name when order is owner', () => {
    const result = computeCustomerBatchActivitySchedule({
      rows: ROWS,
      start: START,
      gapMinutes: 15,
      durationMinutes: null,
      order: 'owner',
      assigneeMode: 'owner',
      chosenAssigneeId: '',
      spacePerAssignee: true,
      currentUserId: 'u1',
      currentUserName: 'Kamal Radwan',
      ownerNames: OWNER_NAMES,
    });

    // Kamal (u1: c-4), Mona (u2: c-1, c-3), Omar (u3: c-2)
    expect(result.items.map((item) => item.row.id)).toEqual(['c-4', 'c-1', 'c-3', 'c-2']);
  });

  it('assigns all activities to current user in me mode sequentially', () => {
    const result = computeCustomerBatchActivitySchedule({
      rows: ROWS,
      start: START,
      gapMinutes: 20,
      durationMinutes: 45,
      order: 'table',
      assigneeMode: 'me',
      chosenAssigneeId: 'u3',
      spacePerAssignee: true,
      currentUserId: 'u1',
      currentUserName: 'Kamal Radwan',
      ownerNames: OWNER_NAMES,
    });

    expect(result.items.every((item) => item.assigneeUserId === 'u1')).toBe(true);
    expect(result.items.map((item) => (item.dueDate.getTime() - START.getTime()) / 60_000)).toEqual([0, 20, 40, 60]);
  });

  it('assigns all activities to chosen user in other mode sequentially', () => {
    const result = computeCustomerBatchActivitySchedule({
      rows: ROWS,
      start: START,
      gapMinutes: 5,
      durationMinutes: null,
      order: 'table',
      assigneeMode: 'other',
      chosenAssigneeId: 'u3',
      spacePerAssignee: false,
      currentUserId: 'u1',
      currentUserName: 'Kamal Radwan',
      ownerNames: OWNER_NAMES,
    });

    expect(result.items.every((item) => item.assigneeUserId === 'u3')).toBe(true);
    expect(result.items.map((item) => (item.dueDate.getTime() - START.getTime()) / 60_000)).toEqual([0, 5, 10, 15]);
  });

  it('serializes and strictly validates wire schedule.assignee and uppercase order', () => {
    const ownerWire = toWireCustomerActivitySchedule({
      startAt: START.toISOString(),
      gapMinutes: 15,
      order: 'owner',
      assigneeMode: 'owner',
      chosenAssigneeId: '',
      spacePerAssignee: true,
    });
    expect(ownerWire.order).toBe('OWNER');
    expect(ownerWire.assignee).toEqual({ mode: 'LEAD_OWNER' });
    expect(parseCustomerBulkActivitySchedule(ownerWire)).toEqual(ownerWire);
    expect(fromWireCustomerActivitySchedule(ownerWire)).toEqual({
      order: 'owner',
      assigneeMode: 'owner',
      chosenAssigneeId: '',
    });

    const userWire = toWireCustomerActivitySchedule({
      startAt: START.toISOString(),
      gapMinutes: 10,
      order: 'table',
      assigneeMode: 'other',
      chosenAssigneeId: 'u3',
      spacePerAssignee: true,
    });
    expect(userWire.assignee).toEqual({ mode: 'USER', userId: 'u3' });
    expect(userWire.spacePerAssignee).toBe(false);
    expect(parseCustomerBulkActivitySchedule(userWire)).toEqual(userWire);

    // Rejects legacy Leads flat assignee shape and lowercase order.
    expect(
      parseCustomerBulkActivitySchedule({
        startAt: START.toISOString(),
        gapMinutes: 15,
        order: 'TABLE',
        assigneeMode: 'ME',
        spacePerAssignee: false,
      }),
    ).toBeNull();
    expect(
      parseCustomerBulkActivitySchedule({
        startAt: START.toISOString(),
        gapMinutes: 15,
        order: 'table',
        assignee: { mode: 'ME' },
        spacePerAssignee: false,
      }),
    ).toBeNull();
  });
});
