import { apiClient } from './apiClient.js';

export async function getRetiros(filtros = {}) {
  const query = new URLSearchParams(filtros).toString();
  return apiClient.get(`/retiros${query ? `?${query}` : ''}`);
}

export async function registrarRetiro(datos) {
  return apiClient.post('/retiros', datos);
}
