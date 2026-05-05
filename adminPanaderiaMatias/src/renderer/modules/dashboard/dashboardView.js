import { getDashboard } from '../../services/reportService.js';
import { formatCurrency, escapeHtml } from '../../utils/formatters.js';

export function renderDashboardSkeleton() {
  return `
    <div class="space-y-8 pb-10">
      <header class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-black text-[#2d221b] tracking-tighter">Resumen Ejecutivo</h1>
          <p class="text-sm font-medium text-[#705f52] mt-1">El pulso de Panadería Matias en tiempo real.</p>
        </div>
        <div class="flex items-center gap-2 px-4 py-2 bg-white rounded-2xl border border-borde shadow-sm">
          <span class="w-2 h-2 rounded-full bg-verdeok animate-pulse"></span>
          <span class="text-[10px] font-bold uppercase tracking-widest text-cafe/60">Sistema En Vivo</span>
        </div>
      </header>

      <div id="dashboard-content" class="space-y-8">
        <div class="grid gap-6 md:grid-cols-3">
          <div class="panel h-32 animate-pulse bg-white/50"></div>
          <div class="panel h-32 animate-pulse bg-white/50"></div>
          <div class="panel h-32 animate-pulse bg-white/50"></div>
        </div>
        <div class="panel h-80 animate-pulse bg-white/50"></div>
        <div class="grid gap-6 md:grid-cols-2">
          <div class="panel h-64 animate-pulse bg-white/50"></div>
          <div class="panel h-64 animate-pulse bg-white/50"></div>
        </div>
      </div>
    </div>
  `;
}

