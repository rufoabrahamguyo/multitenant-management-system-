import axios from 'axios';
import {
  clearAuthStorage,
  getAccessToken,
  getRefreshToken,
  setAuthSession,
} from '../utils/authStorage';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

const AUTH_ENDPOINTS = [
  '/auth/login/',
  '/auth/register/',
  '/auth/register-tenant/',
  '/auth/register-staff/',
  '/auth/token/refresh/',
  '/auth/me/',
];

function isAuthEndpoint(url = '') {
  return AUTH_ENDPOINTS.some((path) => url.includes(path));
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let _refreshPromise = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry && !isAuthEndpoint(original.url)) {
      original._retry = true;
      const refresh = getRefreshToken();
      if (refresh) {
        if (!_refreshPromise) {
          _refreshPromise = axios
            .post(`${API_BASE}/auth/token/refresh/`, { refresh })
            .then(({ data }) => {
              setAuthSession({ access: data.access });
              return data.access;
            })
            .catch((err) => {
              clearAuthStorage();
              window.location.href = '/login?session=expired';
              throw err;
            })
            .finally(() => {
              _refreshPromise = null;
            });
        }
        try {
          const access = await _refreshPromise;
          original.headers.Authorization = `Bearer ${access}`;
          return api(original);
        } catch {
          return Promise.reject(error);
        }
      } else {
        clearAuthStorage();
        window.location.href = '/login?session=expired';
      }
    }
    return Promise.reject(error);
  },
);

export default api;
