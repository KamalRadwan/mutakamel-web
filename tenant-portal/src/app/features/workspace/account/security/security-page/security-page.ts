import { Component, signal, viewChild } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCloudOff } from '@ng-icons/tabler-icons';
import { Button } from '../../../../../shared/ui/button/button';
import { MfaCard } from '../mfa-card/mfa-card';
import { PasswordCard } from '../password-card/password-card';
import { getSecurityMe } from '../security.api';
import { SecurityMe } from '../security.model';
import { SessionsCard } from '../sessions/sessions-card/sessions-card';

@Component({
  selector: 'app-security-page',
  imports: [NgIcon, TranslocoPipe, Button, PasswordCard, MfaCard, SessionsCard],
  providers: [provideIcons({ tablerCloudOff })],
  templateUrl: './security-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto p-12' },
})
export class SecurityPage {
  protected readonly sessions = viewChild(SessionsCard);
  protected readonly skeletonCards = [0, 1] as const;

  protected readonly me = signal<SecurityMe | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);

  private loadSeq = 0;

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.failed.set(false);
    try {
      const data = await getSecurityMe();
      if (seq !== this.loadSeq) return;
      this.me.set(data);
    } catch {
      if (seq !== this.loadSeq) return;
      this.failed.set(true);
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }
}
