const STORAGE_KEY = 'panaderia-matias-vendedor-session';

let currentSession = readSession();

function readSession() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getSession() {
  return currentSession;
}

export function saveSession(session) {
  currentSession = session;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession() {
  currentSession = null;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function isAuthenticated() {
  return Boolean(currentSession?.token);
}
