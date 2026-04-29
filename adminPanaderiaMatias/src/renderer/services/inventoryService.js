import { apiClient } from './apiClient.js';

function buildQuery(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });

  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
}

export async function getInventario(params = {}) {
  return apiClient.get(`/inventario${buildQuery(params)}`);
}

export async function ajustarInventario(payload) {
  return apiClient.post('/inventario/ajuste', payload);
}

export async function fijarInventario(idProducto, payload) {
  return apiClient.put(`/inventario/${idProducto}`, payload);
}
