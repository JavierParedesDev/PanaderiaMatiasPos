import { apiClient } from './apiClient.js';

export async function getDashboard() {
  return apiClient.get('/reportes/dashboard');
}

export async function getReporteCigarros() {
  return apiClient.get('/reportes/cigarros');
}

export async function getRankingProductos() {
  return apiClient.get('/reportes/ranking');
}

export async function getReporteUtilidadMensual() {
  return apiClient.get('/reportes/utilidad-mensual');
}
