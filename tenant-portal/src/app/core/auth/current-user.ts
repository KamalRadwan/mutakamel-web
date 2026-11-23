import { Service, computed, signal } from '@angular/core';
import { type AuthMe, userFromMe } from './auth-me';

export interface User {
  id?: string;
  displayName: string;
  email: string;
  timeZone?: string;
}

const UNVERIFIED_USER: User = { displayName: '', email: '' };

@Service()
export class CurrentUser {
  readonly user = signal<User>(UNVERIFIED_USER);
  /** Empty means unavailable; never substitute another user's identity or timezone. */
  readonly userId = computed(() => this.user().id ?? '');
  readonly timeZone = computed(() => this.user().timeZone ?? '');
  readonly initials = computed(() =>
    this.user()
      .displayName.trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join(''),
  );

  set(me: AuthMe): void {
    this.user.set(userFromMe(me));
  }

  reset(): void {
    this.user.set(UNVERIFIED_USER);
  }
}
