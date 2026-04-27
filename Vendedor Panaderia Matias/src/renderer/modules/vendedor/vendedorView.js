import { getDashboard } from '../../services/reportService.js';
import { getSession } from '../../state/sessionStore.js';
import { formatCurrency, escapeHtml } from '../../utils/formatters.js';

export function renderVendedorSkeleton() {
    const session = getSession();
    const username = session?.usuario?.username || 'Vendedor';

    return `
    <div class="space-y-8 pb-10">
      <header class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-black text-[#2d221b] tracking-tighter">Panel de Ventas</h1>
          <p class="text-sm font-medium text-[#705f52] mt-1">¡Hola, ${escapeHtml(username)}! Revisa tu actividad del día.</p>
        </div>
        <div class="flex items-center gap-2 px-4 py-2 bg-white rounded-2xl border border-borde shadow-sm">
          <span class="w-2 h-2 rounded-full bg-verdeok animate-pulse"></span>
          <span class="text-[10px] font-bold uppercase tracking-widest text-cafe/60">Sistema Conectado</span>
        </div>
      </header>

      <div id="vendedor-content" class="space-y-8">
        <div class="grid gap-6 md:grid-cols-2">
          <div class="panel h-32 animate-pulse bg-white/50"></div>
          <div class="panel h-32 animate-pulse bg-white/50"></div>
        </div>
        <div class="grid gap-6 md:grid-cols-2">
          <div class="panel h-64 animate-pulse bg-white/50"></div>
          <div class="panel h-64 animate-pulse bg-white/50"></div>
        </div>
      </div>
    </div>
  `;
}

export async function hydrateVendedorView() {
    const container = document.querySelector('#vendedor-content');
    if (!container) return;

    try {
        const session = getSession();
        const userId = session?.usuario?.id;
        const response = await getDashboard();
        const data = response.data;

        // Filtramos para solo ver info relevante al vendedor si es necesario, 
        // aunque kpis.ventasTotales suele ser global. En el futuro se puede pedir KPI personal al backend.
        const { kpis, alertasStock, ultimasVentas } = data;

        // Filtramos las últimas ventas para que el vendedor solo vea las suyas (si el ID coincide)
        // Nota: El backend actualmente devuelve id_usuario en cada venta.
        const misVentas = ultimasVentas.filter(v => v.id_usuario === userId);

        container.innerHTML = `
      <div class="grid gap-6 md:grid-cols-2">
        <article class="panel p-6 bg-white border-b-4 border-b-cafe/20">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-2xl bg-crema flex items-center justify-center text-2xl">💰</div>
            <div>
              <p class="text-[10px] font-black uppercase tracking-[0.2em] text-cafe/40">Total Ventas Global (Hoy)</p>
              <p class="text-2xl font-black text-cafe">${formatCurrency(kpis.ventasTotales)}</p>
            </div>
          </div>
        </article>

        <article class="panel p-6 bg-white border-b-4 border-b-azulaviso/20">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-2xl bg-crema flex items-center justify-center text-2xl">🛍️</div>
            <div>
              <p class="text-[10px] font-black uppercase tracking-[0.2em] text-cafe/40">Tus Transacciones</p>
              <p class="text-2xl font-black text-azulaviso">${misVentas.length}</p>
            </div>
          </div>
        </article>
      </div>

      <div class="grid gap-6 md:grid-cols-2">
        <!-- Stock Crítico -->
        <section class="panel p-6 bg-white">
          <div class="flex items-center justify-between mb-6 border-b border-borde/30 pb-4">
            <h2 class="text-lg font-black text-[#2d221b]">⚠️ Reponer Stock</h2>
            <span class="badge bg-rojoaviso/10 text-rojoaviso text-[10px] font-black">${alertasStock.total} AVISOS</span>
          </div>
          <div class="space-y-3">
            ${alertasStock.items.slice(0, 5).map(item => `
              <div class="flex items-center justify-between p-3 rounded-xl bg-papel/50 border border-borde/20">
                <p class="text-sm font-bold text-[#2d221b]">${escapeHtml(item.nombre)}</p>
                <p class="text-sm font-black text-rojoaviso">${item.stock_actual} <span class="text-[9px] font-bold">${item.unidad}</span></p>
              </div>
            `).join('')}
          </div>
        </section>

        <!-- Tus Últimos Tickets -->
        <section class="panel p-6 bg-white">
          <div class="flex items-center justify-between mb-6 border-b border-borde/30 pb-4">
            <h2 class="text-lg font-black text-[#2d221b]">Tus últimas ventas</h2>
          </div>
          <div class="space-y-3">
            ${misVentas.length ? misVentas.map(venta => `
              <div class="flex items-center justify-between p-3 rounded-xl bg-papel/50 border border-borde/20">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-lg bg-verdeok/10 text-verdeok flex items-center justify-center font-black text-[10px]">#${venta.id}</div>
                  <div>
                    <p class="text-sm font-bold text-[#2d221b]">${formatCurrency(venta.total_venta)}</p>
                    <p class="text-[10px] text-cafe/50 font-bold uppercase">${new Date(venta.fecha).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              </div>
            `).join('') : '<p class="text-sm text-cafe/30 italic text-center py-6">Aún no has registrado ventas hoy.</p>'}
          </div>
        </section>
      </div>

      <!-- Accesos Rápidos -->
      <section class="panel p-8 bg-cafe/5 border-cafe/10">
        <h2 class="text-base font-black text-cafe mb-6 uppercase tracking-widest text-center">Acciones Rápidas</h2>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button data-route-vendedor="productos" class="p-4 bg-white rounded-2xl shadow-sm border border-borde flex flex-col items-center gap-2 hover:scale-105 transition-transform">
            <span class="text-2xl">🥖</span>
            <span class="text-[10px] font-black uppercase text-cafe/60">Ver Precios</span>
          </button>
          <button data-route-vendedor="caja" class="p-4 bg-white rounded-2xl shadow-sm border border-borde flex flex-col items-center gap-2 hover:scale-105 transition-transform">
            <span class="text-2xl">💰</span>
            <span class="text-[10px] font-black uppercase text-cafe/60">Mi Turno</span>
          </button>
          <button data-route-vendedor="ventas" class="p-4 bg-white rounded-2xl shadow-sm border border-borde flex flex-col items-center gap-2 hover:scale-105 transition-transform">
            <span class="text-2xl">🧾</span>
            <span class="text-[10px] font-black uppercase text-cafe/60">Tickets</span>
          </button>
          <button class="p-4 bg-white rounded-2xl shadow-sm border border-borde flex flex-col items-center gap-2 opacity-50 cursor-not-allowed">
            <span class="text-2xl">❓</span>
            <span class="text-[10px] font-black uppercase text-cafe/60">Ayuda</span>
          </button>
        </div>
      </section>
    `;

        // Eventos de botones rápidos
        container.querySelectorAll('[data-route-vendedor]').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.dataset.routeVendedor;
                const navBtn = document.querySelector(`[data-route="${target}"]`);
                if (navBtn) navBtn.click();
            });
        });

    } catch (error) {
        console.error('Error dashboard vendedor:', error);
        container.innerHTML = `<p class="p-8 text-center text-rojoaviso font-bold">Error al cargar datos.</p>`;
    }
}
