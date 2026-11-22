import { Component, DestroyRef, ElementRef, inject, input, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerAlertTriangle, tablerTrash } from '@ng-icons/tabler-icons';
import { Button } from '../button/button';

export type ConfirmTone = 'danger' | 'warning';

@Component({
  selector: 'ui-confirm-dialog',
  imports: [NgIcon, Button],
  providers: [provideIcons({ tablerTrash, tablerAlertTriangle })],
  templateUrl: './confirm-dialog.html',
})
export class ConfirmDialog {
  private static nextId = 0;
  protected readonly titleId = `ui-confirm-title-${++ConfirmDialog.nextId}`;
  protected readonly textId = `ui-confirm-text-${ConfirmDialog.nextId}`;

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly cancelBtn = viewChild.required<Button, ElementRef<HTMLButtonElement>>('cancelBtn', {
    read: ElementRef,
  });

  readonly title = input('');
  readonly text = input('');
  readonly confirmLabel = input('');
  readonly cancelLabel = input('');
  readonly tone = input<ConfirmTone>('danger');

  private resolver: ((confirmed: boolean) => void) | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.settle(false));
  }

  open(): Promise<boolean> {
    this.settle(false);
    const element = this.dialog().nativeElement;
    if (!element.open) element.showModal();
    this.cancelBtn().nativeElement.focus();
    return new Promise<boolean>((resolve) => {
      this.resolver = resolve;
    });
  }

  protected close(confirmed: boolean) {
    const element = this.dialog().nativeElement;
    if (element.open) element.close();
    this.settle(confirmed);
  }

  protected onNativeClose() {
    if (!this.dialog().nativeElement.open) this.settle(false);
  }

  private settle(confirmed: boolean) {
    const resolve = this.resolver;
    this.resolver = null;
    resolve?.(confirmed);
  }
}
