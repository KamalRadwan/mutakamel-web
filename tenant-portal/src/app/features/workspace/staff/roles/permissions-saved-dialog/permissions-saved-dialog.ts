import { Component, output, signal, viewChild } from '@angular/core';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerCircleCheck } from '@ng-icons/tabler-icons';
import { Button } from '../../../../../shared/ui/button/button';
import { Modal } from '../../../../../shared/ui/modal/modal';

export interface SavedBranchSummary {
  branchId: string;
  branchName: string;
  chip: string;
}

export interface SavedPermissionsSummary {
  roleId: string;
  roleName: string;
  branches: SavedBranchSummary[];
}

@Component({
  selector: 'app-permissions-saved-dialog',
  imports: [TranslocoPipe, Button, Modal],
  providers: [
    provideTranslocoScope('settings', 'staff', { scope: 'staff-permissions', alias: 'perm' }),
    provideIcons({ tablerCircleCheck }),
  ],
  templateUrl: './permissions-saved-dialog.html',
})
export class PermissionsSavedDialog {
  private readonly modal = viewChild.required(Modal);

  readonly viewPermissions = output<string>();

  protected readonly summary = signal<SavedPermissionsSummary | null>(null);

  open(summary: SavedPermissionsSummary): void {
    this.summary.set(summary);
    this.modal().open();
  }

  protected close(): void {
    this.modal().close();
  }

  protected openViewPermissions(): void {
    const roleId = this.summary()?.roleId;
    this.modal().close();
    if (roleId) {
      this.viewPermissions.emit(roleId);
    }
  }
}
