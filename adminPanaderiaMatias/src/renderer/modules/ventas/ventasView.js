import { getHistorialVentas } from '../../services/saleService.js';
import { getUsuarios } from '../../services/userService.js';
import { getMetodosPago } from '../../services/masterService.js';
import { getTurnos } from '../../services/shiftService.js';
import { getSession } from '../../state/sessionStore.js';
import { formatCurrency, escapeHtml } from '../../utils/formatters.js';

// jsPDF se carga de forma global desde index.html

let filters = {
  id_turno: '',
  id_usuario: '',
  fecha_desde: '',
  fecha_hasta: '',
  metodo_pago: '',
  tipo_turno: ''
};

export function renderVentasSkeleton() {
  return `
    <div class="space-y-8 pb-10">
      <header class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-black text-[#2d221b] tracking-tighter">Historial de Ventas</h1>
          <p class="text-sm font-medium text-[#705f52] mt-1">Registro completo de transacciones con filtros avanzados.</p>
        </div>
        <button id="btn-export-pdf" class="btn-secondary flex items-center gap-2 py-3 px-6 shadow-sm hover:shadow-md transition-all">
          <span>📄</span> Exportar PDF
        </button>
      </header>

      <!-- Filtros -->
      <div class="panel bg-papel/30 p-6 space-y-4 border-2 border-dashed border-cafe/10">
        <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div class="space-y-1">
            <label class="text-[10px] font-black uppercase tracking-widest text-cafe/50">Vendedor</label>
            <select id="filter-usuario" class="w-full h-10 px-3 rounded-xl border border-borde bg-white text-xs font-bold text-cafe">
              <option value="">Todos</option>
            </select>
          </div>
          <div class="space-y-1">
            <label class="text-[10px] font-black uppercase tracking-widest text-cafe/50">Tipo Turno</label>
            <select id="filter-tipo-turno" class="w-full h-10 px-3 rounded-xl border border-borde bg-white text-xs font-bold text-cafe">
              <option value="">Todos</option>
              <option value="Mañana">Mañana</option>
              <option value="Tarde">Tarde</option>
              <option value="Unico">Único</option>
            </select>
          </div>
          <div class="space-y-1">
            <label class="text-[10px] font-black uppercase tracking-widest text-cafe/50">ID Turno</label>
            <select id="filter-turno" class="w-full h-10 px-3 rounded-xl border border-borde bg-white text-xs font-bold text-cafe">
              <option value="">Cualquiera</option>
            </select>
          </div>
          <div class="space-y-1">
            <label class="text-[10px] font-black uppercase tracking-widest text-cafe/50">Fecha Desde</label>
            <input type="date" id="filter-desde" class="w-full h-10 px-3 rounded-xl border border-borde bg-white text-xs font-bold text-cafe">
          </div>
          <div class="space-y-1">
            <label class="text-[10px] font-black uppercase tracking-widest text-cafe/50">Fecha Hasta</label>
            <input type="date" id="filter-hasta" class="w-full h-10 px-3 rounded-xl border border-borde bg-white text-xs font-bold text-cafe">
          </div>
          <div class="space-y-1">
            <label class="text-[10px] font-black uppercase tracking-widest text-cafe/50">Método Pago</label>
            <select id="filter-metodo" class="w-full h-10 px-3 rounded-xl border border-borde bg-white text-xs font-bold text-cafe">
              <option value="">Cualquier método</option>
            </select>
          </div>
        </div>

        <div class="flex items-center justify-end gap-3 pt-2">
          <button id="btn-clear-filters" class="text-[10px] font-black uppercase tracking-widest text-cafe/40 hover:text-cafe transition-colors px-4 py-2">
            Limpiar Filtros
          </button>
          <button id="btn-apply-filters" class="btn-primary flex items-center gap-2 py-2 px-8 shadow-sm hover:shadow-md transition-all">
            <span>🔍</span> Filtrar Resultados
          </button>
        </div>
      </div>

      <div id="ventas-content">
        <div class="panel h-96 animate-pulse bg-white/50"></div>
      </div>
    </div>
  `;
}

