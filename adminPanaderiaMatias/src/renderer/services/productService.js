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

export async function getProductos(params = {}) {
  return apiClient.get(`/productos${buildQuery(params)}`);
}

export async function exportarProductosLabelNet(params = {}) {
  return apiClient.getText(`/productos/export/labelnet${buildQuery(params)}`);
}

export async function importarProductosLabelNet(payload) {
  return apiClient.post('/productos/import/labelnet', payload);
}

export async function crearProducto(payload) {
  return apiClient.post('/productos', payload);
}

export async function actualizarProducto(id, payload) {
  return apiClient.put(`/productos/${id}`, payload);
}

export async function eliminarProducto(id) {
  return apiClient.delete(`/productos/${id}`);
}
