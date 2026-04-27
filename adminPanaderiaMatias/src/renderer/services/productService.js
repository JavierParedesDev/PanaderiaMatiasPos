import { apiClient } from './apiClient.js';

export async function getProductos() {
  return apiClient.get('/productos');
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
