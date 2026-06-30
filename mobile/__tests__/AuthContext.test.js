import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider, useAuth } from '../src/context/AuthContext';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('../src/api/client', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  },
  registerSessionExpiredHandler: jest.fn(),
}));

const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;

describe('AuthContext', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('starts with null user and loading=false after mount', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});
    expect(result.current.user).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('restores persisted user from AsyncStorage on mount', async () => {
    const storedUser = { id: 1, username: 'tenant1' };
    await AsyncStorage.setItem('user', JSON.stringify(storedUser));
    await AsyncStorage.setItem('access_token', 'tok');

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});
    expect(result.current.user).toEqual(storedUser);
  });

  it('rejects login for non-tenant roles', async () => {
    const api = require('../src/api/client').default;
    api.post.mockResolvedValueOnce({
      data: { role: 'MANAGER', user: {}, access: 'a', refresh: 'r' },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});

    await expect(
      act(() => result.current.login('manager', 'pass')),
    ).rejects.toThrow('This app is for tenants only.');

    expect(result.current.user).toBeNull();
  });

  it('sets user state on successful tenant login', async () => {
    const mockUser = { id: 2, username: 'tenant2', role: 'TENANT' };
    const api = require('../src/api/client').default;
    api.post.mockResolvedValueOnce({
      data: { role: 'TENANT', user: mockUser, access: 'access-tok', refresh: 'refresh-tok' },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});
    await act(() => result.current.login('tenant2', 'pass'));

    expect(result.current.user).toEqual(mockUser);
    expect(await AsyncStorage.getItem('access_token')).toBe('access-tok');
    expect(await AsyncStorage.getItem('refresh_token')).toBe('refresh-tok');
  });

  it('clears user and storage on logout', async () => {
    await AsyncStorage.setItem('access_token', 'tok');
    await AsyncStorage.setItem('refresh_token', 'rtok');
    await AsyncStorage.setItem('user', JSON.stringify({ id: 3 }));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});
    await act(() => result.current.logout());

    expect(result.current.user).toBeNull();
    expect(await AsyncStorage.getItem('access_token')).toBeNull();
    expect(await AsyncStorage.getItem('refresh_token')).toBeNull();
  });
});