export async function hydrateDashboardView() {
  const container = document.querySelector('#dashboard-content');
  if (!container) return;

  const renderDashboard = async () => {
    try {
      const response = await getDashboard();
      const data = response.data;
  const { kpis, alertasStock, ultimasVentas, graficoVentas, graficoMensual } = data;

    // Generar gráfico SVG simple
  const maxVenta = Math.max(...graficoVentas.map(d => d.total), 100000);
    const chartHeight = 120;
    const bars = graficoVentas.map((d, i) => {
      const h = (d.total / maxVenta) * chartHeight;
      const x = i * (100 / 6);
      return `
        <div class="flex flex-col items-center justify-end h-full group" style="width: ${100 / 7}%">
          <div class="relative w-full px-2 flex flex-col items-center justify-end h-full">
            <div class="absolute -top-6 opacity-0 group-hover:opacity-100 transition-opacity bg-cafe text-white text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap z-10">
              ${formatCurrency(d.total)}
            </div>
            <div class="w-full bg-cafe/10 rounded-t-lg transition-all duration-500 hover:bg-cafe/30" style="height: ${h}px"></div>
          </div>
          <p class="mt-4 text-[10px] font-bold text-cafe/40 uppercase tracking-tighter">
            ${new Date(d.dia).toLocaleDateString('es-CL', { weekday: 'short' })}
          </p>
        </div>
      `;
    }).join('');

    const monthlyMax = Math.max(...(graficoMensual || []).map(d => d.total), 100000);
    const monthlyBars = (graficoMensual || []).map((d) => {
      const h = (d.total / monthlyMax) * chartHeight;
      return `
        <div class="flex flex-col items-center justify-end h-full group" style="width: 6%">
          <div class="relative w-full px-1 flex flex-col items-center justify-end h-full">
            <div class="absolute -top-6 opacity-0 group-hover:opacity-100 transition-opacity bg-caramelo text-white text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap z-10">
              ${formatCurrency(d.total)}
            </div>
            <div class="w-full bg-caramelo/10 rounded-t-lg transition-all duration-500 hover:bg-caramelo/30" style="height: ${h}px"></div>
          </div>
          <p class="mt-2 text-[9px] font-bold text-cafe/30 uppercase tracking-tighter">${new Date(d.dia).getDate()}</p>
        </div>
      `;
    }).join('');

      container.innerHTML = `
      <!-- KPIs -->
      <div class="grid gap-6 md:grid-cols-4">
        <article class="panel p-6 bg-white border-b-4 border-b-cafe/20">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-2xl bg-crema flex items-center justify-center text-2xl">💰</div>
            <div>
              <p class="text-[10px] font-black uppercase tracking-[0.2em] text-cafe/40">Ventas del Día</p>
              <p class="text-2xl font-black text-cafe">${formatCurrency(kpis.ventasTotales)}</p>
            </div>
          </div>
        </article>

        <article class="panel p-6 bg-white border-b-4 border-b-caramelo/20">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-2xl bg-crema flex items-center justify-center text-2xl">🗓️</div>
            <div>
              <p class="text-[10px] font-black uppercase tracking-[0.2em] text-cafe/40">Ventas del Mes</p>
              <p class="text-2xl font-black text-caramelo">${formatCurrency(kpis.ventasMensuales)}</p>
              <p class="text-[10px] font-bold text-cafe/40 uppercase tracking-[0.2em]">${kpis.transaccionesMensuales || 0} transacciones</p>
            </div>
          </div>
        </article>

        <article class="panel p-6 bg-white border-b-4 border-b-verdeok/20">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-2xl bg-crema flex items-center justify-center text-2xl">📈</div>
            <div>
              <p class="text-[10px] font-black uppercase tracking-[0.2em] text-cafe/40">Utilidad Bruta</p>
              <p class="text-2xl font-black text-verdeok">${formatCurrency(kpis.utilidadEstimada)}</p>
            </div>
          </div>
        </article>

        <article class="panel p-6 bg-white border-b-4 border-b-azulaviso/20">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-2xl bg-crema flex items-center justify-center text-2xl">📑</div>
            <div>
              <p class="text-[10px] font-black uppercase tracking-[0.2em] text-cafe/40">Transacciones</p>
              <p class="text-2xl font-black text-azulaviso">${kpis.transacciones}</p>
            </div>
          </div>
        </article>
      </div>

      <!-- Gráfico de Ventas Semanal -->
      <section class="panel p-8 bg-white">
        <div class="flex items-center justify-between mb-10">
          <div>
            <h2 class="text-xl font-black text-[#2d221b]">Rendimiento Semanal</h2>
            <p class="text-xs text-[#705f52]">Comparativa de ventas brutas de los últimos 7 días.</p>
          </div>
        </div>
        <div class="flex items-end justify-between h-40 border-b border-borde/50 pb-2">
          ${bars || '<p class="w-full text-center text-cafe/20 italic pb-10">Sin datos históricos suficientes.</p>'}
        </div>
      </section>

      <!-- Gráfico de Ventas Mensual -->
      <section class="panel p-8 bg-white">
        <div class="flex items-center justify-between mb-10">
          <div>
            <h2 class="text-xl font-black text-[#2d221b]">Ventas del Mes</h2>
            <p class="text-xs text-[#705f52]">Ventas diarias del mes en curso.</p>
          </div>
        </div>
        <div class="flex items-end justify-between h-40 border-b border-borde/50 pb-2">
          ${monthlyBars || '<p class="w-full text-center text-cafe/20 italic pb-10">Sin datos del mes.</p>'}
        </div>
      </section>

  <div class="grid gap-6 md:grid-cols-2">
        <!-- Alertas de Stock -->
        <section class="panel p-6 bg-white">
          <div class="flex items-center justify-between mb-6 border-b border-borde/30 pb-4">
            <h2 class="text-lg font-black text-[#2d221b]">Alertas de Stock</h2>
            <span class="badge bg-rojoaviso/10 text-rojoaviso text-[10px] font-black">${alertasStock.total} CRÍTICOS</span>
          </div>
          <div class="space-y-3">
            ${alertasStock.items.length ? alertasStock.items.map(item => `
              <div class="flex items-center justify-between p-3 rounded-xl bg-papel/50 border border-borde/20">
                <div>
                  <p class="text-sm font-bold text-[#2d221b]">${escapeHtml(item.nombre)}</p>
                  <p class="text-[10px] text-cafe/50 uppercase font-bold">Mínimo: ${item.stock_minimo} ${escapeHtml(item.unidad)}</p>
                </div>
                <div class="text-right">
                  <p class="text-sm font-black text-rojoaviso">${item.stock_actual}</p>
                  <p class="text-[10px] text-rojoaviso font-bold uppercase">En stock</p>
                </div>
              </div>
            `).join('') : '<p class="text-sm text-verdeok italic text-center py-6 font-bold">✅ Todos los niveles están normales.</p>'}
          </div>
        </section>

        <!-- Últimos Movimientos -->
        <section class="panel p-6 bg-white">
          <div class="flex items-center justify-between mb-6 border-b border-borde/30 pb-4">
            <h2 class="text-lg font-black text-[#2d221b]">Últimas Ventas</h2>
          </div>
          <div class="space-y-3">
            ${ultimasVentas.length ? ultimasVentas.map(venta => `
              <div class="flex items-center justify-between p-3 rounded-xl bg-papel/50 border border-borde/20">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-lg bg-verdeok/10 text-verdeok flex items-center justify-center font-bold text-[10px]">#${venta.id}</div>
                  <div>
                    <p class="text-sm font-bold text-[#2d221b]">${formatCurrency(venta.total_venta)}</p>
                    <p class="text-[10px] text-cafe/50 font-bold uppercase">${new Date(venta.fecha).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
                <span class="text-[10px] font-bold text-cafe/30">ID USUARIO: ${venta.id_usuario}</span>
              </div>
            `).join('') : '<p class="text-sm text-cafe/30 italic text-center py-6">Sin movimientos recientes.</p>'}
          </div>
        </section>
      </div>
    </div>
  `;
    } catch (error) {
      console.error('Error dashboard:', error);
      container.innerHTML = `
      <div class="panel p-8 text-center bg-white border-rojoaviso/20">
        <p class="text-rojoaviso font-bold">Error de sincronización</p>
        <p class="text-sm text-[#7b6859] mt-2">${escapeHtml(error.message)}</p>
      </div>
    `;
    }
  };

  await renderDashboard();
  if (window._dashboardInterval) {
    clearInterval(window._dashboardInterval);
  }
  window._dashboardInterval = setInterval(renderDashboard, 30000);
}
