import { apiClient } from './apiClient.js';

export async function getCategorias() {
  return apiClient.get('/maestros/categorias');
}

export async function crearCategoria(datos) {
  return apiClient.post('/maestros/categorias', datos);
}

export async function actualizarCategoria(idCategoria, datos) {
  return apiClient.put(`/maestros/categorias/${idCategoria}`, datos);
}

export async function eliminarCategoria(idCategoria) {
  return apiClient.delete(`/maestros/categorias/${idCategoria}`);
}

export async function getProveedores() {
  return apiClient.get('/maestros/proveedores');
}

export async function crearProveedor(datos) {
  return apiClient.post('/maestros/proveedores', datos);
}

export async function actualizarProveedor(idProveedor, datos) {
  return apiClient.put(`/maestros/proveedores/${idProveedor}`, datos);
}

export async function eliminarProveedor(idProveedor) {
  return apiClient.delete(`/maestros/proveedores/${idProveedor}`);
}

export async function getSucursales() {
  return apiClient.get('/maestros/sucursales');
}

export async function getMetodosPago() {
  return apiClient.get('/maestros/metodos-pago');
}

export async function actualizarMetodoPago(idMetodo, datos) {
  return apiClient.put(`/maestros/metodos-pago/${idMetodo}`, datos);
}

export async function eliminarMetodoPago(idMetodo) {
  return apiClient.delete(`/maestros/metodos-pago/${idMetodo}`);
}
