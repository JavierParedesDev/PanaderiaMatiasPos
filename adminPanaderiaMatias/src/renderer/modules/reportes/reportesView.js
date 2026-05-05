import { getRankingProductos, getReporteUtilidadMensual, getReporteCigarros } from '../../services/reportService.js';
import { getTurnos } from '../../services/shiftService.js';
import { formatCurrency, escapeHtml } from '../../utils/formatters.js';

let currentTab = 'ranking';
let selectedTurnoId = '';
let selectedTurnoTipo = '';

export function renderReportesSkeleton() {
  return `
    <div class="space-y-8 pb-10">
      <header>
        <h1 class="text-3xl font-black text-[#2d221b] tracking-tighter">Reportes de Gestión</h1>
        <p class="text-sm font-medium text-[#705f52] mt-1">Análisis de rendimiento, utilidades y control específico.</p>
      </header>

      <div class="flex gap-2 p-1 bg-white/50 rounded-2xl w-fit border border-borde shadow-sm">
        <button class="tab-btn px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${currentTab === 'ranking' ? 'bg-cafe text-white shadow-md' : 'text-cafe/60 hover:bg-white'}" data-tab="ranking">Ranking</button>
        <button class="tab-btn px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${currentTab === 'utilidad' ? 'bg-cafe text-white shadow-md' : 'text-cafe/60 hover:bg-white'}" data-tab="utilidad">Utilidad Mensual</button>
        <button class="tab-btn px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${currentTab === 'cigarros' ? 'bg-cafe text-white shadow-md' : 'text-cafe/60 hover:bg-white'}" data-tab="cigarros">Control Cigarros</button>
      </div>

      <div id="reports-content">
        <div class="panel h-96 animate-pulse bg-white/50"></div>
      </div>
    </div>
  `;
}

