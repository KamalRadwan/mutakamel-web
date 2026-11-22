import { Component, Injectable, viewChild } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RecordBoard } from './record-board';
import { BoardDropRule, BoardLane, BoardMoveEvent } from './record-board.model';

/*
 * A drop is simulated through the board's own drop handler (the drop target directive calls it), so the spec
 * checks what the board shows and emits for each lane drop rule.
 */

@Injectable()
class EmptyLoader implements TranslocoLoader {
  getTranslation() {
    return of({});
  }
}

interface Row {
  id: string;
}

@Component({
  imports: [RecordBoard],
  template: `
    <app-record-board [lanes]="lanes" [itemTemplate]="tpl" [idOf]="idOf" (move)="moves.push($event)" />
    <ng-template #tpl let-row>{{ row.id }}</ng-template>
  `,
})
class Host {
  readonly board = viewChild.required<RecordBoard<Row>>(RecordBoard);
  readonly idOf = (row: Row) => row.id;
  readonly moves: BoardMoveEvent[] = [];
  lanes: BoardLane<Row>[] = [];
}

// Protected members are reached through this view on purpose: the spec drives the board directly.
type Internals = Record<string, any>;

let fixture: ComponentFixture<Host>;
let host: Host;

function lane(id: string, dropRule: BoardDropRule, items: Row[] = []): BoardLane<Row> {
  return { id, label: id, total: items.length, items, hasNext: false, canCreate: false, dropRule };
}

function shownLaneOf(id: string): string | undefined {
  const lanes = (host.board() as unknown as Internals)['displayLanes']() as BoardLane<Row>[];
  return lanes.find((item) => item.items.some((row) => row.id === id))?.id;
}

function drop(recordId: string, from: string, to: string): void {
  const board = host.board() as unknown as Internals;
  const target = (board['displayLanes']() as BoardLane<Row>[]).find((item) => item.id === to)!;
  board['onDropped'](target, { recordId, fromLaneId: from, height: 40 });
  fixture.detectChanges();
}

beforeEach(async () => {
  vi.useFakeTimers();
  TestBed.configureTestingModule({
    providers: [
      provideTransloco({
        config: { availableLangs: ['ar', 'en'], defaultLang: 'en', missingHandler: { logMissingKey: false } },
        loader: EmptyLoader,
      }),
    ],
  });
  fixture = TestBed.createComponent(Host);
  host = fixture.componentInstance;
  host.lanes = [lane('open', 'allow', [{ id: 'r1' }]), lane('next', 'allow'), lane('closed', 'confirm'), lane('locked', 'deny')];
  fixture.detectChanges();
  await vi.advanceTimersByTimeAsync(100);
});

afterEach(() => {
  fixture.destroy();
  TestBed.resetTestingModule();
  vi.useRealTimers();
});

describe('record board: drop rules', () => {
  it("leaves the card in its lane on a 'confirm' drop and asks the host to resolve it", () => {
    drop('r1', 'open', 'closed');

    expect(shownLaneOf('r1')).toBe('open');
    expect(host.moves).toEqual([{ id: 'r1', from: 'open', to: 'closed', needsConfirm: true }]);
  });

  it("shows the card in the target lane once the host confirms with applyMove", () => {
    drop('r1', 'open', 'closed');
    host.board().applyMove('r1', 'open', 'closed');
    fixture.detectChanges();

    expect(shownLaneOf('r1')).toBe('closed');
  });

  it("moves the card at once on an 'allow' drop", () => {
    drop('r1', 'open', 'next');

    expect(shownLaneOf('r1')).toBe('next');
    expect(host.moves).toEqual([{ id: 'r1', from: 'open', to: 'next' }]);
  });

  it("ignores a 'deny' drop", () => {
    drop('r1', 'open', 'locked');

    expect(shownLaneOf('r1')).toBe('open');
    expect(host.moves).toEqual([]);
  });
});
