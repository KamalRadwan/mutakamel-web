import { Component, DestroyRef, ElementRef, effect, inject, input, model, output, viewChild } from '@angular/core';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerAlertTriangle } from '@ng-icons/tabler-icons';
import { Button } from '../button/button';

/** Optimistic concurrency (409) modal offering reload or keep-editing actions. */
@Component({
  selector: 'ui-conflict-dialog',
  imports: [NgIcon, TranslocoPipe, Button],
  providers: [provideIcons({ tablerAlertTriangle })],
  viewProviders: [provideTranslocoScope({ scope: 'record-page', alias: 'recordPage' })],
  templateUrl: './conflict-dialog.html',
})
export class ConflictDialog {
  private static nextId = 0;
  protected readonly titleId = `ui-conflict-title-${++ConflictDialog.nextId}`;
  protected readonly textId = `ui-conflict-text-${ConflictDialog.nextId}`;

  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  private readonly reloadBtn = viewChild<Button, ElementRef<HTMLButtonElement>>('reloadBtn', {
    read: ElementRef,
  });

  readonly open = model(false);
  readonly recordLabel = input<string | null>(null);
  readonly reload = output<void>();
  readonly keepEditing = output<void>();

  constructor() {
    effect(() => {
      const isOpen = this.open();
      const element = this.dialog()?.nativeElement;
      if (!element) return;
      if (isOpen) {
        if (!element.open) {
          element.showModal();
        }
        this.reloadBtn()?.nativeElement.focus();
      } else if (element.open) {
        element.close();
      }
    });

    inject(DestroyRef).onDestroy(() => {
      const element = this.dialog()?.nativeElement;
      if (element?.open) {
        element.close();
      }
    });
  }

  protected choose(action: 'reload' | 'keep'): void {
    const element = this.dialog()?.nativeElement;
    if (element?.open) {
      element.close();
    }
    if (action === 'reload') {
      this.reload.emit();
    } else {
      this.keepEditing.emit();
    }
    this.open.set(false);
  }

  protected onEscape(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const element = this.dialog()?.nativeElement;
    if (element?.open) {
      element.close();
    }
    this.open.set(false);
  }

  protected onNativeClose(): void {
    const element = this.dialog()?.nativeElement;
    if (element && !element.open && this.open()) {
      this.open.set(false);
    }
  }
}
