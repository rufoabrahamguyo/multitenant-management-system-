const ACCESS_KEY = 'access_token';
const REFRESH_KEY = 'refresh_token';
const USER_KEY = 'user';

// Detect which storage holds the active session.
// sessionStorage wins (non-remembered session); falls back to localStorage.
function getActiveStorage() {
  if (sessionStorage.getItem(ACCESS_KEY)) return sessionStorage;
  return localStorage;
}

export function getAccessToken() {
  return sessionStorage.getItem(ACCESS_KEY) || localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken() {
  return getActiveStorage().getItem(REFRESH_KEY);
}

export function getStoredUser() {
  const raw = getActiveStorage().getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    clearAuthStorage();
    return null;
  }
}

// remember=true  → localStorage (tokens survive browser restart)
// remember=false → sessionStorage (tokens cleared when tab closes)
// remember=undefined → update whichever storage already holds the session
export function setAuthSession({ access, refresh, user, remember }) {
  const storage =
    remember === true ? localStorage
    : remember === false ? sessionStorage
    : getActiveStorage();

  if (remember === false) {
    // Ensure the other storage doesn't have a stale session.
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  }

  if (access) storage.setItem(ACCESS_KEY, access);
  if (refresh) storage.setItem(REFRESH_KEY, refresh);
  if (user) storage.setItem(USER_KEY, JSON.stringify(user));
}

export function setStoredUser(user) {
  getActiveStorage().setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuthStorage() {
  [localStorage, sessionStorage].forEach((s) => {
    s.removeItem(ACCESS_KEY);
    s.removeItem(REFRESH_KEY);
    s.removeItem(USER_KEY);
  });
}
