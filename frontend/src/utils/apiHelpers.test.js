import { describe, expect, it } from 'vitest';
import { isValidKenyaPhone, validatePassword, unwrapList } from './apiHelpers';

describe('unwrapList', () => {
  it('returns arrays as-is', () => {
    expect(unwrapList([1, 2])).toEqual([1, 2]);
  });

  it('unwraps paginated results', () => {
    expect(unwrapList({ results: [{ id: 1 }] })).toEqual([{ id: 1 }]);
  });
});

describe('validatePassword', () => {
  it('rejects short passwords', () => {
    expect(validatePassword('short')).toMatch(/8 characters/);
  });

  it('accepts valid passwords', () => {
    expect(validatePassword('longenough')).toBe('');
  });
});

describe('isValidKenyaPhone', () => {
  it('accepts +254 format', () => {
    expect(isValidKenyaPhone('+254712345678')).toBe(true);
  });

  it('rejects invalid numbers', () => {
    expect(isValidKenyaPhone('123')).toBe(false);
  });
});
