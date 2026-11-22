import { Component, DestroyRef, inject, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerChevronDown,
  tablerDeviceDesktop,
  tablerDeviceMobile,
  tablerDevices,
  tablerWorld,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../../core/i18n/language';
import { Notify } from '../../../../../../core/notify/notify';
import { Button } from '../../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { AccountSection } from '../../../shared/account-section/account-section';
import { SessionRow } from '../session-row/session-row';
import { listSessions, logoutAll, revokeSession } from '../sessions.api';
import {
  AuthSession,
  formatSessionDate,
  lastActive,
  sessionDeviceIcon,
  sessionEndReasonKey,
} from '../sessions.model';

let nextSessionsCardId = 0;

@Component({
  selector: 'app-account-sessions',
  imports: [NgIcon, TranslocoPipe, Button, ConfirmDialog, AccountSection, SessionRow],
  providers: [
    provideIcons({
      tablerDevices,
      tablerWorld,
      tablerDeviceMobile,
      tablerDeviceDesktop,
      tablerChevronDown,
    }),
  ],
  templateUrl: './sessions-card.html',
  host: { class: 'block' },
})
export class SessionsCard {
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState);
  private readonly notify = inject(Notify);
  private readonly router = inject(Router);

  private readonly allDialog = viewChild.required<ConfirmDialog>('allDialog');
  private readonly endCurrentDialog = viewChild.required<ConfirmDialog>('endCurrentDialog');
  private readonly endOtherDialog = viewChild.required<ConfirmDialog>('endOtherDialog');

  protected readonly historyRegionId = `account-sessions-history-${++nextSessionsCardId}`;
  protected readonly skeletonRows = [0, 1, 2] as const;

  protected readonly loading = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly activeSessions = signal<AuthSession[]>([]);
  protected readonly endedSessions = signal<AuthSession[]>([]);
  protected readonly historyPage = signal(1);
  protected readonly hasMoreHistory = signal(false);
  protected readonly loadingMore = signal(false);
  protected readonly historyOpen = signal(false);
  protected readonly signingOutAll = signal(false);
  protected readonly revokingIds = signal<ReadonlySet<string>>(new Set());
  protected readonly pendingRevokeDevice = signal('');

  private loadSeq = 0;

  constructor() {
    void this.loadInitial();
    inject(DestroyRef).onDestroy(() => {
      this.loadSeq++;
    });
  }

  reload(): void {
    void this.loadInitial();
  }

  protected async onSignOutAll(): Promise<void> {
    if (this.signingOutAll()) return;
    const confirmed = await this.allDialog().open();
    if (!confirmed) return;

    this.signingOutAll.set(true);
    try {
      await logoutAll();
      this.notify.success(this.transloco.translate('wsAccSessions.toast.allEnded'));
      await this.router.navigate(['/login']);
    } catch {
      this.notify.error(this.transloco.translate('wsAccSessions.errors.generic'));
    } finally {
      this.signingOutAll.set(false);
    }
  }

  protected async onEndSession(session: AuthSession): Promise<void> {
    if (this.isRevoking(session.id) || this.signingOutAll()) return;

    if (session.current) {
      const confirmed = await this.endCurrentDialog().open();
      if (!confirmed) return;
    } else {
      this.pendingRevokeDevice.set(this.sessionLabel(session));
      const confirmed = await this.endOtherDialog().open();
      if (!confirmed) return;
    }

    this.setRevoking(session.id, true);
    try {
      await revokeSession(session.id);
      if (session.current) {
        await this.router.navigate(['/login']);
        return;
      }

      const ended: AuthSession = {
        ...session,
        endedAt: new Date().toISOString(),
        endReason: 'LOGOUT',
        current: false,
      };
      this.activeSessions.update((list) => list.filter((item) => item.id !== session.id));
      this.endedSessions.update((list) => [ended, ...list.filter((item) => item.id !== session.id)]);
      this.notify.success(this.transloco.translate('wsAccSessions.toast.ended'));
    } catch {
      this.notify.error(this.transloco.translate('wsAccSessions.errors.generic'));
    } finally {
      this.setRevoking(session.id, false);
    }
  }

  protected toggleHistory(): void {
    this.historyOpen.update((open) => !open);
  }

  protected async onLoadMore(): Promise<void> {
    if (this.loadingMore() || !this.hasMoreHistory()) return;
    const seq = this.loadSeq;
    const nextPage = this.historyPage() + 1;

    this.loadingMore.set(true);
    try {
      const result = await listSessions(nextPage);
      if (seq !== this.loadSeq) return;

      const existingIds = new Set(this.endedSessions().map((s) => s.id));
      const additions = result.items.filter((s) => s.endedAt !== null && !existingIds.has(s.id));
      if (additions.length > 0) {
        this.endedSessions.update((list) => [...list, ...additions]);
      }
      this.historyPage.set(result.endedHistory.page);
      this.hasMoreHistory.set(result.endedHistory.hasMore);
    } catch {
      if (seq === this.loadSeq) {
        this.notify.error(this.transloco.translate('wsAccSessions.errors.generic'));
      }
    } finally {
      if (seq === this.loadSeq) {
        this.loadingMore.set(false);
      }
    }
  }

  protected isRevoking(id: string): boolean {
    return this.revokingIds().has(id);
  }

  protected deviceIcon(session: AuthSession): string {
    return sessionDeviceIcon(session.clientType);
  }

  protected sessionLabel(session: AuthSession): string {
    this.i18n();
    return session.deviceLabel?.trim() || this.transloco.translate(`wsAccSessions.client.${session.clientType}`);
  }

  protected formatEndedDate(iso: string): string {
    return formatSessionDate(iso, this.language.current());
  }

  protected reasonKey(reason: AuthSession['endReason']): string {
    return sessionEndReasonKey(reason);
  }

  private async loadInitial(): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadFailed.set(false);
    this.loadingMore.set(false);

    try {
      const result = await listSessions(1);
      if (seq !== this.loadSeq) return;

      const active = result.items
        .filter((s) => !s.endedAt)
        .sort((a, b) => {
          if (a.current !== b.current) return a.current ? -1 : 1;
          return Date.parse(lastActive(b)) - Date.parse(lastActive(a));
        });
      const ended = result.items.filter((s) => s.endedAt !== null);

      this.activeSessions.set(active);
      this.endedSessions.set(ended);
      this.historyPage.set(result.endedHistory.page);
      this.hasMoreHistory.set(result.endedHistory.hasMore);
    } catch {
      if (seq !== this.loadSeq) return;
      this.loadFailed.set(true);
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  private setRevoking(id: string, busy: boolean): void {
    this.revokingIds.update((current) => {
      const next = new Set(current);
      if (busy) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }
}
