import { describe, expect, it } from 'vitest';
import { canAccessPath, permissionsForRole } from '../constants/orgRoles';

describe('orgRoles fallback helpers', () => {
  it('grants owners dashboard access', () => {
    const perms = permissionsForRole('OWNER');
    expect(canAccessPath(perms, '/dashboard')).toBe(true);
    expect(canAccessPath(perms, '/governance')).toBe(true);
  });

  it('blocks maintenance role from properties', () => {
    const perms = permissionsForRole('MAINTENANCE');
    expect(canAccessPath(perms, '/maintenance')).toBe(true);
    expect(canAccessPath(perms, '/properties')).toBe(false);
  });
});
