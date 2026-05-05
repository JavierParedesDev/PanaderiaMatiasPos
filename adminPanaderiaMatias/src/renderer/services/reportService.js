import { apiClient } from './apiClient.js';

export async function getDashboard() {
  return apiClient.get('/reportes/dashboard');
}

export async function getReporteCigarros(filtros = {}) {
  const query = new URLSearchParams(filtros).toString();
  return apiClient.get(query ? `/reportes/cigarros?${query}` : '/reportes/cigarros');
}

export async function getRankingProductos() {
  return apiClient.get('/reportes/ranking');
}

export async function getReporteUtilidadMensual() {
  return apiClient.get('/reportes/utilidad-mensual');
}
