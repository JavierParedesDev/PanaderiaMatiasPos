import { getHistorialVentas } from '../../services/saleService.js';
import { getSession } from '../../state/sessionStore.js';
import { formatCurrency, escapeHtml } from '../../utils/formatters.js';

export function renderVentasSkeleton() {
  return `
    <div class="px-4 md:px-10 py-6 md:py-10 space-y-6 md:space-y-10 h-full flex flex-col bg-crema/5 overflow-hidden">
      <header class="flex items-center justify-between shrink-0">
        <div>
           <h1 class="text-2xl md:text-4xl font-black text-[#2d221b] tracking-tighter italic uppercase">Historial de Mis Tickets</h1>
           <p class="text-[9px] md:text-[10px] font-black text-cafe/40 uppercase tracking-[0.4em] mt-1 md:mt-2 ml-1">Revisión de las últimas 100 ventas del turno actual</p>
        </div>
        <button id="btn-volver-venta" class="px-4 md:px-10 h-12 md:h-16 bg-cafe text-white font-black uppercase tracking-widest text-[10px] md:text-[11px] shadow-2xl shadow-cafe/20 hover:bg-[#4a2f1d] transition-all flex items-center gap-2 md:gap-4">
           <span class="text-xl md:text-2xl">⇠</span> Volver a Venta
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
    const userId = session?.usuario?.id;

    const { getTurnos } = await import('../../services/shiftService.js');
    const tRes = await getTurnos({ estado: 'Abierto' });
    const miTurno = (tRes.data || []).find(t => t.id_usuario === userId);

    const res = await getHistorialVentas();
    let ventas = res.data || [];

    if (miTurno) {
      const shiftStart = new Date(miTurno.fecha_apertura).getTime();
      ventas = ventas.filter(v => 
        Number(v.id_turno) === Number(miTurno.id) || 
        new Date(v.fecha).getTime() >= (shiftStart - 5 * 60000)
      );
    } else {
      ventas = [];
    }

    // Variables de Paginación y Búsqueda
    let ventasFiltradas = [...ventas];
    let currentPage = 1;
    const itemsPerPage = 10;

    container.innerHTML = `
      <div class="bg-white border border-borde/20 shadow-2xl overflow-hidden h-full flex flex-col">
        <div class="px-4 md:px-10 py-6 md:py-10 border-b border-borde/10 flex items-center justify-between bg-papel flex-wrap gap-4 md:gap-6">
          <div>
            <h2 class="text-xl md:text-2xl font-black text-[#2d221b] uppercase tracking-tighter">Tickets del Turno</h2>
            <p class="text-[10px] md:text-[11px] font-black text-cafe/30 uppercase tracking-[0.2em] mt-1 md:mt-2">Registros: <span id="ventas-total-count">${ventasFiltradas.length}</span></p>
          </div>
          <div class="flex items-center gap-6">
            <!-- Buscador -->
            <div class="relative w-64">
              <span class="absolute left-4 top-1/2 -translate-y-1/2 text-cafe/40">🔍</span>
              <input id="buscador-ventas" type="text" placeholder="Buscar folio..." 
                     class="w-full h-12 bg-papel/50 border border-borde/40 rounded-xl pl-12 pr-4 text-sm font-bold outline-none focus:ring-4 focus:ring-cafe/5 focus:border-cafe/30 transition-all">
            </div>
            <!-- Indicador En Línea -->
            <div class="flex items-center gap-3">
              <span class="w-4 h-4 bg-verdeok/20 flex items-center justify-center">
                 <span class="w-2 h-2 bg-verdeok"></span>
              </span>
              <span class="text-[11px] font-black text-verdeok uppercase tracking-[0.3em]">En Línea</span>
            </div>
          </div>
        </div>

        <!-- Tabla de Historial -->
        <div class="flex-1 overflow-auto custom-scrollbar">
          <table class="w-full text-left border-collapse">
            <thead class="sticky top-0 bg-white z-10 font-black">
              <tr class="text-[11px] font-black uppercase tracking-[0.3em] text-cafe/30 border-b border-borde/10 bg-papel/50">
                <th class="px-4 md:px-10 py-4 md:py-6 text-[9px] md:text-[11px]">Identificador</th>
                <th class="px-4 md:px-10 py-4 md:py-6 text-[9px] md:text-[11px]">Fecha y Hora</th>
                <th class="px-4 md:px-10 py-4 md:py-6 text-[9px] md:text-[11px] text-right">Monto Neto</th>
              </tr>
            </thead>
            <tbody id="cuerpo-tabla-ventas" class="divide-y divide-borde/10 text-sm">
              <!-- Filas dinámicas aquí -->
            </tbody>
          </table>
          <div id="caja-vacia-ventas" class="hidden h-64 flex flex-col items-center justify-center text-cafe/20 opacity-30">
            <span class="text-7xl mb-6">📂</span>
            <p class="text-xs font-black uppercase tracking-[0.4em]">Sin movimientos registrados</p>
          </div>
        </div>

        <!-- Paginación -->
        <div id="ventas-paginacion" class="px-10 py-6 border-t border-borde/10 bg-papel/30 flex items-center justify-between">
          <button id="btn-ventas-prev" class="px-6 py-3 bg-white border border-borde/40 text-cafe font-black text-xs rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:bg-cafe/5 transition-all shadow-sm">◀ Anterior</button>
          <span id="ventas-paginacion-info" class="text-xs font-black uppercase tracking-widest text-cafe/40">Página 1 de 1</span>
          <button id="btn-ventas-next" class="px-6 py-3 bg-white border border-borde/40 text-cafe font-black text-xs rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:bg-cafe/5 transition-all shadow-sm">Siguiente ▶</button>
        </div>
      </div>
    `;

    const tbody = document.querySelector('#cuerpo-tabla-ventas');
    const emptyBox = document.querySelector('#caja-vacia-ventas');
    const btnPrev = document.querySelector('#btn-ventas-prev');
    const btnNext = document.querySelector('#btn-ventas-next');
    const pagInfo = document.querySelector('#ventas-paginacion-info');
    const totalCount = document.querySelector('#ventas-total-count');
    const buscador = document.querySelector('#buscador-ventas');

    function updateTable() {
      const totalPages = Math.ceil(ventasFiltradas.length / itemsPerPage) || 1;
      
      if (currentPage > totalPages) currentPage = totalPages;
      if (currentPage < 1) currentPage = 1;

      // Calcular rangos
      const start = (currentPage - 1) * itemsPerPage;
      const end = start + itemsPerPage;
      const itemsToShow = ventasFiltradas.slice(start, end);

      if (itemsToShow.length === 0) {
        tbody.innerHTML = '';
        emptyBox.classList.remove('hidden');
      } else {
        emptyBox.classList.add('hidden');
        tbody.innerHTML = itemsToShow.map(v => `
          <tr class="hover:bg-cafe/[0.02] transition-all group">
            <td class="px-4 md:px-10 py-4 md:py-8">
              <span class="px-3 md:px-5 py-2 md:py-3 bg-cafe text-white font-black text-[9px] md:text-[11px] tracking-[0.2em] uppercase shadow-lg shadow-cafe/10">Folio #${v.folio_interno}</span>
            </td>
            <td class="px-4 md:px-10 py-4 md:py-8">
              <p class="text-sm md:text-base font-black text-[#2d221b] tracking-tighter">${new Date(v.fecha).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })} HRS</p>
              <p class="text-[9px] md:text-[11px] font-bold text-cafe/30 uppercase mt-0.5 md:mt-1 tracking-wider">${new Date(v.fecha).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
            </td>
            <td class="px-4 md:px-10 py-4 md:py-8 text-right">
              <p class="text-xl md:text-3xl font-black text-cafe tracking-tighter">${formatCurrency(v.total_venta)}</p>
              <p class="text-[9px] md:text-[10px] font-bold text-cafe/20 uppercase tracking-[0.4em] mt-1 md:mt-2">${v.metodo_pago || 'EFECTIVO'}</p>
            </td>
          </tr>
        `).join('');
      }

      // Actualizar controles
      pagInfo.textContent = `Página ${currentPage} de ${totalPages}`;
      btnPrev.disabled = currentPage === 1;
      btnNext.disabled = currentPage === totalPages;
      totalCount.textContent = ventasFiltradas.length;
    }

    // Listeners
    btnPrev.addEventListener('click', () => {
      currentPage--;
      updateTable();
    });

    btnNext.addEventListener('click', () => {
      currentPage++;
      updateTable();
    });

    buscador.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      ventasFiltradas = ventas.filter(v => 
        String(v.folio_interno).toLowerCase().includes(query) || 
        (v.metodo_pago || 'EFECTIVO').toLowerCase().includes(query)
      );
      currentPage = 1;
      updateTable();
    });

    updateTable();

  } catch (error) {
    container.innerHTML = `<div class="panel p-10 text-center text-rojoaviso font-bold bg-white">${error.message}</div>`;
  }
}
