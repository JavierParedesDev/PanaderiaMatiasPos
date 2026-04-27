import { getHistorialVentas } from '../../services/saleService.js';
import { getSession } from '../../state/sessionStore.js';
import { formatCurrency, escapeHtml } from '../../utils/formatters.js';

export function renderVentasSkeleton() {
  return `
    <div class="px-10 py-10 space-y-10 h-full flex flex-col bg-crema/5 overflow-hidden">
      <header class="flex items-center justify-between shrink-0">
        <div>
           <h1 class="text-4xl font-black text-[#2d221b] tracking-tighter italic uppercase">Historial de Mis Tickets</h1>
           <p class="text-[10px] font-black text-cafe/40 uppercase tracking-[0.4em] mt-2 ml-1">Revisión de las últimas 100 ventas del turno actual</p>
        </div>
        <button id="btn-volver-venta" class="px-10 h-16 bg-cafe text-white font-black uppercase tracking-widest text-[11px] shadow-2xl shadow-cafe/20 hover:bg-[#4a2f1d] transition-all flex items-center gap-4">
           <span class="text-2xl">⇠</span> Volver a Venta
        </button>
      </header>
      <div id="ventas-content" class="flex-1 overflow-hidden">
        <div class="panel h-full animate-pulse bg-white/50 border-none shadow-none"></div>
      </div>
    </div>
  `;
}

export async function hydrateVentasView() {
  const container = document.querySelector('#ventas-content');
  const backBtn = document.querySelector('#btn-volver-venta');
  if (!container) return;

  if (backBtn) {
    backBtn.addEventListener('click', () => {
      // Navegación manual disparando evento o clicando en el home
      const homeBtn = document.querySelector('.header-action-btn[data-route="dashboard"]') ||
        document.querySelector('img[src*="logo.png"]');
      if (homeBtn) homeBtn.click();
    });
  }

  try {
    const session = getSession();
    const currentUsername = session?.usuario?.username;

    const res = await getHistorialVentas();
    let ventas = (res.data || []).filter(v => v.vendedor === currentUsername);

    container.innerHTML = `
      <div class="bg-white border border-borde/20 shadow-2xl overflow-hidden h-full flex flex-col">
        <div class="px-10 py-10 border-b border-borde/10 flex items-center justify-between bg-papel">
          <div>
            <h2 class="text-2xl font-black text-[#2d221b] uppercase tracking-tighter">Tickets del Turno</h2>
            <p class="text-[11px] font-black text-cafe/30 uppercase tracking-[0.2em] mt-2">Registros en memoria local / sincronizados: ${ventas.length}</p>
          </div>
          <div class="flex items-center gap-3">
            <span class="w-4 h-4 bg-verdeok/20 flex items-center justify-center">
               <span class="w-2 h-2 bg-verdeok"></span>
            </span>
            <span class="text-[11px] font-black text-verdeok uppercase tracking-[0.3em]">En Línea</span>
          </div>
        </div>
        
        <div class="flex-1 overflow-auto custom-scrollbar">
          <table class="w-full text-left border-collapse">
            <thead class="sticky top-0 bg-white z-10 font-black">
              <tr class="text-[11px] font-black uppercase tracking-[0.3em] text-cafe/30 border-b border-borde/10 bg-papel/50">
                <th class="px-10 py-6">Identificador</th>
                <th class="px-10 py-6">Fecha y Hora</th>
                <th class="px-10 py-6 text-center">Documento</th>
                <th class="px-10 py-6 text-right">Monto Neto</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-borde/10 text-sm">
              ${ventas.map(v => `
                <tr class="hover:bg-cafe/[0.02] transition-all group">
                  <td class="px-10 py-8">
                    <span class="px-5 py-3 bg-cafe text-white font-black text-[11px] tracking-[0.2em] uppercase shadow-lg shadow-cafe/10">Folio #${v.folio_interno}</span>
                  </td>
                  <td class="px-10 py-8">
                    <p class="text-base font-black text-[#2d221b] tracking-tighter">${new Date(v.fecha).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })} HRS</p>
                    <p class="text-[11px] font-bold text-cafe/30 uppercase mt-1 tracking-wider">${new Date(v.fecha).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                  </td>
                  <td class="px-10 py-8 text-center">
                    <span class="px-4 py-2 bg-verdeok/5 border border-verdeok/20 text-verdeok font-black text-[10px] uppercase tracking-tighter">Boleta Exenta SII</span>
                  </td>
                  <td class="px-10 py-8 text-right">
                    <p class="text-3xl font-black text-cafe tracking-tighter">${formatCurrency(v.total_venta)}</p>
                    <p class="text-[10px] font-bold text-cafe/20 uppercase tracking-[0.4em] mt-2">${v.metodo_pago || 'EFECTIVO'}</p>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          ${ventas.length === 0 ? `
            <div class="h-64 flex flex-col items-center justify-center text-cafe/20 opacity-30">
              <span class="text-7xl mb-6">📂</span>
              <p class="text-xs font-black uppercase tracking-[0.4em]">Sin movimientos registrados</p>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  } catch (error) {
    container.innerHTML = `<div class="panel p-10 text-center text-rojoaviso font-bold bg-white">${error.message}</div>`;
  }
}
