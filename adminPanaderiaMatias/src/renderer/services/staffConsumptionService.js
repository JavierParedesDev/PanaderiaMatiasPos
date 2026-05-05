import { apiClient } from './apiClient.js';

export async function getTrabajadores() {
  return apiClient.get('/consumo-personal/trabajadores');
}

export async function crearTrabajador(datos) {
  return apiClient.post('/consumo-personal/trabajadores', datos);
}

export async function actualizarTrabajador(idTrabajador, datos) {
  return apiClient.put(`/consumo-personal/trabajadores/${idTrabajador}`, datos);
}

export async function eliminarTrabajador(idTrabajador) {
  return apiClient.delete(`/consumo-personal/trabajadores/${idTrabajador}`);
}

export async function getConsumosPersonal(filtros = {}) {
  const query = new URLSearchParams(filtros).toString();
  return apiClient.get(`/consumo-personal${query ? `?${query}` : ''}`);
}

export async function registrarPagoConsumo(idTrabajador, datos) {
  return apiClient.post(`/consumo-personal/trabajadores/${idTrabajador}/pagos`, datos);
}
