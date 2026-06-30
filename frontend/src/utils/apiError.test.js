import { describe, expect, it } from 'vitest';
import { getApiErrorMessage, getApiFieldErrors } from './apiError';

describe('getApiFieldErrors', () => {
  it('returns field-level messages from DRF validation errors', () => {
    const err = {
      response: {
        data: {
          email: ['Enter a valid email address.'],
          username: ['A user with that username already exists.'],
        },
      },
    };
    expect(getApiFieldErrors(err)).toEqual({
      email: 'Enter a valid email address.',
      username: 'A user with that username already exists.',
    });
  });

  it('returns empty object for detail-only errors', () => {
    const err = { response: { data: { detail: 'Invalid credentials.' } } };
    expect(getApiFieldErrors(err)).toEqual({});
  });

  it('returns empty object when response is missing', () => {
    expect(getApiFieldErrors({})).toEqual({});
  });
});

describe('getApiErrorMessage', () => {
  it('prefers detail string from API', () => {
    const err = { response: { data: { detail: 'Not found.' } } };
    expect(getApiErrorMessage(err)).toBe('Not found.');
  });

  it('flattens field errors into a readable message', () => {
    const err = {
      response: {
        data: { phone_number: ['Enter a valid phone number.'] },
      },
    };
    expect(getApiErrorMessage(err)).toBe('phone number: Enter a valid phone number.');
  });

  it('handles network errors', () => {
    const err = { request: {} };
    expect(getApiErrorMessage(err)).toContain('Cannot reach the server');
  });
});
