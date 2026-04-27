import { getTurnos, cerrarTurno } from '../../services/shiftService.js';
import { getSession } from '../../state/sessionStore.js';
import { formatCurrency, escapeHtml } from '../../utils/formatters.js';
import { showNotification } from '../../utils/notifications.js';

export function renderCajaSkeleton() {
  return `
    <div class="px-10 py-10 space-y-8 pb-20">
      <header class="flex items-center justify-between shrink-0">
        <div>
          <h1 class="text-3xl font-black text-[#2d221b] tracking-tighter">Mi Turno y Caja</h1>
          <p class="text-sm font-medium text-[#705f52] mt-1">Gestiona la apertura y cierre de tu terminal de venta.</p>
        </div>
        <button id="btn-volver-venta" class="px-10 h-16 bg-cafe text-white font-black uppercase tracking-widest text-[11px] shadow-2xl shadow-cafe/20 hover:bg-[#4a2f1d] transition-all flex items-center gap-4">
           <span class="text-2xl">⇠</span> Volver a Venta
        </button>
      </header>

      <div id="caja-content" class="grid gap-8 overflow-hidden">
        <div class="panel h-64 animate-pulse bg-white/50 w-full"></div>
      </div>
    </div>

    <!-- Modal de Arqueo -->
    <div id="arqueo-modal" class="hidden fixed inset-0 z-[100] flex items-center justify-center p-4 bg-tinta/60 backdrop-blur-md">
      <div class="panel w-full max-w-md bg-papel shadow-2xl border-4 border-white overflow-hidden animate-zoomIn">
        <div class="p-6 bg-cafe text-white flex items-center justify-between">
          <h2 class="text-lg font-black uppercase tracking-tighter">Cierre de Caja (Arqueo)</h2>
          <button id="cerrar-modal-arqueo" class="text-white/60 hover:text-white text-2xl">&times;</button>
        </div>
        <form id="arqueo-form" class="p-8 space-y-6">
          <div class="p-4 bg-cafe/5 rounded-2xl border border-cafe/10">
            <p class="text-xs font-black text-cafe/40 uppercase tracking-widest mb-2 text-center">Conteo Físico</p>
            <div class="relative">
              <span class="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-cafe/30">$</span>
              <input id="monto-arqueo" type="number" step="1" required class="field pl-12 text-3xl font-black text-cafe text-center h-20" placeholder="0">
            </div>
          </div>
          
          <div class="space-y-4">
            <label class="block">
              <span class="text-xs font-black text-cafe/40 uppercase tracking-widest mb-2 block">Observaciones (Opcional)</span>
              <textarea id="obs-arqueo" class="field h-24 resize-none" placeholder="Indica si hubo alguna novedad en el turno..."></textarea>
            </label>
          </div>

          <div id="arqueo-message" class="hidden p-3 rounded-xl text-xs text-center font-bold"></div>

          <button type="submit" id="btn-finalizar-cierre" class="btn-primary w-full py-5 text-base shadow-xl bg-rojoaviso hover:bg-rojoaviso/90">Finalizar Turno y Cerrar Caja</button>
        </form>
      </div>
    </div>

    <!-- Modal de Apertura (Reutilizado) -->
    <div id="open-shift-modal" class="hidden fixed inset-0 z-[100] flex items-center justify-center p-4 bg-cafe/95 backdrop-blur-md">
      <div class="panel w-full max-w-md bg-papel shadow-2xl border-4 border-white overflow-hidden animate-zoomIn">
        <div class="p-6 bg-caramelo text-white flex items-center justify-between">
          <h2 class="text-lg font-black uppercase tracking-tighter">Abrir Nuevo Turno</h2>
          <button id="cerrar-modal-abrir" class="text-white/60 hover:text-white text-2xl">&times;</button>
        </div>
        <form id="open-shift-form" class="p-8 space-y-6">
           <div class="space-y-2">
              <label class="text-[10px] font-black text-cafe/30 uppercase tracking-[0.2em]">Fondo Inicial (Efectivo)</label>
              <div class="relative">
                <span class="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-cafe/20">$</span>
                <input id="monto-apertura-caja" type="number" step="1" required class="field pl-14 text-4xl font-black text-cafe text-center h-24" placeholder="0">
              </div>
           </div>
           <div class="space-y-4">
              <label class="block">
                <span class="text-xs font-black text-cafe/40 uppercase tracking-widest mb-2 block">Tipo de Turno</span>
                <select id="tipo-turno-caja" class="field">
                  <option value="Mañana">Mañana</option>
                  <option value="Tarde">Tarde</option>
                  <option value="Único" selected>Único</option>
                </select>
              </label>
           </div>
           <button type="submit" id="btn-confirmar-apertura" class="btn-primary w-full py-5 text-base shadow-xl bg-caramelo hover:bg-caramelo/90">Iniciar Jornada</button>
        </form>
      </div>
    </div>
  `;
}

