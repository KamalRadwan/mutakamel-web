import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RequirePermission } from '@/components/auth/RequirePermission';

vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/i18n/I18nContext', () => ({
  useI18n: vi.fn(() => ({ lang: 'en' })),
}));

vi.mock('@/lib/auth/rbac', () => ({
  adminCan: vi.fn(),
}));

import { useAuth } from '@/context/AuthContext';
import { adminCan } from '@/lib/auth/rbac';

describe('Admin Portal - RBAC Verification Gate', () => {
  it('blocks access when user lacks permission', () => {
    vi.mocked(useAuth).mockReturnValue({ user: { email: 'test@mutakamel.ai' } as never, isLoading: false, hasPermission: vi.fn(), hasAnyPermission: vi.fn(), hasAllPermissions: vi.fn(), logout: vi.fn(), refresh: vi.fn(), role: null, roles: [], rawToken: null, isSuperAdmin: true } as never);
    vi.mocked(adminCan).mockReturnValue(false);

    render(
      <RequirePermission permission="admin.critical.action">
        <div data-testid="protected-content">Secret Area</div>
      </RequirePermission>
    );

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(screen.getByText('Unauthorized')).toBeInTheDocument();
  });

  it('allows access when user has permission', () => {
    vi.mocked(useAuth).mockReturnValue({ user: { email: 'test@mutakamel.ai' } as never, isLoading: false, hasPermission: vi.fn(), hasAnyPermission: vi.fn(), hasAllPermissions: vi.fn(), logout: vi.fn(), refresh: vi.fn(), role: null, roles: [], rawToken: null, isSuperAdmin: true } as never);
    vi.mocked(adminCan).mockReturnValue(true);

    render(
      <RequirePermission permission="admin.critical.action">
        <div data-testid="protected-content">Secret Area</div>
      </RequirePermission>
    );

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    expect(screen.queryByText('Unauthorized')).not.toBeInTheDocument();
  });

  it('renders fallback when user lacks permission and fallback is provided', () => {
    vi.mocked(useAuth).mockReturnValue({ user: { email: 'test@mutakamel.ai' } as never, isLoading: false, hasPermission: vi.fn(), hasAnyPermission: vi.fn(), hasAllPermissions: vi.fn(), logout: vi.fn(), refresh: vi.fn(), role: null, roles: [], rawToken: null, isSuperAdmin: true } as never);
    vi.mocked(adminCan).mockReturnValue(false);

    render(
      <RequirePermission permission="admin.critical.action" fallback={<div data-testid="fallback">Access Denied</div>}>
        <div data-testid="protected-content">Secret Area</div>
      </RequirePermission>
    );

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(screen.getByTestId('fallback')).toBeInTheDocument();
    expect(screen.queryByText('Unauthorized')).not.toBeInTheDocument();
  });
});
