import { clearSession, getSession } from '../state/sessionStore.js';

const DEFAULT_API_URL = 'http://64.176.20.67:3000/api';

function normalizeBaseUrl(customBaseUrl) {
  const source = (customBaseUrl || getSession()?.baseUrl || DEFAULT_API_URL).trim();
  return source.endsWith('/') ? source.slice(0, -1) : source;
}

async function request(path, options = {}) {
  const session = getSession();
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (session?.token) {
    headers.Authorization = `Bearer ${session.token}`;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401 || response.status === 403) {
    if (session?.token) {
      clearSession();
    }
  }

  if (!response.ok) {
    const error = new Error(data.error || data.mensaje || 'Error al conectar con el servidor.');
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data;
}

export const apiClient = {
  get: (path, options = {}) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options = {}) => request(path, { ...options, method: 'POST', body }),
  put: (path, body, options = {}) => request(path, { ...options, method: 'PUT', body }),
  delete: (path, options = {}) => request(path, { ...options, method: 'DELETE' }),
  defaultBaseUrl: DEFAULT_API_URL,
  normalizeBaseUrl
};
