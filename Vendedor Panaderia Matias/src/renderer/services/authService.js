import { apiClient } from './apiClient.js';

export async function login({ baseUrl, username, password }) {
  return apiClient.post('/auth/login', { username, password }, { baseUrl });
}
