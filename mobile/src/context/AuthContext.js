import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { registerSessionExpiredHandler } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('user');
        const token = await AsyncStorage.getItem('access_token');
        if (stored && token) setUser(JSON.parse(stored));
      } catch {
        await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'user']);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    // When the API client detects an expired/invalid session it calls this handler,
    // which clears user state and triggers AppNavigator to show the login screen.
    registerSessionExpiredHandler(() => setUser(null));
  }, []);

  const persistAuth = async (data) => {
    await AsyncStorage.setItem('access_token', data.access);
    await AsyncStorage.setItem('refresh_token', data.refresh);
    await AsyncStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    return data;
  };

  const login = async (username, password) => {
    const { data } = await api.post('/auth/login/', { username, password });
    if (data.role !== 'TENANT') {
      throw new Error('This app is for tenants only.');
    }
    return persistAuth(data);
  };

  const loginAfterRegister = persistAuth;

  const logout = async () => {
    await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'user']);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, loginAfterRegister, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
