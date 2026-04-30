import { getTurnos, cerrarTurno, getResumenTurno } from '../../services/shiftService.js';
import { getRetiros, registrarRetiro } from '../../services/withdrawalService.js';
import { getSession } from '../../state/sessionStore.js';
import { formatCurrency, escapeHtml } from '../../utils/formatters.js';
import { showNotification } from '../../utils/notifications.js';

export function renderCajaSkeleton() {
  return `
    <div class="h-full overflow-y-auto px-10 py-10 space-y-8 pb-20">
      <header class="flex items-center justify-between shrink-0">
        <div>
          <h1 class="text-3xl font-black text-[#2d221b] tracking-tighter">Mi Turno y Caja</h1>
          <p class="text-sm font-medium text-[#705f52] mt-1">Gestiona la apertura y cierre de tu terminal de venta.</p>
        </div>
        <button id="btn-volver-venta" class="px-10 h-16 bg-cafe text-white font-black uppercase tracking-widest text-[11px] shadow-2xl shadow-cafe/20 hover:bg-[#4a2f1d] transition-all flex items-center gap-4">
           <span class="text-2xl">⇠</span> Volver a Venta
        </button>
      </header>

      <div id="caja-content" class="grid gap-8">
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

            <div class="grid grid-cols-2 gap-4 mt-4 border-t border-cafe/10 pt-4">
              <div class="p-3 bg-papel rounded-xl text-center border border-cafe/5">
                <span class="text-[9px] font-black text-cafe/40 uppercase tracking-widest">Esperado</span>
                <p id="arqueo-esperado-modal" class="text-base font-black text-cafe mt-1">$0</p>
              </div>
              <div class="p-3 bg-papel rounded-xl text-center border border-cafe/5">
                <span class="text-[9px] font-black text-cafe/40 uppercase tracking-widest">Diferencia</span>
                <p id="arqueo-diferencia-modal" class="text-base font-black text-rojoaviso mt-1">$0</p>
              </div>
            </div>
          </div>
          
          <div class="space-y-4">
            <label class="block">
              <span class="text-xs font-black text-cafe/40 uppercase tracking-widest mb-2 block">Observaciones (Opcional)</span>
              <textarea id="obs-arqueo" class="field h-24 resize-none" placeholder="Indica si hubo alguna novedad en el turno..."></textarea>
            </label>
          </div>

          <div id="arqueo-message" class="hidden p-3 rounded-xl text-xs text-center font-bold"></div>

          <button type="submit" id="btn-finalizar-cierre" class="btn-primary w-full py-5 text-base shadow-xl bg-caramelo hover:bg-caramelo/90">Finalizar Turno y Cerrar Caja</button>
        </form>
      </div>
    </div>

    <!-- Modal de Retiro -->
    <div id="retiro-modal" class="hidden fixed inset-0 z-[100] flex items-center justify-center p-4 bg-tinta/60 backdrop-blur-md">
      <div class="panel w-full max-w-md bg-papel shadow-2xl border-4 border-white overflow-hidden animate-zoomIn">
        <div class="p-6 bg-rojoaviso text-white flex items-center justify-between">
          <h2 class="text-lg font-black uppercase tracking-tighter">Retiro de Efectivo</h2>
          <button id="cerrar-modal-retiro" class="text-white/60 hover:text-white text-2xl">&times;</button>
        </div>
        <form id="retiro-form" class="p-8 space-y-6">
          <label class="block space-y-2">
            <span class="text-[10px] font-black text-cafe/40 uppercase tracking-widest">Monto Retirado</span>
            <div class="relative">
              <span class="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-black text-cafe/20">$</span>
              <input id="monto-retiro" type="number" step="1" min="1" required class="field pl-12 text-3xl font-black text-cafe text-center h-20" placeholder="0">
            </div>
          </label>

          <label class="block space-y-2">
            <span class="text-[10px] font-black text-cafe/40 uppercase tracking-widest">Motivo</span>
            <input id="motivo-retiro" type="text" required class="field" placeholder="Ej: pago proveedores">
          </label>

          <label class="block space-y-2">
            <span class="text-[10px] font-black text-cafe/40 uppercase tracking-widest">DescripciÃ³n</span>
            <textarea id="descripcion-retiro" class="field h-24 resize-none" placeholder="Ej: pago de evercrisp"></textarea>
          </label>

          <div id="retiro-message" class="hidden p-3 rounded-xl text-xs text-center font-bold"></div>
          <button type="submit" id="btn-confirmar-retiro" class="btn-primary w-full py-5 text-base shadow-xl bg-rojoaviso hover:bg-rojoaviso/90">Registrar Retiro</button>
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
  const retiroModal = document.querySelector('#retiro-modal');
  const retiroForm = document.querySelector('#retiro-form');
  const btnCerrarRetiro = document.querySelector('#cerrar-modal-retiro');
  const retiroMessage = document.querySelector('#retiro-message');
  const backBtn = document.querySelector('#btn-volver-venta');
  let activeShift = null;

  if (backBtn) {
    backBtn.addEventListener('click', () => {
      const homeBtn = document.querySelector('.header-action-btn[data-route="dashboard"]') ||
        document.querySelector('img[src*="logo.png"]');
      if (homeBtn) homeBtn.click();
    });
  }

  function formatTicketDate(value) {
    if (!value) return '';
    return new Date(value).toLocaleString('es-CL');
  }

  async function imprimirTicketArqueo(resumen, observaciones) {
    if (!window.electronAPI?.printTicket || !resumen) return;

    const printerName = localStorage.getItem('selected_printer') || '';
    const result = await window.electronAPI.printTicket({
      tipo: 'arqueo',
      printer_name: printerName,
      cajero: resumen.cajero,
      fecha_inicio: formatTicketDate(resumen.fecha_inicio),
      fecha_termino: formatTicketDate(resumen.fecha_termino),
      monto_apertura: resumen.monto_apertura,
      ventas_efectivo: resumen.ventas_efectivo,
      ventas_tarjeta: resumen.ventas_tarjeta,
      ventas_transferencia: resumen.ventas_transferencia,
      monto_total: resumen.monto_total,
      esperado: resumen.esperado,
      declarado: resumen.declarado,
      diferencia: resumen.diferencia,
      cuadrado: resumen.cuadrado,
      observaciones
    });

    if (!result?.success) {
      const printError = result?.error || result?.message || 'No se pudo imprimir el ticket de cierre.';
      showNotification(`Caja cerrada, pero no se imprimio el arqueo: ${printError}`, 'error');
    }
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
        const openModal = document.querySelector('#open-shift-modal');
        if (openModal) {
          openModal.classList.remove('hidden');
          setTimeout(() => {
            document.querySelector('#monto-apertura-caja')?.focus();
          }, 200);
        }
        return;
      }

      let totalEfectivo = 0;
      let totalTarjeta = 0;
      let totalTransferencia = 0;
      let totalRetiros = 0;
      let retirosTurno = [];

      try {
        const resumenRes = await getResumenTurno(miTurno.id);
        if (resumenRes.success && resumenRes.data) {
          totalEfectivo = Number(resumenRes.data.total_efectivo) || 0;
          totalTarjeta = Number(resumenRes.data.total_tarjeta) || 0;
          totalTransferencia = Number(resumenRes.data.total_transferencia) || 0;
          totalRetiros = Number(resumenRes.data.total_retiros) || 0;
        }
      } catch (e) {
        console.error("Error al obtener resumen de turno:", e);
      }

      try {
        const retirosRes = await getRetiros({ id_turno: miTurno.id });
        if (retirosRes.success) {
          retirosTurno = retirosRes.data || [];
        }
      } catch (e) {
        console.error("Error al obtener retiros:", e);
      }

      const totalEsperadoEfectivo = Number(miTurno.monto_apertura) + totalEfectivo - totalRetiros;
      const retiroRows = retirosTurno.map((retiro) => `
        <div class="flex items-start justify-between gap-4 p-4 rounded-xl bg-papel/50 border border-borde/30">
          <div class="min-w-0">
            <p class="text-xs font-black text-cafe uppercase truncate">${escapeHtml(retiro.motivo)}</p>
            <p class="text-[10px] text-cafe/50 font-bold truncate">${escapeHtml(retiro.descripcion || 'Sin descripciÃ³n')}</p>
          </div>
          <div class="text-right shrink-0">
            <p class="text-sm font-black text-cafe">${formatCurrency(retiro.monto)}</p>
            <p class="text-[9px] text-cafe/35 font-bold">${new Date(retiro.fecha).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </div>
      `).join('');

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

              <div class="grid grid-cols-2 gap-4">
                <button id="btn-abrir-retiro" class="btn-primary bg-rojoaviso hover:bg-rojoaviso/90 shadow-xl shadow-rojoaviso/20 py-5 text-white font-bold">
                  Registrar Retiro
                </button>
                <button id="btn-preparar-cierre" class="btn-primary bg-verdeok hover:bg-verdeok/90 shadow-xl shadow-verdeok/20 py-5 text-white font-bold">
                  Cerrar Turno
                </button>
              </div>
            </div>
          </section>

          <!-- Resumen Temporal -->
          <section class="panel p-8 bg-cafe text-white border-none shadow-2xl overflow-hidden relative">
            <div class="absolute -right-10 -bottom-10 text-[180px] text-white/5 font-black uppercase pointer-events-none select-none">BI</div>
            <div class="relative z-10 h-full flex flex-col">
              <h3 class="text-xl font-black uppercase tracking-tighter mb-8">Ventas de este Turno</h3>
              <div class="space-y-6 flex-1">
                 <div class="grid grid-cols-4 gap-4">
                    <div class="p-4 rounded-xl bg-white/5 border border-white/10">
                       <p class="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Efectivo</p>
                       <p class="text-xl font-black tracking-tighter text-white">${formatCurrency(totalEfectivo)}</p>
                    </div>
                    <div class="p-4 rounded-xl bg-white/5 border border-white/10">
                       <p class="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Tarjeta</p>
                       <p class="text-xl font-black tracking-tighter text-[#f8efe1]">${formatCurrency(totalTarjeta)}</p>
                    </div>
                    <div class="p-4 rounded-xl bg-white/5 border border-white/10">
                       <p class="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Transfer.</p>
                       <p class="text-xl font-black tracking-tighter text-[#f8efe1]">${formatCurrency(totalTransferencia)}</p>
                    </div>
                    <div class="p-4 rounded-xl bg-white/5 border border-white/10">
                       <p class="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Retiros</p>
                       <p class="text-xl font-black tracking-tighter text-[#f6d7ad]">${formatCurrency(-totalRetiros)}</p>
                    </div>
                 </div>

                 <div class="p-4 rounded-xl bg-white/10 border border-white/20 mt-4">
                    <p class="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-1">Total Efectivo a Rendir</p>
                    <p class="text-3xl font-black tracking-tighter text-[#f6d7ad]">${formatCurrency(totalEsperadoEfectivo)}</p>
                    <p class="text-[10px] text-white/35 font-bold mt-1">Apertura + efectivo - retiros</p>
                 </div>

              </div>
            </div>
          </section>
        </div>

        <!-- Historial de Retiros -->
        <section class="panel p-6 bg-white border border-borde/20 shadow-md relative overflow-hidden mt-8">
          <div class="flex items-center justify-between gap-4 mb-4">
            <div>
              <h3 class="text-sm font-black text-cafe uppercase tracking-widest">Retiros del Turno</h3>
              <p class="text-xs text-cafe/50 font-medium">Historial de dinero retirado durante la caja actual.</p>
            </div>
            <p class="text-lg font-black text-cafe">${formatCurrency(totalRetiros)}</p>
          </div>
          <div class="max-h-64 overflow-y-auto pr-2 space-y-2">
            ${retiroRows || '<div class="p-4 rounded-xl bg-papel/50 border border-borde/30 text-xs font-bold text-cafe/40 text-center">Sin retiros registrados</div>'}
          </div>
        </section>
        
        <!-- Sección de Actualizaciones -->
        <section class="panel p-6 bg-white border border-borde/20 shadow-md relative overflow-hidden mt-8 flex items-center justify-between">
          <div class="flex items-center gap-4">
            <span class="text-3xl">📦</span>
            <div>
              <h3 class="text-sm font-black text-cafe uppercase tracking-widest">Actualizaciones del Sistema</h3>
              <p class="text-xs text-cafe/50 font-medium">Revisa si hay nuevas versiones disponibles en el repositorio de GitHub.</p>
            </div>
          </div>
          <button id="btn-actualizar-github" class="px-6 py-3 bg-cafe hover:bg-[#4a2f1d] text-white text-xs font-black rounded-xl transition-all shadow-lg shadow-cafe/10 uppercase tracking-widest">
            📥 Buscar en GitHub
          </button>
        </section>
        <!-- Sección de Impresoras -->
        <section class="panel p-6 bg-white border border-borde/20 shadow-md relative overflow-hidden mt-6 flex flex-col gap-4">
          <div class="flex items-center gap-4">
            <span class="text-3xl">🖨️</span>
            <div>
              <h3 class="text-sm font-black text-cafe uppercase tracking-widest">Impresora de Tickets</h3>
              <p class="text-xs text-cafe/50 font-medium">Selecciona la impresora térmica predeterminada para el local.</p>
            </div>
          </div>
          <div class="flex gap-4 items-center mt-2">
            <select id="select-impresoras" class="w-full p-3 rounded-xl bg-papel/50 border border-borde/20 text-sm font-bold text-cafe focus:outline-none focus:ring-2 focus:ring-cafe/30">
              <option value="">Detectando impresoras...</option>
            </select>
            <button id="btn-guardar-impresora" class="px-6 py-3 bg-verdeok hover:bg-verdeok/90 text-white text-xs font-black rounded-xl transition-all shadow-lg shadow-verdeok/10 uppercase tracking-widest">
              💾 Guardar
            </button>
          </div>
        </section>
      `;

      const btnActualizar = document.querySelector('#btn-actualizar-github');
      btnActualizar?.addEventListener('click', async () => {
        if (window.electronAPI && window.electronAPI.checkForUpdates) {
          btnActualizar.disabled = true;
          btnActualizar.textContent = 'Buscando/Instalando...';
          try {
            const res = await window.electronAPI.checkForUpdates();
            if (res.success) {
              // showNotification puede no estar importado directamente, usemos alert o confirm temporalmente, o ver si existe en el scope
              // En cajaView existe showNotification ya usado en la línea 337.
              showNotification('¡Verificando actualizaciones en segundo plano!', 'success');
            } else {
              showNotification('Error: ' + res.error, 'error');
              btnActualizar.disabled = false;
              btnActualizar.textContent = '📥 Buscar en GitHub';
            }
          } catch (e) {
             showNotification(e.message, 'error');
             btnActualizar.disabled = false;
             btnActualizar.textContent = '📥 Buscar en GitHub';
          }
        }
      });

      const selectImpresoras = document.querySelector('#select-impresoras');
      const btnGuardarImpresora = document.querySelector('#btn-guardar-impresora');
      const impresoraGuardada = localStorage.getItem('selected_printer') || '';

      if (window.electronAPI && window.electronAPI.getPrinters) {
        // Usar IIFE asíncrona para cargar impresoras
        (async () => {
          try {
            const printers = await window.electronAPI.getPrinters();
            selectImpresoras.innerHTML = '<option value="">-- Usar Predeterminada de Windows --</option>' + 
              printers.map(p => `
                <option value="${p.name}" ${p.name === impresoraGuardada ? 'selected' : ''}>${p.name}</option>
              `).join('');
          } catch (e) {
            console.error("Error cargando impresoras:", e);
            selectImpresoras.innerHTML = '<option value="">No se pudieron detectar impresoras</option>';
          }
        })();
      }

      btnGuardarImpresora?.addEventListener('click', () => {
        const seleccionada = selectImpresoras.value;
        localStorage.setItem('selected_printer', seleccionada);
        showNotification('Impresora guardada correctamente.', 'success');
      });

      document.querySelector('#btn-abrir-retiro')?.addEventListener('click', () => {
        retiroMessage?.classList.add('hidden');
        retiroForm?.reset();
        retiroModal?.classList.remove('hidden');
        setTimeout(() => document.querySelector('#monto-retiro')?.focus(), 100);
      });

      document.querySelector('#btn-preparar-cierre')?.addEventListener('click', () => {
        messageBox?.classList.add('hidden');
        
        // Cargar valores iniciales en el modal
        const modalEsperado = document.querySelector('#arqueo-esperado-modal');
        const modalDiferencia = document.querySelector('#arqueo-diferencia-modal');
        const inputMonto = document.querySelector('#monto-arqueo');
        
        if (modalEsperado) modalEsperado.textContent = formatCurrency(totalEsperadoEfectivo);
        if (modalDiferencia) modalDiferencia.textContent = formatCurrency(-totalEsperadoEfectivo);
        if (inputMonto) {
          inputMonto.value = '';
          inputMonto.focus();
        }

        // Listener para actualizar la diferencia en tiempo real
        inputMonto?.addEventListener('input', () => {
          const declarado = Number(inputMonto.value) || 0;
          const diff = declarado - totalEsperadoEfectivo;
          
          if (modalDiferencia) {
            modalDiferencia.textContent = formatCurrency(diff);
            
            if (diff === 0) {
              modalDiferencia.className = "text-base font-black text-verdeok mt-1";
            } else if (diff < 0) {
              modalDiferencia.className = "text-base font-black text-rojoaviso mt-1";
            } else {
              modalDiferencia.className = "text-base font-black text-verdeok mt-1";
            }
          }
        });

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

  btnCerrarRetiro?.addEventListener('click', () => {
    retiroModal?.classList.add('hidden');
    retiroMessage?.classList.add('hidden');
  });

  retiroForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const monto = Number(document.querySelector('#monto-retiro').value);
    const motivo = document.querySelector('#motivo-retiro').value;
    const descripcion = document.querySelector('#descripcion-retiro').value;
    const btn = document.querySelector('#btn-confirmar-retiro');

    if (!activeShift?.id) {
      retiroMessage.textContent = 'No se encontrÃ³ un turno abierto para registrar el retiro.';
      retiroMessage.className = 'p-3 rounded-xl text-xs text-center font-bold bg-rojoaviso/10 text-rojoaviso mb-4';
      retiroMessage.classList.remove('hidden');
      return;
    }

    try {
      btn.disabled = true;
      btn.textContent = 'Registrando...';

      await registrarRetiro({
        id_turno: activeShift.id,
        monto,
        motivo,
        descripcion
      });

      retiroMessage.textContent = 'Retiro registrado correctamente.';
      retiroMessage.className = 'p-3 rounded-xl text-xs text-center font-bold bg-verdeok/10 text-verdeok mb-4';
      retiroMessage.classList.remove('hidden');

      setTimeout(() => {
        retiroModal?.classList.add('hidden');
        retiroForm.reset();
        btn.disabled = false;
        btn.textContent = 'Registrar Retiro';
        loadStatus();
      }, 800);
    } catch (error) {
      retiroMessage.textContent = error.message;
      retiroMessage.className = 'p-3 rounded-xl text-xs text-center font-bold bg-rojoaviso/10 text-rojoaviso mb-4';
      retiroMessage.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Registrar Retiro';
    }
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
      await imprimirTicketArqueo(resumen, obs);

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
          
          const btnLogout = document.querySelector('#logout-button');
          if (btnLogout) btnLogout.click();
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

