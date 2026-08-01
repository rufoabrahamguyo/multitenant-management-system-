import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PermissionRoute, ProtectedRoute } from './ProtectedRoute';

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('./LoadingScreen', () => ({
  default: () => <div>Loading…</div>,
}));

import { useAuth } from '../context/AuthContext';

function renderWithRoutes(ui, { initialEntries = ['/app'] } = {}) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/login" element={<div>Login page</div>} />
        <Route path="/verify-phone" element={<div>Verify phone</div>} />
        <Route path="/dashboard" element={<div>Dashboard</div>} />
        <Route path="/app" element={ui} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  it('redirects unauthenticated users to login', () => {
    useAuth.mockReturnValue({ user: null, loading: false });
    renderWithRoutes(
      <ProtectedRoute>
        <div>Secret</div>
      </ProtectedRoute>,
    );
    expect(screen.getByText('Login page')).toBeTruthy();
  });

  it('renders children for verified managers', () => {
    useAuth.mockReturnValue({
      user: { role: 'MANAGER', phone_verified: true, org_role: 'OWNER' },
      loading: false,
    });
    renderWithRoutes(
      <ProtectedRoute>
        <div>Secret</div>
      </ProtectedRoute>,
    );
    expect(screen.getByText('Secret')).toBeTruthy();
  });

  it('sends unverified managers to phone verification', () => {
    useAuth.mockReturnValue({
      user: { role: 'MANAGER', phone_verified: false, org_role: 'OWNER' },
      loading: false,
    });
    renderWithRoutes(
      <ProtectedRoute>
        <div>Secret</div>
      </ProtectedRoute>,
    );
    expect(screen.getByText('Verify phone')).toBeTruthy();
  });
});

describe('PermissionRoute', () => {
  it('uses API permissions when present', () => {
    useAuth.mockReturnValue({
      user: {
        role: 'MANAGER',
        org_role: 'STAFF',
        permissions: { governance: { read: false } },
      },
      loading: false,
    });
    renderWithRoutes(
      <PermissionRoute resource="governance">
        <div>Governance</div>
      </PermissionRoute>,
    );
    expect(screen.getByText('Dashboard')).toBeTruthy();
  });

  it('allows access when API grants read', () => {
    useAuth.mockReturnValue({
      user: {
        role: 'MANAGER',
        org_role: 'OWNER',
        permissions: { governance: { read: true, write: true } },
      },
      loading: false,
    });
    renderWithRoutes(
      <PermissionRoute resource="governance">
        <div>Governance</div>
      </PermissionRoute>,
    );
    expect(screen.getByText('Governance')).toBeTruthy();
  });
});