async function exportToPDF(ventas) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const session = getSession();
  
  // Header
  doc.setFontSize(18);
  doc.text('Historial de Ventas - Panadería Matías', 14, 20);
  doc.setFontSize(10);
  doc.text(`Generado por: ${session?.usuario?.username || 'Admin'} el ${new Date().toLocaleString()}`, 14, 28);
  
  // Table
  const tableData = ventas.map(v => [
    `#${v.folio_interno}`,
    new Date(v.fecha).toLocaleString('es-CL'),
    v.vendedor,
    v.sucursal,
    v.medio_pago || 'Efectivo',
    formatCurrency(v.total_venta)
  ]);

  doc.autoTable({
    startY: 35,
    head: [['Folio', 'Fecha', 'Vendedor', 'Sucursal', 'Método Pago', 'Total']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [45, 34, 27] }, // #2d221b
    styles: { fontSize: 8 }
  });

  doc.save(`historial_ventas_${new Date().getTime()}.pdf`);
}

export async function hydrateVentasView() {
  const container = document.querySelector('#ventas-content');
  if (!container) return;

  // Reset filters on each load
  filters = {
    id_turno: '',
    id_usuario: '',
    fecha_desde: '',
    fecha_hasta: '',
    metodo_pago: '',
    tipo_turno: ''
  };

  try {
    const session = getSession();
    const isAdmin = session?.usuario?.rol === 'Admin';

    // Cargar datos de filtros
    const [usuariosRes, metodosRes, turnosRes] = await Promise.all([
      getUsuarios(),
      getMetodosPago(),
      getTurnos({ hoy: false }) // Traer históricos
    ]);

    const selectUser = document.querySelector('#filter-usuario');
    const selectTurno = document.querySelector('#filter-turno');
    const selectMetodo = document.querySelector('#filter-metodo');
    const selectTipoTurno = document.querySelector('#filter-tipo-turno');

    if (selectUser && usuariosRes.data) {
      usuariosRes.data.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.id;
        opt.textContent = u.username;
        selectUser.appendChild(opt);
      });
    }

    if (selectTurno && turnosRes.data) {
      turnosRes.data.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        const fecha = new Date(t.fecha_apertura).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' });
        let tipo = t.tipo_turno || 'Unico';
        // Limpiar errores de encoding si existen
        if (tipo.toLowerCase().includes('unico') || tipo.includes('snico')) tipo = 'Unico';
        if (tipo.toLowerCase().includes('manana') || tipo.includes('maana')) tipo = 'Mañana';
        
        opt.textContent = `${fecha} - ${tipo} (#${t.id})`;
        selectTurno.appendChild(opt);
      });
    }

    if (selectMetodo && metodosRes.data) {
      metodosRes.data.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.nombre;
        opt.textContent = m.nombre;
        selectMetodo.appendChild(opt);
      });
    }

    let allVentas = [];
    const itemsPerPage = 15;
    let currentPage = 1;

    const fetchData = async () => {
      console.log('Aplicando filtros:', filters);
      const res = await getHistorialVentas(filters);
      console.log('Respuesta API:', res);
      
      if (!res.debug) {
        console.warn('ADVERTENCIA: La API no parece haber sido actualizada con el soporte para filtros. El servidor remoto aún tiene la versión antigua.');
      }

      allVentas = res.data || [];
      currentPage = 1;
      renderTable();
    };

    const renderTable = () => {
      const totalPages = Math.max(1, Math.ceil(allVentas.length / itemsPerPage));
      if (currentPage > totalPages) currentPage = totalPages;

      const start = (currentPage - 1) * itemsPerPage;
      const pageItems = allVentas.slice(start, start + itemsPerPage);

      container.innerHTML = `
        <div class="panel bg-white shadow-sm overflow-hidden">
          <div class="p-6 border-b border-borde/30 flex items-center justify-between">
            <h2 class="text-xl font-bold text-[#2d221b]">Tickets Encontrados</h2>
            <span class="text-[10px] font-bold text-cafe/40 uppercase">${allVentas.length} registros</span>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left">
              <thead class="bg-crema/20 text-[10px] font-black uppercase tracking-widest text-cafe/60">
                <tr>
                  <th class="px-6 py-4">Folio</th>
                  <th class="px-6 py-4">Fecha</th>
                  <th class="px-6 py-4">Vendedor</th>
                  <th class="px-6 py-4">Método</th>
                  <th class="px-6 py-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-borde/20 text-sm">
                ${pageItems.map(v => `
                  <tr class="hover:bg-papel/10 transition-colors">
                    <td class="px-6 py-4">
                      <span class="px-2 py-1 bg-cafe/10 text-cafe font-black text-[10px] rounded-lg">#${v.folio_interno}</span>
                    </td>
                    <td class="px-6 py-4 text-cafe/60 font-medium text-xs">
                      ${new Date(v.fecha).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td class="px-6 py-4 font-bold text-[#2d221b]">${escapeHtml(v.vendedor)}</td>
                    <td class="px-6 py-4 text-xs">
                      <span class="px-2 py-0.5 rounded-full bg-azulaviso/5 text-azulaviso font-bold">${escapeHtml(v.medio_pago || 'Efectivo')}</span>
                    </td>
                    <td class="px-6 py-4 text-right font-black text-cafe">${formatCurrency(v.total_venta)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            ${allVentas.length === 0 ? `
              <div class="p-12 text-center text-cafe/30 italic">No se encontraron tickets con los filtros aplicados.</div>
            ` : ''}
          </div>
          <div class="px-6 py-4 border-t border-borde/20 flex items-center justify-between text-xs font-bold text-cafe/40 uppercase">
            <button id="ventas-prev" class="btn-secondary py-2 px-4 text-xs disabled:opacity-30 disabled:cursor-not-allowed" ${currentPage === 1 ? 'disabled' : ''}>Anterior</button>
            <span>Página ${currentPage} de ${totalPages}</span>
            <button id="ventas-next" class="btn-secondary py-2 px-4 text-xs disabled:opacity-30 disabled:cursor-not-allowed" ${currentPage === totalPages ? 'disabled' : ''}>Siguiente</button>
          </div>
        </div>
      `;

      container.querySelector('#ventas-prev')?.addEventListener('click', () => {
        currentPage = Math.max(1, currentPage - 1);
        renderTable();
      });
      container.querySelector('#ventas-next')?.addEventListener('click', () => {
        currentPage = Math.min(totalPages, currentPage + 1);
        renderTable();
      });
    };

    // Eventos de filtros (solo actualizan el objeto filters)
    selectUser?.addEventListener('change', (e) => { filters.id_usuario = e.target.value; });
    selectTurno?.addEventListener('change', (e) => { filters.id_turno = e.target.value; });
    selectMetodo?.addEventListener('change', (e) => { filters.metodo_pago = e.target.value; });
    selectTipoTurno?.addEventListener('change', (e) => { filters.tipo_turno = e.target.value; });
    document.querySelector('#filter-desde')?.addEventListener('change', (e) => { filters.fecha_desde = e.target.value; });
    document.querySelector('#filter-hasta')?.addEventListener('change', (e) => { filters.fecha_hasta = e.target.value; });

    // Botones de acción
    document.querySelector('#btn-apply-filters')?.addEventListener('click', () => fetchData());
    
    document.querySelector('#btn-clear-filters')?.addEventListener('click', () => {
      filters = { id_turno: '', id_usuario: '', fecha_desde: '', fecha_hasta: '', metodo_pago: '', tipo_turno: '' };
      if (selectUser) selectUser.value = '';
      if (selectTurno) selectTurno.value = '';
      if (selectMetodo) selectMetodo.value = '';
      if (selectTipoTurno) selectTipoTurno.value = '';
      const d1 = document.querySelector('#filter-desde'); if (d1) d1.value = '';
      const d2 = document.querySelector('#filter-hasta'); if (d2) d2.value = '';
      fetchData();
    });

    // Botón Exportar
    document.querySelector('#btn-export-pdf')?.addEventListener('click', () => exportToPDF(allVentas));

    await fetchData();
  } catch (error) {
    container.innerHTML = `<div class="panel p-10 text-center text-rojoaviso font-bold bg-white">${error.message}</div>`;
  }
}
