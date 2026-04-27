import { apiClient } from './apiClient.js';

// Kardex - Auditoría global de movimientos
export async function getKardexTodos() {
    return apiClient.get('/kardex/todos');
}

export async function getKardexProducto(idProducto, idSucursal) {
    return apiClient.get(`/kardex/producto/${idProducto}/${idSucursal}`);
}

// Facturas - Ingreso de mercadería de proveedores (endpoint: /api/facturas)
export async function ingresarFactura(datos) {
    return apiClient.post('/facturas', datos);
}

// Mermas - Registro de pérdidas (endpoint: /api/mermas)
export async function registrarMerma(datos) {
    return apiClient.post('/mermas', datos);
}
