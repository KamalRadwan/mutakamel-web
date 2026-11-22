import {
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Params, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { provideTranslocoScopeInherited } from '../../../../../../core/i18n/transloco-scope';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArrowLeft,
  tablerBuilding,
  tablerChevronLeft,
  tablerChevronRight,
  tablerTarget,
  tablerUser,
  tablerUserPlus,
  tablerUsers,
} from '@ng-icons/tabler-icons';
import {
  ActionItem,
  ActionSelection,
  ActionsMenu,
} from '../../../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../../../shared/ui/button/button';
import { RecordNavPosition } from '../../nav/record-nav';

export interface RecordHeaderOwner {
  name: string;
  avatarUrl: string | null;
}

function ownerInitialsOf(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

/** Shared identity and action bar for CRM full-page record views. */
@Component({
  selector: 'app-record-page-header',
  imports: [RouterLink, NgIcon, TranslocoPipe, ActionsMenu, Button],
  viewProviders: [provideTranslocoScopeInherited({ scope: 'record-page', alias: 'recordPage' })],
  providers: [
    provideIcons({
      tablerArrowLeft,
      tablerChevronLeft,
      tablerChevronRight,
      tablerUserPlus,
      tablerBuilding,
      tablerUser,
      tablerUsers,
      tablerTarget,
    }),
  ],
  templateUrl: './record-page-header.html',
  host: { class: 'block' },
})
export class RecordPageHeader {
  private readonly primarySlot = viewChild<ElementRef<HTMLElement>>('primarySlot');

  readonly title = input('');
  readonly subtitle = input<string | null>(null);
  readonly typeIcon = input('');
  readonly tile = input('bg-icon-blue');
  readonly backLink = input<readonly unknown[] | string | null>(null);
  readonly backQueryParams = input<Params | null>(null);
  readonly owner = input<RecordHeaderOwner | null>(null);
  readonly position = input<RecordNavPosition | null>(null);
  readonly dirty = input(false);
  readonly saving = input(false);
  readonly menuItems = input<ActionItem[]>([]);

  readonly mode = input<'create' | 'edit'>('edit');
  readonly canEdit = input(true);
  readonly busy = input(false);
  readonly navBusy = input(false);
  readonly backLabel = input<string | null>(null);
  readonly prevLabel = input<string | null>(null);
  readonly nextLabel = input<string | null>(null);
  readonly saveLabel = input<string | null>(null);
  readonly actionsLabel = input<string | null>(null);
  readonly noColorLabel = input<string | null>(null);

  readonly back = output<void>();
  readonly prev = output<void>();
  readonly next = output<void>();
  readonly save = output<void>();
  readonly undo = output<void>();
  readonly menuAction = output<ActionSelection>();

  protected readonly hasPrimaryProjected = signal(false);

  protected readonly hasBackLink = computed(() => {
    const link = this.backLink();
    if (Array.isArray(link)) return link.length > 0;
    return typeof link === 'string' && link.length > 0;
  });

  protected readonly ownerInitials = computed(() => ownerInitialsOf(this.owner()?.name ?? ''));

  protected readonly showUndoSave = computed(
    () => this.canEdit() && (this.dirty() || this.mode() === 'create'),
  );
  protected readonly showMenu = computed(
    () => this.mode() === 'edit' && this.menuItems().length > 0,
  );
  protected readonly hasActions = computed(
    () => this.hasPrimaryProjected() || this.showUndoSave() || this.showMenu(),
  );

  constructor() {
    effect((onCleanup) => {
      const el = this.primarySlot()?.nativeElement;
      if (!el) return;
      const update = () => this.hasPrimaryProjected.set(el.childElementCount > 0);
      update();
      const observer = new MutationObserver(update);
      observer.observe(el, { childList: true });
      onCleanup(() => observer.disconnect());
    });
  }
}
