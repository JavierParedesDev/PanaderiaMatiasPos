import { apiClient } from './apiClient.js';

export async function getUsuarios() {
    return apiClient.get('/usuarios');
}

export async function crearUsuario(datos) {
    return apiClient.post('/usuarios', datos);
}
