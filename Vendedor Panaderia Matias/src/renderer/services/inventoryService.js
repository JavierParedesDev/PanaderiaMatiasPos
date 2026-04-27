import { apiClient } from './apiClient.js';

export async function getInventario() {
  return apiClient.get('/inventario');
}

export async function ajustarInventario(payload) {
  return apiClient.post('/inventario/ajuste', payload);
}
