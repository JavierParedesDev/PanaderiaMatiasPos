import { apiClient } from './apiClient.js';

export async function getCategorias() {
  return apiClient.get('/maestros/categorias');
}

export async function crearCategoria(datos) {
  return apiClient.post('/maestros/categorias', datos);
}

export async function getProveedores() {
  return apiClient.get('/maestros/proveedores');
}

export async function crearProveedor(datos) {
  return apiClient.post('/maestros/proveedores', datos);
}

export async function getSucursales() {
  return apiClient.get('/maestros/sucursales');
}

export async function getMetodosPago() {
  return apiClient.get('/maestros/metodos-pago');
}
