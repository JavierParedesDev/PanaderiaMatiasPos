import { getHistorialVentas } from '../../services/saleService.js';
import { getSession } from '../../state/sessionStore.js';
import { formatCurrency, escapeHtml } from '../../utils/formatters.js';

export function renderVentasSkeleton() {
  return `
    <div class="space-y-8 pb-10">
      <header>
        <h1 class="text-3xl font-black text-[#2d221b] tracking-tighter">Historial de Ventas</h1>
        <p class="text-sm font-medium text-[#705f52] mt-1">Registro completo de transacciones. Últimos 100 tickets.</p>
      </header>
      <div id="ventas-content">
        <div class="panel h-96 animate-pulse bg-white/50"></div>
      </div>
    </div>
  `;
}

export async function hydrateVentasView() {
  const container = document.querySelector('#ventas-content');
  if (!container) return;

  try {
    const session = getSession();
    const isAdmin = session?.usuario?.rol === 'Admin';
    const currentUsername = session?.usuario?.username;

    const res = await getHistorialVentas();
    let ventas = res.data || [];

    // Filtrar si es vendedor
    if (!isAdmin && currentUsername) {
      ventas = ventas.filter(v => v.vendedor === currentUsername);
    }

    container.innerHTML = `
      <div class="panel bg-white shadow-sm overflow-hidden">
        <div class="p-6 border-b border-borde/30 flex items-center justify-between">
          <h2 class="text-xl font-bold text-[#2d221b]">${isAdmin ? 'Registro de Tickets (Global)' : 'Tus Tickets del Día'}</h2>
          <span class="text-[10px] font-bold text-cafe/40 uppercase">${ventas.length} registros</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead class="bg-crema/20 text-[10px] font-black uppercase tracking-widest text-cafe/60">
              <tr>
                <th class="px-6 py-4">Folio</th>
                <th class="px-6 py-4">Fecha</th>
                ${isAdmin ? '<th class="px-6 py-4">Vendedor</th>' : ''}
                <th class="px-6 py-4">Sucursal</th>
                <th class="px-6 py-4 text-right">Total</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-borde/20 text-sm">
              ${ventas.map(v => `
                <tr class="hover:bg-papel/10 transition-colors">
                  <td class="px-6 py-4">
                    <span class="px-2 py-1 bg-cafe/10 text-cafe font-black text-[10px] rounded-lg">#${v.folio_interno}</span>
                  </td>
                  <td class="px-6 py-4 text-cafe/60 font-medium">
                    ${new Date(v.fecha).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' })}
                  </td>
                  ${isAdmin ? `<td class="px-6 py-4 font-bold text-[#2d221b]">${escapeHtml(v.vendedor)}</td>` : ''}
                  <td class="px-6 py-4 text-cafe/50">${escapeHtml(v.sucursal)}</td>
                  <td class="px-6 py-4 text-right font-black text-cafe">${formatCurrency(v.total_venta)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          ${ventas.length === 0 ? `
            <div class="p-12 text-center text-cafe/30 italic">No se encontraron tickets registrados.</div>
          ` : ''}
        </div>
      </div>
    `;
  } catch (error) {
    container.innerHTML = `<div class="panel p-10 text-center text-rojoaviso font-bold bg-white">${error.message}</div>`;
  }
}
