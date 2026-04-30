import { apiClient } from './apiClient.js';

export async function getTrabajadores() {
  return apiClient.get('/consumo-personal/trabajadores');
}

export async function registrarConsumoPersonal(datos) {
  return apiClient.post('/consumo-personal', datos);
}
