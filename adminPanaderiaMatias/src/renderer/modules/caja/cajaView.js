import { getTurnos } from '../../services/shiftService.js';
import { getSession } from '../../state/sessionStore.js';
import { formatCurrency, escapeHtml } from '../../utils/formatters.js';

export function renderCajaSkeleton() {
  return `
    <div class="space-y-8 pb-10">
      <header>
        <h1 class="text-3xl font-black text-[#2d221b] tracking-tighter">Control de Caja y Turnos</h1>
        <p class="text-sm font-medium text-[#705f52] mt-1">Monitoreo de actividad de vendedores y estado de turnos.</p>
      </header>

      <div id="caja-content" class="grid gap-8">
        <!-- Esqueleto de carga -->
        <div class="grid gap-6 lg:grid-cols-2">
          <div class="panel h-64 animate-pulse bg-white/50"></div>
          <div class="panel h-64 animate-pulse bg-white/50"></div>
        </div>
      </div>
    </div>
  `;
}

export async function hydrateCajaView() {
  const container = document.querySelector('#caja-content');
  if (!container) return;

  try {
    const session = getSession();
    const isAdmin = session?.usuario?.rol === 'Admin';
    const response = await getTurnos();
    const turnos = response.data || [];

    const activos = turnos.filter(t => t.estado === 'Abierto');
    const historial = turnos.filter(t => t.estado === 'Cerrado');

    container.innerHTML = `
      <div class="grid gap-8 ${isAdmin ? 'lg:grid-cols-2' : ''} lg:items-start">
        
        <!-- Monitor de Turnos Activos -->
        <section class="panel p-6 bg-white shadow-sm border-t-4 border-t-verdeok">
          <div class="flex items-center justify-between mb-8 border-b border-borde/30 pb-4">
            <h2 class="text-xl font-black text-[#2d221b]">Monitor de Turnos</h2>
            <span class="badge bg-verdeok/10 text-verdeok font-black tracking-tighter">${activos.length} ACTIVOS</span>
          </div>
          
          <div class="space-y-4">
            ${activos.length ? activos.map(t => `
              <div class="p-5 rounded-2xl bg-papel/30 border border-borde/20 relative overflow-hidden group">
                <div class="absolute top-0 right-0 p-2 opacity-20 group-hover:opacity-100 transition-opacity">ACTIVO</div>
                <div class="flex items-center gap-4">
                  <div class="w-12 h-12 rounded-xl bg-cafe text-white flex items-center justify-center font-bold shadow-md">
                    ${t.username.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p class="text-base font-black text-[#2d221b]">${escapeHtml(t.nombre_usuario)}</p>
                    <p class="text-[10px] font-bold text-cafe/50 uppercase tracking-widest">${escapeHtml(t.nombre_sucursal)} - ${t.tipo_turno}</p>
                  </div>
                </div>
                <div class="mt-4 pt-4 border-t border-borde/10 grid grid-cols-2 gap-4">
                  <div>
                    <p class="text-[10px] font-bold text-cafe/40 uppercase">Apertura</p>
                    <p class="text-sm font-black text-cafe">${new Date(t.fecha_apertura).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <div>
                    <p class="text-[10px] font-bold text-cafe/40 uppercase">Monto Inicial</p>
                    <p class="text-sm font-black text-cafe">${isAdmin ? formatCurrency(t.monto_apertura) : '***'}</p>
                  </div>
                </div>
              </div>
            `).join('') : `
              <div class="py-10 text-center bg-papel/20 rounded-2xl border-2 border-dashed border-borde">
                <p class="text-sm text-cafe/30 font-bold uppercase italic">No hay cajeros con turno abierto</p>
              </div>
            `}
          </div>
        </section>

        ${isAdmin ? `
        <!-- Auditoria de Cierres (Solo Admin) -->
        <section class="panel p-6 bg-white shadow-sm border-t-4 border-t-cafe">
          <div class="flex items-center justify-between mb-8 border-b border-borde/30 pb-4">
            <h2 class="text-xl font-black text-[#2d221b]">Auditoria de Cierres</h2>
            <p class="text-[10px] font-bold text-cafe/40 uppercase">Ultimos 15 cierres</p>
          </div>

          <div class="space-y-3">
            ${historial.length ? historial.slice(0, 15).map(t => {
      const diff = Number(t.diferencia_efectivo) || 0;
      const hasDiff = Math.abs(diff) > 0;
      return `
                <div class="flex items-center justify-between p-4 rounded-xl bg-papel/50 border border-borde/20">
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg ${hasDiff ? 'bg-rojoaviso' : 'bg-verdeok'} text-white flex items-center justify-center text-xs">
                      ${hasDiff ? '!' : 'OK'}
                    </div>
                    <div>
                      <p class="text-sm font-bold text-[#2d221b]">${escapeHtml(t.username)}</p>
                      <p class="text-[10px] text-cafe/50 font-bold uppercase">${new Date(t.fecha_cierre).toLocaleDateString()} ${new Date(t.fecha_cierre).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                  <div class="text-right">
                    <p class="text-sm font-black ${diff < 0 ? 'text-rojoaviso' : (diff > 0 ? 'text-azulaviso' : 'text-verdeok')}">
                      ${diff === 0 ? 'CUADRADO' : formatCurrency(diff)}
                    </p>
                    <p class="text-[10px] font-bold uppercase ${diff < 0 ? 'text-rojoaviso/50' : 'text-cafe/30'}">Diferencia</p>
                  </div>
                </div>
              `;
    }).join('') : '<p class="text-sm text-cafe/30 italic text-center py-6 font-bold uppercase tracking-widest">Sin cierres registrados recientemente</p>'}
          </div>
        </section>
        ` : ''}
      </div>
    `;
  } catch (error) {
    container.innerHTML = `
      <div class="panel p-8 text-center bg-white border-rojoaviso/20">
        <p class="text-rojoaviso font-bold text-lg">Error de Acceso a Turnos</p>
        <p class="text-sm text-[#7b6859] mt-2">${escapeHtml(error.message)}</p>
      </div>
    `;
  }
}
