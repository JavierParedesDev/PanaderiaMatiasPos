import { actualizarTrabajador, crearTrabajador, eliminarTrabajador, getConsumosPersonal, getTrabajadores, registrarPagoConsumo } from '../../services/staffConsumptionService.js';
import { escapeHtml, formatCurrency, formatDateTime } from '../../utils/formatters.js';

export function renderConsumoSkeleton() {
  return `
    <section class="space-y-8">
      <header class="flex items-start justify-between gap-6">
        <div>
          <h1 class="text-3xl font-black text-[#2d221b] tracking-tighter">Consumo de Trabajadores</h1>
          <p class="mt-2 text-sm text-[#705f52]">Controla el fiado interno de cada trabajador.</p>
        </div>
      </header>

      <div id="consumo-message" class="hidden rounded-xl px-4 py-3 text-sm font-bold"></div>

      <div class="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div class="space-y-6">
          <form id="trabajador-form" class="panel bg-white p-6 space-y-5">
          <div>
            <h2 class="text-lg font-black text-cafe uppercase tracking-tight">Crear Trabajador</h2>
            <p class="text-xs text-cafe/45 mt-1">Estos nombres apareceran en el POS para consumo interno.</p>
          </div>
          <label class="block space-y-2">
            <span class="text-[10px] font-black text-cafe/40 uppercase tracking-widest">Nombre</span>
            <input id="trabajador-nombre" class="field" required placeholder="Ej: Juan">
          </label>
          <label class="block space-y-2">
            <span class="text-[10px] font-black text-cafe/40 uppercase tracking-widest">Apellido</span>
            <input id="trabajador-apellido" class="field" required placeholder="Ej: Perez">
          </label>
          <button class="btn-primary w-full py-4" type="submit">Guardar Trabajador</button>
          </form>

          <section class="panel bg-white p-6">
            <div class="flex items-center justify-between mb-5">
              <div>
                <h2 class="text-lg font-black text-cafe uppercase tracking-tight">Trabajadores Registrados</h2>
                <p class="text-xs text-cafe/45 mt-1">Listado de trabajadores activos.</p>
              </div>
            </div>
            <div id="trabajadores-list" class="space-y-2">
              <div class="h-16 rounded-xl bg-papel animate-pulse"></div>
            </div>
          </section>
        </div>

        <section class="panel bg-white p-6">
          <div class="flex items-center justify-between mb-5">
            <div>
              <h2 class="text-lg font-black text-cafe uppercase tracking-tight">Saldos Pendientes</h2>
              <p class="text-xs text-cafe/45 mt-1">Total por trabajador pendiente de pago.</p>
            </div>
          </div>
          <div id="trabajadores-resumen" class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div class="h-24 rounded-xl bg-papel animate-pulse"></div>
          </div>
        </section>
      </div>

      <section class="panel bg-white p-6">
        <div class="flex items-center justify-between mb-5">
          <div>
            <h2 class="text-lg font-black text-cafe uppercase tracking-tight">Historial de Consumos</h2>
            <p class="text-xs text-cafe/45 mt-1">Detalle de productos cargados a cada trabajador.</p>
          </div>
        </div>
        <div id="consumos-list" class="space-y-3">
          <div class="h-20 rounded-xl bg-papel animate-pulse"></div>
        </div>
      </section>

      <div id="cuenta-modal" class="hidden fixed inset-0 z-[100] flex items-center justify-center p-4 bg-cafe/80 backdrop-blur-md">
        <div class="panel w-full max-w-4xl max-h-[88vh] bg-white p-0 overflow-hidden shadow-2xl flex flex-col">
          <div class="p-6 bg-cafe text-white flex items-center justify-between">
            <div>
              <h2 id="cuenta-title" class="text-xl font-black uppercase tracking-tight">Cuenta trabajador</h2>
              <p id="cuenta-subtitle" class="text-xs text-white/60 font-bold uppercase tracking-widest mt-1">Detalle de fiado interno</p>
            </div>
            <button id="cuenta-close" class="text-2xl text-white/60 hover:text-white">&times;</button>
          </div>
          <div class="grid gap-6 p-6 lg:grid-cols-[1fr_320px] min-h-0 flex-1 overflow-hidden">
            <div class="space-y-4 min-h-0 flex flex-col">
              <h3 class="text-sm font-black text-cafe uppercase tracking-widest">Detalle anotado</h3>
              <div id="cuenta-consumos" class="min-h-0 flex-1 overflow-y-auto space-y-3 pr-2"></div>
            </div>
            <aside class="min-h-0 overflow-y-auto pr-2 space-y-4">
              <div class="rounded-xl bg-papel/70 border border-borde/30 p-5">
                <p class="text-[10px] font-black text-cafe/35 uppercase tracking-widest">Saldo pendiente</p>
                <p id="cuenta-saldo" class="text-4xl font-black text-cafe mt-2">$0</p>
              </div>
              <form id="cuenta-pago-form" class="rounded-xl border border-borde/40 p-5 space-y-4">
                <div>
                  <h3 class="text-sm font-black text-cafe uppercase tracking-widest">Registrar pago</h3>
                  <p class="text-xs text-cafe/45 mt-1">Ingresa abono o paga el total pendiente.</p>
                </div>
                <label class="block space-y-2">
                  <span class="text-[10px] font-black text-cafe/40 uppercase tracking-widest">Monto</span>
                  <input id="cuenta-pago-monto" type="number" min="1" step="1" class="field" required placeholder="0">
                </label>
                <label class="block space-y-2">
                  <span class="text-[10px] font-black text-cafe/40 uppercase tracking-widest">Observacion</span>
                  <input id="cuenta-pago-observacion" class="field" placeholder="Ej: abono quincena">
                </label>
                <div class="grid grid-cols-2 gap-3">
                  <button id="cuenta-pagar-todo" type="button" class="rounded-xl bg-caramelo text-white text-xs font-black uppercase tracking-widest py-3">Pagar todo</button>
                  <button type="submit" class="rounded-xl bg-cafe text-white text-xs font-black uppercase tracking-widest py-3">Guardar pago</button>
                </div>
              </form>
              <div>
                <h3 class="text-sm font-black text-cafe uppercase tracking-widest mb-3">Pagos registrados</h3>
                <div id="cuenta-pagos" class="max-h-52 overflow-y-auto space-y-2 pr-2 pb-2"></div>
              </div>
            </aside>
          </div>
        </div>
      </div>

      <div id="worker-edit-modal" class="hidden fixed inset-0 z-[110] flex items-center justify-center p-4 bg-cafe/80 backdrop-blur-md">
        <div class="panel w-full max-w-lg bg-white p-0 overflow-hidden shadow-2xl">
          <div class="p-5 bg-cafe text-white flex items-center justify-between">
            <div>
              <h2 class="text-lg font-black uppercase tracking-tight">Editar trabajador</h2>
              <p class="text-xs text-white/60 font-bold uppercase tracking-widest mt-1">Actualiza nombre y apellido</p>
            </div>
            <button id="worker-edit-close" class="text-2xl text-white/60 hover:text-white">&times;</button>
          </div>
          <form id="worker-edit-form" class="p-6 space-y-4">
            <label class="block space-y-2">
              <span class="text-[10px] font-black text-cafe/40 uppercase tracking-widest">Nombre</span>
              <input id="worker-edit-nombre" class="field" required>
            </label>
            <label class="block space-y-2">
              <span class="text-[10px] font-black text-cafe/40 uppercase tracking-widest">Apellido</span>
              <input id="worker-edit-apellido" class="field" required>
            </label>
            <div class="flex items-center justify-end gap-3">
              <button id="worker-edit-cancel" type="button" class="rounded-xl border border-borde/40 px-4 py-2 text-xs font-black uppercase tracking-widest text-cafe/70">Cancelar</button>
              <button type="submit" class="rounded-xl bg-cafe text-white px-5 py-2 text-xs font-black uppercase tracking-widest">Guardar cambios</button>
            </div>
          </form>
        </div>
      </div>

      <div id="worker-delete-modal" class="hidden fixed inset-0 z-[120] flex items-center justify-center p-4 bg-cafe/80 backdrop-blur-md">
        <div class="panel w-full max-w-md bg-white p-0 overflow-hidden shadow-2xl">
          <div class="p-5 bg-cafe text-white flex items-center justify-between">
            <div>
              <h2 class="text-lg font-black uppercase tracking-tight">Eliminar trabajador</h2>
              <p class="text-xs text-white/60 font-bold uppercase tracking-widest mt-1">Acción irreversible</p>
            </div>
            <button id="worker-delete-close" class="text-2xl text-white/60 hover:text-white">&times;</button>
          </div>
          <div class="p-6 space-y-4">
            <p id="worker-delete-text" class="text-sm text-cafe/70 font-semibold">¿Seguro que deseas eliminar este trabajador?</p>
            <div class="flex items-center justify-end gap-3">
              <button id="worker-delete-cancel" type="button" class="rounded-xl border border-borde/40 px-4 py-2 text-xs font-black uppercase tracking-widest text-cafe/70">Cancelar</button>
              <button id="worker-delete-confirm" type="button" class="rounded-xl bg-rojoaviso text-white px-5 py-2 text-xs font-black uppercase tracking-widest">Eliminar</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

function showMessage(message, type = 'success') {
  const box = document.querySelector('#consumo-message');
  if (!box) return;
  box.textContent = message;
  box.className = `rounded-xl px-4 py-3 text-sm font-bold ${type === 'error' ? 'bg-rojoaviso/10 text-rojoaviso' : 'bg-verdeok/10 text-verdeok'}`;
  box.classList.remove('hidden');
}

function renderResumen(items = []) {
  const pendientes = items.filter((item) => Number(item.saldo_pendiente || 0) > 0);

  if (!pendientes.length) {
    return '<div class="rounded-xl border border-dashed border-borde p-6 text-center text-sm text-cafe/40 md:col-span-2 xl:col-span-3">No hay saldos pendientes.</div>';
  }

  return pendientes.map((item) => `
    <button type="button" class="worker-card rounded-xl border border-borde/40 bg-papel/50 p-4 text-left hover:border-cafe/40 hover:bg-papel transition-all" data-worker-id="${item.id}" data-worker-name="${escapeHtml(`${item.nombre} ${item.apellido}`)}" data-worker-saldo="${Number(item.saldo_pendiente || 0)}">
      <p class="text-sm font-black text-cafe uppercase truncate">${escapeHtml(item.nombre)} ${escapeHtml(item.apellido)}</p>
      <p class="text-[10px] font-black text-cafe/35 uppercase tracking-widest mt-1">Pendiente</p>
      <p class="text-2xl font-black text-cafe mt-2">${formatCurrency(item.saldo_pendiente)}</p>
      <p class="text-[10px] text-cafe/40 font-bold mt-1">${item.consumos_pendientes || 0} consumos · ${formatCurrency(item.total_pagos)} pagado</p>
    </button>
  `).join('');
}

function renderConsumos(items = [], options = {}) {
  if (!items.length) {
    return '<div class="rounded-xl border border-dashed border-borde p-8 text-center text-sm text-cafe/40">No hay consumos registrados.</div>';
  }

  return items.map((item) => {
    const detalle = Array.isArray(item.detalle) ? item.detalle : [];
    const compact = options.compactDetail;
    return `
      <article class="consumo-card rounded-xl border border-borde/40 bg-papel/40 p-4 ${compact ? 'cursor-pointer hover:border-cafe/40 transition-all' : ''}" data-consumo-id="${item.id}">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-sm font-black text-cafe uppercase">${escapeHtml(item.trabajador)}</p>
            <p class="text-[10px] text-cafe/45 font-bold uppercase tracking-widest">${formatDateTime(item.fecha)} · Cajero: ${escapeHtml(item.cajero || '-')}</p>
            ${compact ? '<p class="text-[10px] text-caramelo font-black uppercase tracking-widest mt-2">Presiona para ver detalle</p>' : ''}
          </div>
          <div class="text-right">
            <p class="text-lg font-black text-cafe">${formatCurrency(item.total)}</p>
            <p class="text-[10px] font-black text-caramelo uppercase">${escapeHtml(item.estado)}</p>
          </div>
        </div>
        <div class="consumo-detail ${compact ? 'hidden' : ''} mt-3 flex flex-wrap gap-2">
          ${detalle.map((producto) => `
            <span class="rounded-lg bg-white px-3 py-1 text-[10px] font-bold text-cafe/60 border border-borde/30">
              ${escapeHtml(producto.producto)} · ${Number(producto.cantidad).toLocaleString('es-CL')} · ${formatCurrency(producto.subtotal)}
            </span>
          `).join('')}
        </div>
      </article>
    `;
  }).join('');
}

function renderTrabajadores(items = []) {
  if (!items.length) {
    return '<div class="rounded-xl border border-dashed border-borde p-4 text-center text-sm text-cafe/40">No hay trabajadores registrados.</div>';
  }

  return items.map((item) => `
    <div class="flex items-center justify-between p-3 rounded-xl bg-papel/50 border border-borde/30">
      <div>
        <p class="text-sm font-black text-cafe uppercase">${escapeHtml(item.nombre)} ${escapeHtml(item.apellido || '')}</p>
        <p class="text-[10px] text-cafe/40 font-bold uppercase tracking-widest">ID: ${item.id}</p>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-[10px] font-bold uppercase ${String(item.activo) === 'false' || item.activo === 0 ? 'text-rojoaviso' : 'text-verdeok'}">
          ${String(item.activo) === 'false' || item.activo === 0 ? 'Inactivo' : 'Activo'}
        </span>
        <button type="button" class="rounded-lg border border-borde/40 px-2 py-1 text-[10px] font-black uppercase text-cafe/70" data-worker-edit="${item.id}" data-worker-nombre="${escapeHtml(item.nombre)}" data-worker-apellido="${escapeHtml(item.apellido || '')}">Editar</button>
        <button type="button" class="rounded-lg border border-rojoaviso/40 px-2 py-1 text-[10px] font-black uppercase text-rojoaviso" data-worker-delete="${item.id}">Eliminar</button>
      </div>
    </div>
  `).join('');
}

export async function hydrateConsumoView() {
  const resumen = document.querySelector('#trabajadores-resumen');
  const list = document.querySelector('#consumos-list');
  const workersList = document.querySelector('#trabajadores-list');
  const form = document.querySelector('#trabajador-form');
  const cuentaModal = document.querySelector('#cuenta-modal');
  const cuentaClose = document.querySelector('#cuenta-close');
  const cuentaTitle = document.querySelector('#cuenta-title');
  const cuentaSubtitle = document.querySelector('#cuenta-subtitle');
  const cuentaConsumos = document.querySelector('#cuenta-consumos');
  const cuentaPagos = document.querySelector('#cuenta-pagos');
  const cuentaSaldo = document.querySelector('#cuenta-saldo');
  const cuentaPagoForm = document.querySelector('#cuenta-pago-form');
  const cuentaPagoMonto = document.querySelector('#cuenta-pago-monto');
  const cuentaPagoObservacion = document.querySelector('#cuenta-pago-observacion');
  const cuentaPagarTodo = document.querySelector('#cuenta-pagar-todo');
  const workerEditModal = document.querySelector('#worker-edit-modal');
  const workerEditClose = document.querySelector('#worker-edit-close');
  const workerEditCancel = document.querySelector('#worker-edit-cancel');
  const workerEditForm = document.querySelector('#worker-edit-form');
  const workerEditNombre = document.querySelector('#worker-edit-nombre');
  const workerEditApellido = document.querySelector('#worker-edit-apellido');
  const workerDeleteModal = document.querySelector('#worker-delete-modal');
  const workerDeleteClose = document.querySelector('#worker-delete-close');
  const workerDeleteCancel = document.querySelector('#worker-delete-cancel');
  const workerDeleteConfirm = document.querySelector('#worker-delete-confirm');
  const workerDeleteText = document.querySelector('#worker-delete-text');
  let selectedWorkerId = null;
  let selectedWorkerSaldo = 0;
  let selectedEditWorkerId = null;
  let selectedDeleteWorkerId = null;

  async function load() {
    try {
      const [response, workersResponse] = await Promise.all([
        getConsumosPersonal({ estado: 'Pendiente' }),
        getTrabajadores()
      ]);
      resumen.innerHTML = renderResumen(response.resumen || []);
      list.innerHTML = renderConsumos(response.data || []);
      if (workersList) workersList.innerHTML = renderTrabajadores(workersResponse.data || []);
      bindWorkerActions();
      resumen.querySelectorAll('.worker-card').forEach((card) => {
        card.addEventListener('click', () => openCuenta(card.dataset.workerId, card.dataset.workerName, Number(card.dataset.workerSaldo || 0)));
      });
    } catch (error) {
      showMessage(error.message, 'error');
      resumen.innerHTML = '';
      list.innerHTML = '';
      if (workersList) workersList.innerHTML = '';
    }
  }

  function bindWorkerActions() {
    if (!workersList) return;
    workersList.querySelectorAll('[data-worker-edit]').forEach((button) => {
      button.addEventListener('click', () => {
        selectedEditWorkerId = button.dataset.workerEdit;
        workerEditNombre.value = button.dataset.workerNombre || '';
        workerEditApellido.value = button.dataset.workerApellido || '';
        workerEditModal.classList.remove('hidden');
      });
    });

    workersList.querySelectorAll('[data-worker-delete]').forEach((button) => {
      button.addEventListener('click', async () => {
        selectedDeleteWorkerId = button.dataset.workerDelete;
        if (!selectedDeleteWorkerId) return;
        const nombre = button.closest('div')?.querySelector('p')?.textContent || 'este trabajador';
        workerDeleteText.textContent = `¿Seguro que deseas eliminar a ${nombre}?`;
        workerDeleteModal.classList.remove('hidden');
      });
    });
  }

  function renderCuentaConsumos(items = []) {
    const pendientes = items.filter((item) => String(item.estado || '').toLowerCase() === 'pendiente');
    cuentaConsumos.innerHTML = renderConsumos(pendientes, { compactDetail: true });
    cuentaConsumos.querySelectorAll('.consumo-card').forEach((card) => {
      card.addEventListener('click', () => {
        card.querySelector('.consumo-detail')?.classList.toggle('hidden');
      });
    });
  }

  function renderCuentaPagos(items = []) {
    cuentaPagos.innerHTML = items.length
      ? items.map((pago) => `
          <div class="rounded-xl bg-papel/60 border border-borde/30 p-3">
            <div class="flex items-center justify-between gap-3">
              <p class="text-sm font-black text-cafe">${formatCurrency(pago.monto)}</p>
              <p class="text-[10px] text-cafe/40 font-bold">${formatDateTime(pago.fecha)}</p>
            </div>
            <p class="text-[10px] text-cafe/45 font-bold mt-1">${escapeHtml(pago.observacion || 'Pago registrado')}</p>
          </div>
        `).join('')
      : '<div class="rounded-xl border border-dashed border-borde p-4 text-center text-xs text-cafe/40">Sin pagos registrados.</div>';
  }

  async function openCuenta(idTrabajador, nombre, saldo) {
    selectedWorkerId = idTrabajador;
    selectedWorkerSaldo = saldo;
    cuentaTitle.textContent = nombre;
    cuentaSubtitle.textContent = 'Detalle de fiado interno';
    cuentaSaldo.textContent = formatCurrency(saldo);
    cuentaPagoMonto.value = '';
    cuentaPagoObservacion.value = '';
    cuentaConsumos.innerHTML = '<div class="h-20 rounded-xl bg-papel animate-pulse"></div>';
    cuentaPagos.innerHTML = '<div class="h-14 rounded-xl bg-papel animate-pulse"></div>';
    cuentaModal.classList.remove('hidden');

    try {
      const response = await getConsumosPersonal({ id_trabajador: idTrabajador, estado: 'Pendiente' });
      renderCuentaConsumos(response.data || []);
      renderCuentaPagos(response.pagos || []);
    } catch (error) {
      showMessage(error.message, 'error');
    }
  }

  cuentaClose?.addEventListener('click', () => {
    cuentaModal.classList.add('hidden');
  });

  function closeEditModal() {
    workerEditModal.classList.add('hidden');
    selectedEditWorkerId = null;
  }

  function closeDeleteModal() {
    workerDeleteModal.classList.add('hidden');
    selectedDeleteWorkerId = null;
  }

  workerEditClose?.addEventListener('click', closeEditModal);
  workerEditCancel?.addEventListener('click', closeEditModal);
  workerDeleteClose?.addEventListener('click', closeDeleteModal);
  workerDeleteCancel?.addEventListener('click', closeDeleteModal);

  cuentaPagarTodo?.addEventListener('click', () => {
    cuentaPagoMonto.value = Math.max(0, Math.round(selectedWorkerSaldo || 0));
    cuentaPagoObservacion.value = 'Pago total';
  });

  cuentaPagoForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedWorkerId) return;

    try {
      await registrarPagoConsumo(selectedWorkerId, {
        monto: Number(cuentaPagoMonto.value),
        observacion: cuentaPagoObservacion.value
      });
      showMessage('Pago registrado correctamente.');
      cuentaModal.classList.add('hidden');
      await load();
    } catch (error) {
      showMessage(error.message, 'error');
    }
  });

  workerEditForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedEditWorkerId) return;

    try {
      await actualizarTrabajador(selectedEditWorkerId, {
        nombre: workerEditNombre.value,
        apellido: workerEditApellido.value
      });
      showMessage('Trabajador actualizado correctamente.');
      closeEditModal();
      await load();
    } catch (error) {
      showMessage(error.message, 'error');
    }
  });

  workerDeleteConfirm?.addEventListener('click', async () => {
    if (!selectedDeleteWorkerId) return;

    try {
      await eliminarTrabajador(selectedDeleteWorkerId);
      showMessage('Trabajador eliminado correctamente.');
      closeDeleteModal();
      await load();
    } catch (error) {
      showMessage(error.message, 'error');
    }
  });

  await load();

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.querySelector('#trabajador-nombre').value;
    const apellido = document.querySelector('#trabajador-apellido').value;

    try {
      await crearTrabajador({ nombre, apellido });
      form.reset();
      showMessage('Trabajador creado correctamente.');
      await load();
    } catch (error) {
      showMessage(error.message, 'error');
    }
  });
}
