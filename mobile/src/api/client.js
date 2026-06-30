import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// AuthContext registers this so the navigator reacts when the session expires.
let _sessionExpiredHandler = null;
export function registerSessionExpiredHandler(fn) {
  _sessionExpiredHandler = fn;
}

async function handleSessionExpired() {
  await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'user']);
  if (_sessionExpiredHandler) _sessionExpiredHandler();
}

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = await AsyncStorage.getItem('refresh_token');
      if (refresh) {
        try {
          const { data } = await axios.post(`${API_BASE}/auth/token/refresh/`, { refresh });
          await AsyncStorage.setItem('access_token', data.access);
          original.headers.Authorization = `Bearer ${data.access}`;
          return api(original);
        } catch {
          await handleSessionExpired();
        }
      } else {
        await handleSessionExpired();
      }
    }
    return Promise.reject(error);
  },
);

export default api;
