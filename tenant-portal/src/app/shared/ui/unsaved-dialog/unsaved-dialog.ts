import { Component, DestroyRef, ElementRef, inject, input, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerAlertTriangle } from '@ng-icons/tabler-icons';
import { Button } from '../button/button';

export type UnsavedChoice = 'save' | 'discard' | 'cancel';

/** Three-way confirmation modal shown when leaving an editor with unsaved changes. */
@Component({
  selector: 'ui-unsaved-dialog',
  imports: [NgIcon, Button],
  providers: [provideIcons({ tablerAlertTriangle })],
  templateUrl: './unsaved-dialog.html',
})
export class UnsavedDialog {
  private static nextId = 0;
  protected readonly titleId = `ui-unsaved-title-${++UnsavedDialog.nextId}`;
  protected readonly textId = `ui-unsaved-text-${UnsavedDialog.nextId}`;

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly cancelBtn = viewChild.required<Button, ElementRef<HTMLButtonElement>>('cancelBtn', {
    read: ElementRef,
  });

  readonly title = input('');
  readonly text = input('');
  readonly saveLabel = input('');
  readonly discardLabel = input('');
  readonly cancelLabel = input('');

  private resolver: ((choice: UnsavedChoice) => void) | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.settle('cancel'));
  }

  open(): Promise<UnsavedChoice> {
    this.settle('cancel');
    const element = this.dialog().nativeElement;
    if (!element.open) {
      element.showModal();
    }
    this.cancelBtn().nativeElement.focus();
    return new Promise<UnsavedChoice>((resolve) => {
      this.resolver = resolve;
    });
  }

  protected close(choice: UnsavedChoice): void {
    const element = this.dialog().nativeElement;
    if (element.open) {
      element.close();
    }
    this.settle(choice);
  }

  protected onEscape(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.close('cancel');
  }

  protected onNativeClose(): void {
    if (!this.dialog().nativeElement.open) {
      this.settle('cancel');
    }
  }

  private settle(choice: UnsavedChoice): void {
    const resolve = this.resolver;
    this.resolver = null;
    resolve?.(choice);
  }
}
