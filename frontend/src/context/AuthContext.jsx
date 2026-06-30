import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';
import {
  clearAuthStorage,
  getAccessToken,
  getStoredUser,
  setAuthSession,
  setStoredUser,
} from '../utils/authStorage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      const token = getAccessToken();
      const cachedUser = getStoredUser();

      if (!token) {
        setLoading(false);
        return;
      }

      if (cachedUser) setUser(cachedUser);

      try {
        const { data } = await api.get('/auth/me/');
        setUser(data);
        setStoredUser(data);
      } catch {
        clearAuthStorage();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  const login = async (username, password, remember = true) => {
    const { data } = await api.post('/auth/login/', { username, password, remember });
    setAuthSession({ access: data.access, refresh: data.refresh, user: data.user, remember });
    setUser(data.user);
    return data;
  };

  const register = async (formData) => {
    const { data } = await api.post('/auth/register/', formData);
    setAuthSession({ access: data.access, refresh: data.refresh, user: data.user });
    setUser(data.user);
    return data;
  };

  const registerStaff = async (formData) => {
    const { data } = await api.post('/auth/register-staff/', formData);
    setAuthSession({ access: data.access, refresh: data.refresh, user: data.user });
    setUser(data.user);
    return data;
  };

  const updateUser = (userData) => {
    setStoredUser(userData);
    setUser(userData);
  };

  const logout = () => {
    clearAuthStorage();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, registerStaff, logout, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
