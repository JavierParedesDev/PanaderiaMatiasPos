import { apiClient } from './apiClient.js';

export async function getHistorialVentas(filtros = {}) {
    const query = new URLSearchParams(filtros).toString();
    return apiClient.get(query ? `/ventas/historial?${query}` : '/ventas/historial');
}
