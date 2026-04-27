import { apiClient } from './apiClient.js';

export async function getHistorialVentas() {
    return apiClient.get('/ventas/historial');
}
