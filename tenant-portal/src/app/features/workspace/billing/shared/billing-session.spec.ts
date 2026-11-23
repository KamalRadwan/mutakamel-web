import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { AuthSession } from '../../../../core/auth/auth-session';
import { BillingSession } from './billing-session';

describe('BillingSession', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('billing session reads the owner flag from me', () => {
    const me = signal<{ isTenantOwner: boolean } | null>(null);
    TestBed.configureTestingModule({ providers: [{ provide: AuthSession, useValue: { me } }] });
    const session = TestBed.inject(BillingSession);
    expect(session.isOwner()).toBe(false);
    me.set({ isTenantOwner: true });
    expect(session.isOwner()).toBe(true);
    me.set({ isTenantOwner: false });
    expect(session.isOwner()).toBe(false);
  });
});
