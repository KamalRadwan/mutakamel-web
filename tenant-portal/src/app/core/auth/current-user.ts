import { Service, computed, signal } from '@angular/core';
import { type AuthMe, userFromMe } from './auth-me';
import { FAKE_TIME_ZONE, FAKE_USER, FAKE_USER_ID } from './current-user.fake';

export interface User {
  id?: string;
  displayName: string;
  email: string;
  timeZone?: string;
}

@Service()
export class CurrentUser {
  readonly user = signal<User>(FAKE_USER);
  readonly userId = computed(() => this.user().id ?? FAKE_USER_ID);
  readonly timeZone = computed(() => this.user().timeZone ?? FAKE_TIME_ZONE);
  readonly initials = computed(() =>
    this.user()
      .displayName.trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join(''),
  );

  set(me: AuthMe): void {
    this.user.set(userFromMe(me, FAKE_TIME_ZONE));
  }

  reset(): void {
    this.user.set(FAKE_USER);
  }
}