async function renderRanking() {
  const container = document.querySelector('#reports-content');
  try {
    const res = await getRankingProductos();
    const data = res.data;

    container.innerHTML = `
      <div class="panel bg-white shadow-sm overflow-hidden">
        <div class="p-6 border-b border-borde/30">
          <h2 class="text-xl font-bold text-[#2d221b]">Productos Más Vendidos y Rentables</h2>
          <p class="text-xs text-cafe/50 mt-1">Comparando volumen de venta vs utilidad generada.</p>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead class="bg-crema/20 text-[10px] font-black uppercase tracking-widest text-cafe/60">
              <tr>
                <th class="px-6 py-4">Ranking</th>
                <th class="px-6 py-4">Producto</th>
                <th class="px-6 py-4 text-right">Uni. Vendidas</th>
                <th class="px-6 py-4 text-right">Venta Total</th>
                <th class="px-6 py-4 text-right">Utilidad Total</th>
                <th class="px-6 py-4 text-center">ROI Est.</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-borde/20 text-sm">
              ${data.map((p, i) => {
      const roi = ((p.total_utilidad / (p.total_venta - p.total_utilidad)) * 100).toFixed(1);
      return `
                <tr class="hover:bg-papel/10">
                  <td class="px-6 py-4 font-black text-cafe/30">#${i + 1}</td>
                  <td class="px-6 py-4 font-black text-[#2d221b]">${escapeHtml(p.nombre)}</td>
                  <td class="px-6 py-4 text-right font-bold text-cafe">${p.total_unidades}</td>
                  <td class="px-6 py-4 text-right font-bold text-cafe">${formatCurrency(p.total_venta)}</td>
                  <td class="px-6 py-4 text-right font-black text-verdeok">${formatCurrency(p.total_utilidad)}</td>
                  <td class="px-6 py-4 text-center">
                    <span class="badge bg-azulaviso/10 text-azulaviso font-black">${roi}%</span>
                  </td>
                </tr>
              `}).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (e) {
    container.innerHTML = `<div class="panel p-10 text-center text-rojoaviso font-bold bg-white italic">${e.message}</div>`;
  }
}

async function renderUtilidad() {
  const container = document.querySelector('#reports-content');
  try {
    const res = await getReporteUtilidadMensual();
    const data = res.data;

    container.innerHTML = `
      <div class="grid gap-6">
        <div class="panel bg-white p-8 border-t-4 border-t-verdeok shadow-sm">
          <h2 class="text-xl font-black text-[#2d221b] mb-8">Análisis de Utilidad Mensual</h2>
          <div class="space-y-6">
            ${data.map(m => {
      const perc = (m.utilidad_total / m.venta_total) * 100;
      return `
              <div>
                <div class="flex items-center justify-between mb-2">
                  <p class="text-sm font-black text-cafe uppercase tracking-widest">${m.mes}</p>
                  <div class="text-right">
                    <p class="text-lg font-black text-verdeok">${formatCurrency(m.utilidad_total)} <span class="text-xs text-cafe/30 font-normal">utilidad</span></p>
                    <p class="text-[10px] text-cafe/40 font-bold uppercase tracking-widest">Sobre ${formatCurrency(m.venta_total)} en ventas</p>
                  </div>
                </div>
                <div class="w-full bg-papel/30 h-3 rounded-full overflow-hidden">
                  <div class="bg-verdeok h-full rounded-full transition-all duration-1000" style="width: ${perc}%"></div>
                </div>
              </div>
            `}).join('')}
          </div>
        </div>
        
        <div class="panel p-6 bg-crema/10 border-2 border-dashed border-cafe/20 text-center">
          <p class="text-xs text-cafe/40 font-bold uppercase">Este reporte ayuda a calcular cuánto dinero líquido ganaste realmente restando el costo a la venta.</p>
        </div>
      </div>
    `;
  } catch (e) {
    container.innerHTML = `<div class="panel p-10 text-center text-rojoaviso font-bold bg-white italic">${e.message}</div>`;
  }
}

async function renderCigarros() {
  const container = document.querySelector('#reports-content');
  try {
    const filtros = selectedTurnoId
      ? { id_turno: selectedTurnoId }
      : (selectedTurnoTipo ? { tipo_turno: selectedTurnoTipo } : {});
    const [turnosRes, res] = await Promise.all([
      getTurnos(),
      getReporteCigarros(filtros)
    ]);
    const data = res.data;
    const turnos = turnosRes.data || [];
    const opcionesTurno = [
      { value: '', label: 'Hoy (turno actual)' },
      ...turnos.map(turno => ({
        value: String(turno.id),
        label: `Turno #${turno.id} · ${new Date(turno.fecha_apertura).toLocaleString('es-CL')}`
      }))
    ];

    container.innerHTML = `
      <div class="panel bg-white shadow-xl overflow-hidden border-t-4 border-t-azulaviso">
        <div class="p-6 border-b border-borde/30 flex items-center justify-between">
          <div>
            <h2 class="text-xl font-bold text-[#2d221b]">Control Específico de Tabacos</h2>
            <p class="text-xs text-cafe/50 mt-1">Seguimiento de ventas de cigarrillos por turno (no se venden sueltos).</p>
          </div>
          <div class="text-2xl">🚬</div>
        </div>
        <div class="px-6 pt-4 space-y-4">
          <div>
            <label class="text-[10px] font-black uppercase tracking-widest text-cafe/50">Filtrar por turno</label>
            <div class="mt-2 flex flex-wrap gap-3 items-center">
              <select id="cigarros-turno" class="h-10 px-4 rounded-xl border border-borde bg-white text-sm font-semibold text-cafe">
                ${opcionesTurno.map(op => `
                  <option value="${op.value}" ${op.value === String(selectedTurnoId) ? 'selected' : ''}>${escapeHtml(op.label)}</option>
                `).join('')}
              </select>
              <span class="text-[11px] text-cafe/50 font-bold">${selectedTurnoId ? `Turno seleccionado #${selectedTurnoId}` : 'Mostrando turno actual'}</span>
            </div>
          </div>
          <div>
            <label class="text-[10px] font-black uppercase tracking-widest text-cafe/50">Filtrar por tipo de turno</label>
            <div class="mt-2 flex flex-wrap gap-3 items-center">
              <select id="cigarros-turno-tipo" class="h-10 px-4 rounded-xl border border-borde bg-white text-sm font-semibold text-cafe">
                <option value="" ${selectedTurnoTipo === '' ? 'selected' : ''}>Todos</option>
                <option value="Mañana" ${selectedTurnoTipo === 'Mañana' ? 'selected' : ''}>Mañana</option>
                <option value="Tarde" ${selectedTurnoTipo === 'Tarde' ? 'selected' : ''}>Tarde</option>
                <option value="Unico" ${selectedTurnoTipo === 'Unico' ? 'selected' : ''}>Único</option>
              </select>
              <span class="text-[11px] text-cafe/50 font-bold">${selectedTurnoTipo ? `Tipo: ${escapeHtml(selectedTurnoTipo)}` : 'Todos los tipos de turno'}</span>
            </div>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead class="bg-crema/20 text-[10px] font-black uppercase tracking-widest text-cafe/60">
              <tr>
                <th class="px-6 py-4">Producto</th>
                <th class="px-6 py-4 text-center">Cant. Vendida</th>
                <th class="px-6 py-4 text-right">Recaudación Total</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-borde/20 text-sm">
              ${data.length ? data.map(p => `
                <tr class="hover:bg-papel/10">
                  <td class="px-6 py-4 font-black text-[#2d221b]">${escapeHtml(p.producto)}</td>
                  <td class="px-6 py-4 text-center font-bold text-azulaviso">${p.unidades_vendidas} uds</td>
                  <td class="px-6 py-4 text-right font-black text-cafe">${formatCurrency(p.total_recaudado)}</td>
                </tr>
              `).join('') : '<tr><td colspan="3" class="p-10 text-center italic text-cafe/30 uppercase font-black tracking-widest text-xs">No se han vendido cigarrillos en este turno</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;

    const selectTurno = document.querySelector('#cigarros-turno');
    if (selectTurno) {
      selectTurno.addEventListener('change', async (event) => {
        selectedTurnoId = event.target.value;
        if (selectedTurnoId) {
          selectedTurnoTipo = '';
        }
        await renderCigarros();
      });
    }

    const selectTurnoTipo = document.querySelector('#cigarros-turno-tipo');
    if (selectTurnoTipo) {
      selectTurnoTipo.addEventListener('change', async (event) => {
        selectedTurnoTipo = event.target.value;
        if (selectedTurnoTipo) {
          selectedTurnoId = '';
        }
        await renderCigarros();
      });
    }
  } catch (e) {
    container.innerHTML = `<div class="panel p-10 text-center text-rojoaviso font-bold bg-white italic">${e.message}</div>`;
  }
}

export async function hydrateReportesView() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(btn => {
    btn.addEventListener('click', async () => {
      currentTab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('bg-cafe', 'text-white', 'shadow-md');
        b.classList.add('text-cafe/60', 'hover:bg-white');
      });
      btn.classList.remove('text-cafe/60', 'hover:bg-white');
      btn.classList.add('bg-cafe', 'text-white', 'shadow-md');

      if (currentTab === 'ranking') await renderRanking();
      if (currentTab === 'utilidad') await renderUtilidad();
      if (currentTab === 'cigarros') await renderCigarros();
    });
  });

  // Carga inicial
  if (currentTab === 'ranking') await renderRanking();
  if (currentTab === 'utilidad') await renderUtilidad();
  if (currentTab === 'cigarros') await renderCigarros();
}
