import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

/**
 * Resolve API base URL for simulator + physical devices.
 * Prefer EXPO_PUBLIC_API_URL; otherwise reuse the Metro/Expo host (LAN IP) on port 8002.
 */
export function resolveApiBase() {
  const fromEnv = (process.env.EXPO_PUBLIC_API_URL || '').trim();
  if (fromEnv) {
    // If someone left localhost but Expo is serving over LAN, rewrite host for device.
    if (fromEnv.includes('localhost') || fromEnv.includes('127.0.0.1')) {
      const lanHost = getExpoLanHost();
      if (lanHost) {
        return fromEnv
          .replace('localhost', lanHost)
          .replace('127.0.0.1', lanHost)
          .replace(':8000/', ':8002/');
      }
    }
    return fromEnv.includes(':8000/')
      ? fromEnv.replace(':8000/', ':8002/')
      : fromEnv;
  }

  const lanHost = getExpoLanHost();
  if (lanHost) {
    return `http://${lanHost}:8002/api`;
  }
  return 'http://localhost:8002/api';
}

function getExpoLanHost() {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost ||
    Constants.manifest?.debuggerHost ||
    '';
  if (!hostUri || typeof hostUri !== 'string') return null;
  const host = hostUri.split(':')[0]?.trim();
  if (!host || host === 'localhost' || host === '127.0.0.1') return null;
  return host;
}

const API_BASE = resolveApiBase();

if (__DEV__) {
  // Helps confirm LAN rewrite on device (Metro logs).
  // eslint-disable-next-line no-console
  console.log('[Propizy] API_BASE =', API_BASE);
}

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000,
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
