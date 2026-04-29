import { apiClient } from './apiClient.js';

export async function getTurnos(filtros = {}) {
    const query = new URLSearchParams(filtros).toString();
    return apiClient.get(`/turnos?${query}`);
}

export async function abrirTurno(datos) {
    return apiClient.post('/turnos/abrir', datos);
}

export async function cerrarTurno(datos) {
    return apiClient.post('/turnos/cerrar', datos);
}

export async function getResumenTurno(id) {
    return apiClient.get(`/turnos/${id}/resumen`);
}
