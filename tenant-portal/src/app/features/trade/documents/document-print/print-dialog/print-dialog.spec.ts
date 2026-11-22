import { Component, Injectable, signal, viewChild } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentKind, PrintTemplateOption } from '../../shared/document.model';
import { fakeGetDocument, fakeListDocuments, fakeSetPrintDefaultAssignment } from '../../shared/documents.fake';
import { PrintDialog, type PrintSource } from './print-dialog';

@Injectable()
class EmptyLoader implements TranslocoLoader {
  getTranslation() {
    return of({});
  }
}

@Component({
  imports: [PrintDialog],
  template: `<app-print-dialog [kind]="kind()" [documentId]="documentId()" [source]="source()" />`,
})
class Host {
  readonly dialog = viewChild.required(PrintDialog);
  readonly kind = signal<DocumentKind>('purchase-order');
  readonly documentId = signal('');
  readonly source = signal<PrintSource>({ sourceVersion: 1 });
}

/** Protected members used by the template; read through a narrow view. */
interface DialogInternals {
  choices(): { id: string; kind: string }[];
  selectedChoice(): string | null;
  templates(): PrintTemplateOption[];
  canPrint(): boolean;
  phase(): string;
  templateErrorKey(): string | null;
  selectChoice(id: string): void;
  print(): Promise<void>;
  loadTemplates(): Promise<void>;
  onModalClosed(): void;
}

async function settle<T>(promise: Promise<T>): Promise<T> {
  await vi.advanceTimersByTimeAsync(2000);
  return promise;
}

describe('PrintDialog default template assignment', () => {
  let fixture: ComponentFixture<Host>;
  let dialog: DialogInternals;

  beforeEach(async () => {
    vi.useFakeTimers();
    localStorage.removeItem('lang');
    document.documentElement.lang = 'en';

    TestBed.configureTestingModule({
      imports: [Host],
      providers: [
        provideTransloco({
          config: { availableLangs: ['en', 'ar'], defaultLang: 'en', reRenderOnLangChange: true },
          loader: EmptyLoader,
        }),
      ],
    });

    const page = await settle(fakeListDocuments('purchase-order', { page: 1, limit: 50 }));
    const row = page.items.find((item) => item.lifecycleStatus === 'CONFIRMED');
    expect(row).toBeDefined();
    const doc = await settle(fakeGetDocument('purchase-order', row!.id));

    fixture = TestBed.createComponent(Host);
    fixture.componentInstance.documentId.set(doc.id);
    fixture.componentInstance.source.set({ sourceVersion: doc.version });
    fixture.detectChanges();
    dialog = fixture.componentInstance.dialog() as unknown as DialogInternals;
    await settle(dialog.loadTemplates());
  });

  afterEach(() => {
    dialog.onModalClosed();
    fixture.destroy();
    fakeSetPrintDefaultAssignment('purchase-order', true);
    vi.useRealTimers();
    localStorage.removeItem('lang');
  });

  it('lists "Default template" first and selects it, so Print is ready without picking a template', () => {
    expect(dialog.choices()[0]).toEqual({ id: 'default', kind: 'default' });
    expect(dialog.templates().length).toBeGreaterThan(0);
    expect(dialog.selectedChoice()).toBe('default');
    expect(dialog.canPrint()).toBe(true);
  });

  it('prints with the default assignment (no templateVersionId) and starts the render job', async () => {
    const run = dialog.print();
    await vi.advanceTimersByTimeAsync(500);
    expect(dialog.templateErrorKey()).toBeNull();
    expect(dialog.phase()).toBe('running');
    dialog.onModalClosed();
    await settle(run);
  });

  it('shows the no-default message when the document type has no default assignment', async () => {
    fakeSetPrintDefaultAssignment('purchase-order', false);
    await settle(dialog.print());
    expect(dialog.templateErrorKey()).toBe('td.errors.noDefaultAssignment');
    expect(dialog.phase()).toBe('idle');
  });

  it('still prints a specific template the user picks when there is no default assignment', async () => {
    fakeSetPrintDefaultAssignment('purchase-order', false);
    const first = dialog.templates()[0];
    dialog.selectChoice(`template:${first.versionId}`);
    const run = dialog.print();
    await vi.advanceTimersByTimeAsync(500);
    expect(dialog.templateErrorKey()).toBeNull();
    expect(dialog.phase()).toBe('running');
    dialog.onModalClosed();
    await settle(run);
  });
});