export async function hydrateCajaView() {
  const container = document.querySelector('#caja-content');
  if (!container) return;

  const arqueoModal = document.querySelector('#arqueo-modal');
  const arqueoForm = document.querySelector('#arqueo-form');
  const btnCerrarModal = document.querySelector('#cerrar-modal-arqueo');
  const messageBox = document.querySelector('#arqueo-message');
  const backBtn = document.querySelector('#btn-volver-venta');
  let activeShift = null;

  if (backBtn) {
    backBtn.addEventListener('click', () => {
      const homeBtn = document.querySelector('.header-action-btn[data-route="dashboard"]') ||
        document.querySelector('img[src*="logo.png"]');
      if (homeBtn) homeBtn.click();
    });
  }

  async function loadStatus() {
    try {
      const session = getSession();
      const userId = session?.usuario?.id;
      const username = session?.usuario?.username;

      const response = await getTurnos({ estado: 'Abierto' });
      const miTurno = (response.data || []).find(t => t.id_usuario === userId);
      activeShift = miTurno || null;

      if (!miTurno) {
        container.innerHTML = `
          <div class="panel p-12 text-center bg-white flex flex-col items-center gap-6 border-dashed border-2 shadow-none">
            <span class="text-6xl grayscale opacity-30">🚪</span>
            <div class="space-y-2">
              <h2 class="text-2xl font-black text-cafe">Tu caja está cerrada</h2>
              <p class="text-sm text-cafe/50 font-medium">Debes abrir un turno para comenzar a vender.</p>
            </div>
            <button class="btn-primary px-10 py-4 shadow-xl shadow-cafe/20">Abrir Turno Ahora 🥐</button>
          </div>
        `;
        return;
      }

      container.innerHTML = `
        <div class="grid gap-8 lg:grid-cols-2">
          <!-- Info Turno -->
          <section class="panel p-8 bg-white border-t-8 border-t-verdeok shadow-2xl relative overflow-hidden group">
            <div class="absolute -right-10 -top-10 text-[180px] text-verdeok/5 font-black uppercase pointer-events-none select-none">ACT</div>
            <div class="relative z-10 space-y-8">
              <div class="flex items-center gap-4 border-b border-borde/20 pb-6">
                <div class="w-16 h-16 rounded-3xl bg-verdeok text-white flex items-center justify-center text-3xl shadow-xl shadow-verdeok/20">👤</div>
                <div>
                  <h3 class="text-2xl font-black text-[#2d221b] tracking-tighter">${escapeHtml(miTurno.nombre_usuario || username)}</h3>
                  <p class="text-xs font-bold text-verdeok uppercase tracking-widest">Turno Abierto • ${escapeHtml(miTurno.nombre_sucursal)}</p>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-6">
                <div class="p-4 rounded-2xl bg-crema/20 border border-borde/10">
                  <p class="text-[10px] font-black text-cafe/40 uppercase tracking-widest mb-1">Apertura</p>
                  <p class="text-lg font-black text-cafe">${new Date(miTurno.fecha_apertura).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</p>
                  <p class="text-[9px] font-bold text-cafe/30">${new Date(miTurno.fecha_apertura).toLocaleDateString()}</p>
                </div>
                <div class="p-4 rounded-2xl bg-crema/20 border border-borde/10">
                  <p class="text-[10px] font-black text-cafe/40 uppercase tracking-widest mb-1">Monto Inicial</p>
                  <p class="text-lg font-black text-cafe">${formatCurrency(miTurno.monto_apertura)}</p>
                </div>
              </div>

              <button id="btn-preparar-cierre" class="w-full btn-primary bg-rojoaviso hover:bg-rojoaviso/90 shadow-xl shadow-rojoaviso/10 py-5">
                Cerrar Turno Realizar Arqueo
              </button>
            </div>
          </section>

          <!-- Resumen Temporal -->
          <section class="panel p-8 bg-cafe text-white border-none shadow-2xl overflow-hidden relative">
            <div class="absolute -right-10 -bottom-10 text-[180px] text-white/5 font-black uppercase pointer-events-none select-none">BI</div>
            <div class="relative z-10 h-full flex flex-col">
              <h3 class="text-xl font-black uppercase tracking-tighter mb-8">Ventas de este Turno</h3>
              <div class="space-y-6 flex-1">
                 <div class="flex items-end justify-between">
                    <div>
                      <p class="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Venta Estimada</p>
                      <p class="text-4xl font-black tracking-tighter">***</p>
                    </div>
                 </div>
                 <p class="text-xs text-white/50 leading-relaxed italic">Por seguridad, el total exacto se calcula al cerrar el turno y realizar la conciliación.</p>
              </div>
            </div>
          </section>
        </div>
      `;

      document.querySelector('#btn-preparar-cierre')?.addEventListener('click', () => {
        messageBox?.classList.add('hidden');
        arqueoModal.classList.remove('hidden');
      });

    } catch (error) {
      container.innerHTML = `<div class="p-10 text-center text-rojoaviso font-bold">${error.message}</div>`;
    }
  }

  btnCerrarModal?.addEventListener('click', () => {
    arqueoModal.classList.add('hidden');
    messageBox?.classList.add('hidden');
  });

  arqueoForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const monto = Number(document.querySelector('#monto-arqueo').value);
    const obs = document.querySelector('#obs-arqueo').value;
    const btn = document.querySelector('#btn-finalizar-cierre');

    if (!activeShift?.id) {
      messageBox.textContent = 'No se encontró un turno abierto para cerrar.';
      messageBox.className = 'p-3 rounded-xl text-xs text-center font-bold bg-rojoaviso/10 text-rojoaviso mb-4';
      messageBox.classList.remove('hidden');
      return;
    }

    try {
      btn.disabled = true;
      btn.textContent = 'Procesando Cierre...';

      const response = await cerrarTurno({
        id_turno: activeShift.id,
        monto_cierre_efectivo_declarado: monto,
        observaciones: obs
      });

      const resumen = response.resumen;
      const detalle = resumen
        ? ` Esperado: ${formatCurrency(resumen.esperado)} | Declarado: ${formatCurrency(resumen.declarado)} | Diferencia: ${formatCurrency(resumen.diferencia)}`
        : '';

      messageBox.textContent = `¡Caja cerrada correctamente!${detalle}`;
      messageBox.className = 'p-3 rounded-xl text-xs text-center font-bold bg-verdeok/10 text-verdeok mb-4';
      messageBox.classList.remove('hidden');

      setTimeout(() => {
        arqueoModal.classList.add('hidden');
        arqueoForm.reset();
        messageBox.classList.add('hidden');
        btn.disabled = false;
        btn.textContent = 'Finalizar Turno y Cerrar Caja';
        loadStatus();
      }, 2000);

    } catch (error) {
      messageBox.textContent = error.message;
      messageBox.className = 'p-3 rounded-xl text-xs text-center font-bold bg-rojoaviso/10 text-rojoaviso mb-4';
      messageBox.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Finalizar Turno y Cerrar Caja';
    }
  });

  // Lógica para Abrir Turno desde Caja
  document.addEventListener('click', (e) => {
    if (e.target.innerText?.includes('Abrir Turno Ahora')) {
      document.querySelector('#open-shift-modal').classList.remove('hidden');
    }
  });

  document.querySelector('#cerrar-modal-abrir')?.addEventListener('click', () => {
    document.querySelector('#open-shift-modal').classList.add('hidden');
  });

  document.querySelector('#open-shift-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const monto = Number(document.querySelector('#monto-apertura-caja').value);
    const tipo = document.querySelector('#tipo-turno-caja').value;

    try {
      const { abrirTurno } = await import('../../services/shiftService.js');
      await abrirTurno({ tipo_turno: tipo, monto_apertura: monto });

      showNotification('¡TURNO ABIERTO!', 'success');
      document.querySelector('#open-shift-modal')?.classList.add('hidden');
      e.target.reset();
      loadStatus();
    } catch (err) {
      showNotification(err.message, 'error');
    }
  });

  await loadStatus();
}
