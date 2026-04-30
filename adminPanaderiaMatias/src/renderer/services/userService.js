import { apiClient } from './apiClient.js';

export async function getUsuarios() {
    return apiClient.get('/usuarios');
}

export async function crearUsuario(datos) {
    return apiClient.post('/usuarios', datos);
}

export async function actualizarUsuario(id, datos) {
    return apiClient.put(`/usuarios/${id}`, datos);
}

export async function eliminarUsuario(id) {
    return apiClient.delete(`/usuarios/${id}`);
}
