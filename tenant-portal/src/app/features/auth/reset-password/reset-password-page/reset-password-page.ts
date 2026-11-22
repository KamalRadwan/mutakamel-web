import { Component, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCircleCheck, tablerCircleX } from '@ng-icons/tabler-icons';
import { AuthSession } from '../../../../core/auth/auth-session';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { Button } from '../../../../shared/ui/button/button';
import { SettingsNotice } from '../../../../shared/ui/settings-notice/settings-notice';
import { readActionToken } from '../../shared/action-token';
import { AuthCard } from '../../shared/auth-card/auth-card';
import { retryAfterSeconds, throttleCountdown } from '../../shared/auth-throttle';
import { NewPasswordForm } from '../new-password-form/new-password-form';
import { RequestForm } from '../request-form/request-form';
import { requestResetLink } from '../reset-password.api';
import { resetErrorKey, resetErrorKind } from '../reset-password.model';

type ResetPageState = 'request' | 'sent' | 'set' | 'invalid' | 'done';

const RESEND_COOLDOWN_SECONDS = 60;
const EMAIL_SENTINEL = '\u0000';

@Component({
  selector: 'app-reset-password-page',
  imports: [RouterLink, TranslocoPipe, NgIcon, Button, SettingsNotice, AuthCard, RequestForm, NewPasswordForm],
  providers: [provideIcons({ tablerCircleCheck, tablerCircleX })],
  templateUrl: './reset-password-page.html',
})
export class ResetPasswordPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authSession = inject(AuthSession);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  protected readonly state = signal<ResetPageState>('request');
  protected readonly token = signal('');
  protected readonly sentTo = signal<string | null>(null);
  protected readonly resending = signal(false);
  protected readonly resendNoticeKey = signal<string | null>(null);
  protected readonly resendCooldown = throttleCountdown();
  protected readonly resendThrottle = throttleCountdown();
  protected readonly resendThrottleInitial = signal(0);
  protected readonly resendThrottleEnded = signal(false);

  protected readonly titleKey = computed(() => `authReset.${this.state()}.title`);
  protected readonly subtitleKey = computed(() => {
    const current = this.state();
    return current === 'request' || current === 'set' ? `authReset.${current}.subtitle` : null;
  });

  protected readonly sentParts = computed(() => {
    this.i18n();
    const raw = this.transloco.translate('authReset.sent.text', { email: EMAIL_SENTINEL });
    const index = raw.indexOf(EMAIL_SENTINEL);
    if (index < 0) return { before: raw, hasEmail: false, after: '' };
    return {
      before: raw.slice(0, index),
      hasEmail: true,
      after: raw.slice(index + EMAIL_SENTINEL.length),
    };
  });

  constructor() {
    let wasThrottled = false;
    effect(() => {
      const active = this.resendThrottle.active();
      untracked(() => this.resendThrottleEnded.set(!active && wasThrottled));
      wasThrottled = active;
    });
  }

  ngOnInit(): void {
    const rawFragment = this.route.snapshot.fragment;
    const parsedToken = readActionToken(rawFragment);
    if (rawFragment !== null) {
      void this.router.navigate([], {
        relativeTo: this.route,
        replaceUrl: true,
        fragment: undefined,
        queryParamsHandling: 'preserve',
      });
    }

    if (parsedToken) {
      this.token.set(parsedToken);
      this.state.set('set');
    } else if (this.isTenantResetPath()) {
      this.state.set('invalid');
    } else {
      this.state.set('request');
    }
  }

  protected onLinkSent(email: string): void {
    this.sentTo.set(email);
    this.resendNoticeKey.set(null);
    this.resendThrottleEnded.set(false);
    this.state.set('sent');
    this.resendCooldown.start(RESEND_COOLDOWN_SECONDS);
  }

  protected async resendLink(): Promise<void> {
    const email = this.sentTo();
    if (!email || this.resending() || this.resendCooldown.active() || this.resendThrottle.active()) return;

    this.resending.set(true);
    this.resendNoticeKey.set(null);
    this.resendThrottleEnded.set(false);
    try {
      await requestResetLink(email);
      this.resendCooldown.start(RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      if (resetErrorKind(error) === 'throttle') {
        const seconds = retryAfterSeconds(error);
        this.resendThrottleInitial.set(seconds);
        this.resendThrottle.start(seconds);
      } else {
        this.resendNoticeKey.set(resetErrorKey(error));
      }
    } finally {
      this.resending.set(false);
    }
  }

  protected onPasswordChanged(): void {
    this.token.set('');
    this.authSession.clearLocal();
    this.state.set('done');
  }

  protected onInvalidLink(): void {
    this.token.set('');
    this.state.set('invalid');
  }

  protected requestNewLink(): void {
    this.token.set('');
    this.sentTo.set(null);
    this.state.set('request');
    void this.router.navigateByUrl('/reset-password');
  }

  private isTenantResetPath(): boolean {
    const fromRoute = this.route.snapshot.pathFromRoot
      .flatMap((snap) => snap.url)
      .map((segment) => segment.path)
      .join('/');
    if (fromRoute) {
      return fromRoute === 'tenant/reset-password';
    }
    const cleanUrl = this.router.url.split(/[?#]/)[0].replace(/^\/+|\/+$/g, '');
    return cleanUrl === 'tenant/reset-password';
  }
}
