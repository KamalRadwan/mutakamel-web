import { Component, input, output, viewChild } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerAlertTriangle } from '@ng-icons/tabler-icons';
import { Button } from '../../../../../shared/ui/button/button';
import { Modal } from '../../../../../shared/ui/modal/modal';

@Component({
  selector: 'app-conflict-dialog',
  imports: [TranslocoPipe, Button, Modal],
  providers: [provideIcons({ tablerAlertTriangle })],
  templateUrl: './conflict-dialog.html',
})
export class ConflictDialog {
  private readonly modal = viewChild.required(Modal);

  readonly title = input('');
  readonly text = input('');
  readonly reloadLabel = input('');
  readonly keepLabel = input('');

  readonly reload = output<void>();
  readonly keep = output<void>();

  private handled = false;

  open(): void {
    this.handled = false;
    this.modal().open();
  }

  close(): void {
    this.handled = true;
    this.modal().close();
  }

  protected chooseReload(): void {
    this.handled = true;
    this.modal().close();
    this.reload.emit();
  }

  protected chooseKeep(): void {
    this.handled = true;
    this.modal().close();
    this.keep.emit();
  }

  protected onModalClosed(): void {
    if (this.handled) {
      this.handled = false;
      return;
    }
    this.keep.emit();
  }
}
