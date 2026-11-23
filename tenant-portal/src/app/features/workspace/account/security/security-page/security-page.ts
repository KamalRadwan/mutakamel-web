import { Component, inject, viewChild } from '@angular/core';
import { MfaCard } from '../mfa-card/mfa-card';
import { PasswordCard } from '../password-card/password-card';
import { AuthSession } from '../../../../../core/auth/auth-session';
import { SessionsCard } from '../sessions/sessions-card/sessions-card';

@Component({
  selector: 'app-security-page',
  imports: [PasswordCard, MfaCard, SessionsCard],
  templateUrl: './security-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto p-12' },
})
export class SecurityPage {
  protected readonly sessions = viewChild(SessionsCard);
  protected readonly me = inject(AuthSession).me;
}
