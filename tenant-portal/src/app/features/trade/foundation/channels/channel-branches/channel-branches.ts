import { Component, computed, inject, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerBuilding } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { ScopeState, type ScopeBranch } from '../../../../../core/scope/scope';
import { Field } from '../../../../../shared/ui/field/field';
import { Switch } from '../../../../../shared/ui/switch/switch';
import { BADGE_CLASS } from '../../../shared/trade-labels';
import type { ChannelBranchLink } from '../channels.model';

interface BranchRow {
  branch: ScopeBranch;
  name: string;
  isCurrent: boolean;
  link: ChannelBranchLink | null;
  effectiveActive: boolean;
}

@Component({
  selector: 'app-channel-branches',
  imports: [NgIcon, TranslocoPipe, Field, Switch],
  providers: [provideIcons({ tablerBuilding })],
  templateUrl: './channel-branches.html',
  host: { class: 'flex flex-col gap-8' },
})
export class ChannelBranches {
  private static nextId = 0;

  private readonly scope = inject(ScopeState);
  private readonly lang = inject(LanguageState).current;

  protected readonly uid = `channel-branches-${++ChannelBranches.nextId}`;

  readonly mode = input.required<'create' | 'edit'>();
  readonly links = input<readonly ChannelBranchLink[]>([]);
  readonly draftActive = input<Readonly<Record<string, boolean>>>({});
  readonly canManage = input(true);
  readonly disabled = input(false);

  readonly branchToggle = output<{ branchId: string; isActive: boolean }>();

  protected readonly linkedBadgeClass = BADGE_CLASS.published;
  protected readonly inactiveBadgeClass = BADGE_CLASS.muted;
  protected readonly notLinkedBadgeClass = BADGE_CLASS.neutral;

  protected readonly rows = computed<BranchRow[]>(() => {
    const branches = this.scope.branches();
    const currentBranchId = this.scope.branch()?.id ?? null;
    const isAr = this.lang() === 'ar';
    const byBranch = new Map(this.links().map((link) => [link.branchId, link]));
    const draft = this.draftActive();

    return branches.map((branch) => {
      const link = byBranch.get(branch.id) ?? null;
      const effectiveActive =
        branch.id in draft ? draft[branch.id] : (link?.isActive ?? false);
      const name = isAr
        ? link?.branchNameAr || branch.nameAr
        : link?.branchName || branch.nameEn;

      return {
        branch,
        name,
        isCurrent: branch.id === currentBranchId,
        link,
        effectiveActive,
      };
    });
  });

  protected switchId(branchId: string): string {
    return `${this.uid}-switch-${branchId}`;
  }

  protected onToggle(branchId: string, isActive: boolean): void {
    if (!this.canManage() || this.disabled()) return;
    this.branchToggle.emit({ branchId, isActive });
  }
}
