import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, resource, signal } from '@angular/core';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { PluralKeyPipe } from '../../../../core/i18n/plural';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerAlertCircle, tablerChevronDown, tablerCircleCheck, tablerLayoutGrid, tablerSparkles } from '@ng-icons/tabler-icons';
import { CurrentUser } from '../../../../core/auth/current-user';
import { Button } from '../../../../shared/ui/button/button';
import { getAppsOverview } from '../modules.api';
import { COMING_SOON_APPS, groupWorkspaceApps } from '../modules.model';
import { AppCard } from './app-card/app-card';

const FUTURE_COLLAPSED_KEY = 'home.future.collapsed';

function readFutureCollapsed(): boolean {
  try {
    return localStorage.getItem(FUTURE_COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeFutureCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(FUTURE_COLLAPSED_KEY, String(collapsed));
  } catch {
    // Ignore storage quota or disabled storage errors.
  }
}

@Component({
  selector: 'app-home-page',
  imports: [TranslocoPipe, PluralKeyPipe, NgIcon, Button, AppCard],
  providers: [
    provideTranslocoScope({ scope: 'home', alias: 'home' }),
    provideIcons({
      tablerCircleCheck,
      tablerLayoutGrid,
      tablerSparkles,
      tablerChevronDown,
      tablerAlertCircle,
    }),
  ],
  templateUrl: './home-page.html',
  host: { class: 'flex shrink-0 flex-col gap-12 p-12' },
})
export class HomePage {
  private readonly currentUser = inject(CurrentUser);
  private readonly http = inject(HttpClient);

  private readonly overviewResource = resource({ loader: () => getAppsOverview(this.http) });

  protected readonly skeletons = [1, 2, 3, 4, 5, 6];
  protected readonly futureCollapsed = signal(readFutureCollapsed());
  protected readonly future = COMING_SOON_APPS;

  protected readonly userName = computed(() => this.currentUser.user().displayName.trim());
  private readonly groups = computed(() =>
    groupWorkspaceApps(this.overviewResource.hasValue() ? this.overviewResource.value().items : []),
  );
  protected readonly subscribed = computed(() => this.groups().subscribed);
  protected readonly available = computed(() => this.groups().available);
  protected readonly loading = this.overviewResource.isLoading;
  protected readonly failed = computed(() => !!this.overviewResource.error());

  protected toggleFuture(): void {
    const next = !this.futureCollapsed();
    this.futureCollapsed.set(next);
    writeFutureCollapsed(next);
  }

  protected retry(): void {
    this.overviewResource.reload();
  }
}
