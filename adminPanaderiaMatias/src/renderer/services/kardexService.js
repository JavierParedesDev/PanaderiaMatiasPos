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

export async function getKardexTodos(params = {}) {
  return apiClient.get(`/kardex/todos${buildQuery(params)}`);
}

export async function getKardexProducto(idProducto, idSucursal) {
  return apiClient.get(`/kardex/producto/${idProducto}/${idSucursal}`);
}

export async function ingresarFactura(datos) {
  return apiClient.post('/facturas', datos);
}

export async function registrarMerma(datos) {
  return apiClient.post('/mermas', datos);
}
