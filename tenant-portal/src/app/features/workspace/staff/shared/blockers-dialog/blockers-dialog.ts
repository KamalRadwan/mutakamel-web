import { Component, DestroyRef, computed, inject, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerAlertTriangle } from '@ng-icons/tabler-icons';
import { Button } from '../../../../../shared/ui/button/button';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { BlockerLink, BlockersDialogOptions } from '../staff.model';

const BLOCKER_KEYS: Readonly<Record<string, string>> = {
  'company has branches': 'staff.blockers.companyHasBranches',
  'company has active branches': 'staff.blockers.companyHasActiveBranches',
  'company has placed users': 'staff.blockers.companyHasPlacedUsers',
  'company has team memberships': 'staff.blockers.companyHasTeamMemberships',
  'company has active taxes': 'staff.blockers.companyHasActiveTaxes',
  'branch has departments': 'staff.blockers.branchHasDepartments',
  'branch has active departments': 'staff.blockers.branchHasActiveDepartments',
  'branch has placed users': 'staff.blockers.branchHasPlacedUsers',
  'branch has team memberships': 'staff.blockers.branchHasTeamMemberships',
  'branch has references; deactivate the branch instead': 'staff.blockers.branchHasReferences',
  'branch reference checks are unavailable; deactivate the branch instead': 'staff.blockers.branchReferenceChecksUnavailable',
  'department has teams': 'staff.blockers.departmentHasTeams',
  'department has active teams': 'staff.blockers.departmentHasActiveTeams',
  'department has placed users': 'staff.blockers.departmentHasPlacedUsers',
  'department has team memberships': 'staff.blockers.departmentHasTeamMemberships',
  'team has placed users': 'staff.blockers.teamHasPlacedUsers',
  'team has memberships': 'staff.blockers.teamHasMemberships',
};

interface BlockerRow {
  phrase: string;
  text: string;
  link: BlockerLink | null;
}

@Component({
  selector: 'app-blockers-dialog',
  imports: [TranslocoPipe, Button, Modal],
  providers: [provideIcons({ tablerAlertTriangle })],
  templateUrl: './blockers-dialog.html',
})
export class BlockersDialog {
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly modal = viewChild.required(Modal);

  protected readonly state = signal<BlockersDialogOptions | null>(null);
  protected readonly running = signal(false);

  private resolver: (() => void) | null = null;

  protected readonly modalTitle = computed(() => {
    this.i18n();
    return this.state()?.title || this.transloco.translate('staff.blockers.title');
  });

  protected readonly rows = computed<BlockerRow[]>(() => {
    this.i18n();
    const current = this.state();
    if (!current) return [];
    return current.blockers.map((phrase) => {
      const key = BLOCKER_KEYS[phrase];
      const text = key ? this.transloco.translate(key) : phrase;
      return {
        phrase,
        text,
        link: current.links?.[phrase] ?? null,
      };
    });
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.settle());
  }

  open(options: BlockersDialogOptions): Promise<void> {
    this.settle();
    this.running.set(false);
    this.state.set(options);
    this.modal().open();
    return new Promise<void>((resolve) => {
      this.resolver = resolve;
    });
  }

  close(): void {
    if (this.running()) return;
    this.modal().close();
  }

  protected async runPrimary(): Promise<void> {
    const action = this.state()?.primaryAction;
    if (!action || this.running()) return;
    this.running.set(true);
    try {
      await action.run();
      this.modal().close();
    } finally {
      this.running.set(false);
    }
  }

  protected openLink(link: BlockerLink): void {
    if (this.running()) return;
    this.modal().close();
    void this.router.navigate(link.route, {
      ...(link.queryParams ? { queryParams: link.queryParams } : {}),
    });
  }

  protected onClosed(): void {
    this.state.set(null);
    this.running.set(false);
    this.settle();
  }

  private settle(): void {
    const resolve = this.resolver;
    this.resolver = null;
    resolve?.();
  }
}
