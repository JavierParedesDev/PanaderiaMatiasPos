import { apiClient } from './apiClient.js';

export async function getHistorialVentas() {
    return apiClient.get('/ventas/historial');
}

/**
 * Registra una nueva venta en el sistema (POS)
 * @param {Object} datos - { tipo_documento, metodo_pago, total_venta, detalles: [...] }
 */
export async function registrarVenta(datos) {
    return apiClient.post('/ventas', datos);
}
