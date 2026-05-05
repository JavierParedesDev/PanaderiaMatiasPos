import {
  actualizarCategoria,
  actualizarMetodoPago,
  actualizarProveedor,
  crearCategoria,
  crearProveedor,
  eliminarCategoria,
  eliminarMetodoPago,
  eliminarProveedor,
  getCategorias,
  getProveedores,
  getSucursales,
  getMetodosPago
} from '../../services/masterService.js';
import { escapeHtml } from '../../utils/formatters.js';

function renderMessage(id) {
  return `<div id="${id}" class="hidden rounded-xl border px-4 py-3 text-sm font-bold"></div>`;
}

function showMessage(id, tone, message) {
  const box = document.querySelector(`#${id}`);
  if (!box) return;

  box.textContent = message;
  box.className = 'rounded-xl border px-4 py-3 text-sm font-bold';
  if (tone === 'success') {
    box.classList.add('border-[#c5dfcb]', 'bg-[#eef8f0]', 'text-verdeok');
  } else {
    box.classList.add('border-[#efc1bb]', 'bg-[#fff4f2]', 'text-rojoaviso');
  }
}

export function renderMaestrosSkeleton() {
    return `
    <div class="space-y-8 pb-10">
      <header>
        <h1 class="text-3xl font-black text-[#2d221b] tracking-tighter">Tablas Maestras</h1>
        <p class="text-sm font-medium text-[#705f52] mt-1">Gestión central de entidades del negocio.</p>
      </header>

      <div id="maestros-content" class="grid gap-6 md:grid-cols-2">
        <div class="panel h-64 animate-pulse bg-white/50"></div>
        <div class="panel h-64 animate-pulse bg-white/50"></div>
        <div class="panel h-64 animate-pulse bg-white/50"></div>
        <div class="panel h-64 animate-pulse bg-white/50"></div>
      </div>
    </div>
  `;
}

export async function hydrateMaestrosView() {
    const container = document.querySelector('#maestros-content');
    if (!container) return;

    try {
        const [catRes, provRes, sucRes, pagRes] = await Promise.all([
            getCategorias(),
            getProveedores(),
            getSucursales(),
            getMetodosPago()
        ]);

        container.innerHTML = `
      <!-- Categorías -->
      <section class="panel bg-white p-6 shadow-sm">
        <div class="flex items-center justify-between mb-4 border-b border-borde/20 pb-3">
          <h2 class="text-lg font-black text-[#2d221b]">Categorías</h2>
        </div>
        <form id="form-categoria" class="mb-4 grid gap-2 sm:grid-cols-[1fr_auto]">
          <input name="nombre" class="field h-10 text-sm" placeholder="Nueva categoria" required>
          <button type="submit" class="btn-secondary h-10 px-4 py-2 text-xs">Agregar</button>
        </form>
        ${renderMessage('categoria-message')}
        <div class="space-y-2">
          ${catRes.data.map(c => `
            <div class="flex items-center justify-between p-2 rounded-lg hover:bg-papel/20">
              <span class="text-sm font-bold text-cafe">${escapeHtml(c.nombre)}</span>
              <div class="flex items-center gap-2">
                <span class="text-[10px] text-cafe/30">ID: ${c.id}</span>
                <button type="button" class="rounded-lg border border-borde/40 px-2 py-1 text-[10px] font-black uppercase text-cafe/70" data-edit-type="categoria" data-id="${c.id}" data-nombre="${escapeHtml(c.nombre)}">Editar</button>
                <button type="button" class="rounded-lg border border-rojoaviso/40 px-2 py-1 text-[10px] font-black uppercase text-rojoaviso" data-delete-type="categoria" data-id="${c.id}" data-nombre="${escapeHtml(c.nombre)}">Eliminar</button>
              </div>
            </div>
          `).join('')}
        </div>
      </section>

      <!-- Proveedores -->
      <section class="panel bg-white p-6 shadow-sm">
        <div class="flex items-center justify-between mb-4 border-b border-borde/20 pb-3">
          <h2 class="text-lg font-black text-[#2d221b]">Proveedores</h2>
        </div>
        <form id="form-proveedor" class="mb-4 space-y-3">
          <div class="grid gap-3 sm:grid-cols-2">
            <input name="nombre_empresa" class="field h-10 text-sm" placeholder="Nombre proveedor" required>
            <input name="rut_proveedor" class="field h-10 text-sm" placeholder="RUT proveedor">
            <input name="contacto_nombre" class="field h-10 text-sm" placeholder="Contacto">
            <input name="telefono" class="field h-10 text-sm" placeholder="Telefono">
          </div>
          <button type="submit" class="btn-secondary h-10 px-4 py-2 text-xs">Agregar proveedor</button>
        </form>
        ${renderMessage('proveedor-message')}
        <div class="space-y-2">
          ${provRes.data.map(p => `
            <div class="flex items-center justify-between p-2 rounded-lg hover:bg-papel/20">
              <span class="text-sm font-bold text-cafe">${escapeHtml(p.nombre_empresa || '')}</span>
              <div class="flex items-center gap-2">
                <span class="text-[10px] text-cafe/30">RUT: ${escapeHtml(p.rut_proveedor || 'N/A')}</span>
                <button type="button" class="rounded-lg border border-borde/40 px-2 py-1 text-[10px] font-black uppercase text-cafe/70" data-edit-type="proveedor" data-id="${p.id}" data-nombre="${escapeHtml(p.nombre_empresa || '')}" data-rut="${escapeHtml(p.rut_proveedor || '')}" data-contacto="${escapeHtml(p.contacto_nombre || '')}" data-telefono="${escapeHtml(p.telefono || '')}">Editar</button>
                <button type="button" class="rounded-lg border border-rojoaviso/40 px-2 py-1 text-[10px] font-black uppercase text-rojoaviso" data-delete-type="proveedor" data-id="${p.id}" data-nombre="${escapeHtml(p.nombre_empresa || '')}">Eliminar</button>
              </div>
            </div>
          `).join('')}
        </div>
      </section>

      <!-- Sucursales -->
      <section class="panel bg-white p-6 shadow-sm">
        <div class="flex items-center justify-between mb-4 border-b border-borde/20 pb-3">
          <h2 class="text-lg font-black text-[#2d221b]">Sucursales</h2>
        </div>
        <div class="space-y-2">
          ${sucRes.data.map(s => `
            <div class="flex items-center justify-between p-2 rounded-lg hover:bg-papel/20">
              <span class="text-sm font-bold text-cafe">${escapeHtml(s.nombre)}</span>
              <span class="text-[10px] text-verdeok">OPERATIVA</span>
            </div>
          `).join('')}
        </div>
      </section>

      <!-- Métodos de Pago -->
      <section class="panel bg-white p-6 shadow-sm">
        <div class="flex items-center justify-between mb-4 border-b border-borde/20 pb-3">
          <h2 class="text-lg font-black text-[#2d221b]">Métodos de Pago</h2>
        </div>
        ${renderMessage('metodo-message')}
        <div class="space-y-2">
          ${pagRes.data.map(m => `
            <div class="flex items-center justify-between p-2 rounded-lg hover:bg-papel/20">
              <span class="text-sm font-bold text-cafe">${escapeHtml(m.nombre)}</span>
              <div class="flex items-center gap-2">
                <div class="w-2 h-2 rounded-full bg-verdeok"></div>
                <button type="button" class="rounded-lg border border-borde/40 px-2 py-1 text-[10px] font-black uppercase text-cafe/70" data-edit-type="metodo" data-id="${m.id}" data-nombre="${escapeHtml(m.nombre)}">Editar</button>
                <button type="button" class="rounded-lg border border-rojoaviso/40 px-2 py-1 text-[10px] font-black uppercase text-rojoaviso" data-delete-type="metodo" data-id="${m.id}" data-nombre="${escapeHtml(m.nombre)}">Eliminar</button>
              </div>
            </div>
          `).join('')}
        </div>
      </section>

      <div id="maestro-edit-modal" class="hidden fixed inset-0 z-[110] flex items-center justify-center p-4 bg-cafe/80 backdrop-blur-md">
        <div class="panel w-full max-w-lg bg-white p-0 overflow-hidden shadow-2xl">
          <div class="p-5 bg-cafe text-white flex items-center justify-between">
            <div>
              <h2 id="maestro-edit-title" class="text-lg font-black uppercase tracking-tight">Editar</h2>
              <p class="text-xs text-white/60 font-bold uppercase tracking-widest mt-1">Actualiza la información</p>
            </div>
            <button id="maestro-edit-close" class="text-2xl text-white/60 hover:text-white">&times;</button>
          </div>
          <form id="maestro-edit-form" class="p-6 space-y-4">
            <div id="maestro-edit-fields" class="space-y-3"></div>
            <div class="flex items-center justify-end gap-3">
              <button id="maestro-edit-cancel" type="button" class="rounded-xl border border-borde/40 px-4 py-2 text-xs font-black uppercase tracking-widest text-cafe/70">Cancelar</button>
              <button type="submit" class="rounded-xl bg-cafe text-white px-5 py-2 text-xs font-black uppercase tracking-widest">Guardar cambios</button>
            </div>
          </form>
        </div>
      </div>

      <div id="maestro-delete-modal" class="hidden fixed inset-0 z-[120] flex items-center justify-center p-4 bg-cafe/80 backdrop-blur-md">
        <div class="panel w-full max-w-md bg-white p-0 overflow-hidden shadow-2xl">
          <div class="p-5 bg-cafe text-white flex items-center justify-between">
            <div>
              <h2 class="text-lg font-black uppercase tracking-tight">Eliminar</h2>
              <p class="text-xs text-white/60 font-bold uppercase tracking-widest mt-1">Acción irreversible</p>
            </div>
            <button id="maestro-delete-close" class="text-2xl text-white/60 hover:text-white">&times;</button>
          </div>
          <div class="p-6 space-y-4">
            <p id="maestro-delete-text" class="text-sm text-cafe/70 font-semibold">¿Seguro que deseas eliminar?</p>
            <div class="flex items-center justify-end gap-3">
              <button id="maestro-delete-cancel" type="button" class="rounded-xl border border-borde/40 px-4 py-2 text-xs font-black uppercase tracking-widest text-cafe/70">Cancelar</button>
              <button id="maestro-delete-confirm" type="button" class="rounded-xl bg-rojoaviso text-white px-5 py-2 text-xs font-black uppercase tracking-widest">Eliminar</button>
            </div>
          </div>
        </div>
      </div>
    `;

  document.querySelector('#form-categoria')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const button = form.querySelector('button[type="submit"]');
            const nombre = new FormData(form).get('nombre')?.trim();

            if (!nombre) {
                showMessage('categoria-message', 'error', 'Ingresa un nombre de categoria.');
                return;
            }

            try {
                button.disabled = true;
                button.textContent = 'Guardando...';
                await crearCategoria({ nombre });
                showMessage('categoria-message', 'success', 'Categoria agregada.');
                await hydrateMaestrosView();
            } catch (error) {
                showMessage('categoria-message', 'error', error.message);
            } finally {
                button.disabled = false;
                button.textContent = 'Agregar';
            }
        });

  document.querySelector('#form-proveedor')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const button = form.querySelector('button[type="submit"]');
            const data = Object.fromEntries(new FormData(form).entries());
            const payload = {
                nombre_empresa: data.nombre_empresa?.trim(),
                rut_proveedor: data.rut_proveedor?.trim() || null,
                contacto_nombre: data.contacto_nombre?.trim() || null,
                telefono: data.telefono?.trim() || null
            };

            if (!payload.nombre_empresa) {
                showMessage('proveedor-message', 'error', 'Ingresa el nombre del proveedor.');
                return;
            }

            try {
                button.disabled = true;
                button.textContent = 'Guardando...';
                await crearProveedor(payload);
                showMessage('proveedor-message', 'success', 'Proveedor agregado.');
                await hydrateMaestrosView();
            } catch (error) {
                showMessage('proveedor-message', 'error', error.message);
            } finally {
                button.disabled = false;
                button.textContent = 'Agregar proveedor';
            }
    });

    const editModal = document.querySelector('#maestro-edit-modal');
    const editClose = document.querySelector('#maestro-edit-close');
    const editCancel = document.querySelector('#maestro-edit-cancel');
    const editTitle = document.querySelector('#maestro-edit-title');
    const editFields = document.querySelector('#maestro-edit-fields');
    const editForm = document.querySelector('#maestro-edit-form');
    const deleteModal = document.querySelector('#maestro-delete-modal');
    const deleteClose = document.querySelector('#maestro-delete-close');
    const deleteCancel = document.querySelector('#maestro-delete-cancel');
    const deleteConfirm = document.querySelector('#maestro-delete-confirm');
    const deleteText = document.querySelector('#maestro-delete-text');
    let currentEdit = null;
    let currentDelete = null;

    const closeEditModal = () => {
      editModal.classList.add('hidden');
      currentEdit = null;
    };

    const closeDeleteModal = () => {
      deleteModal.classList.add('hidden');
      currentDelete = null;
    };

    editClose?.addEventListener('click', closeEditModal);
    editCancel?.addEventListener('click', closeEditModal);
    deleteClose?.addEventListener('click', closeDeleteModal);
    deleteCancel?.addEventListener('click', closeDeleteModal);

    document.querySelectorAll('[data-edit-type]').forEach((button) => {
      button.addEventListener('click', () => {
        const type = button.dataset.editType;
        const id = button.dataset.id;
        const nombre = button.dataset.nombre || '';
        currentEdit = { type, id };

        if (type === 'categoria') {
          editTitle.textContent = 'Editar categoria';
          editFields.innerHTML = `
            <label class="block space-y-2">
            <span class="text-[10px] font-black text-cafe/40 uppercase tracking-widest">Nombre</span>
                        <input id="edit-nombre" class="field" value="${escapeHtml(nombre)}" required>
            </label>
          `;
        }

        if (type === 'metodo') {
          editTitle.textContent = 'Editar metodo de pago';
          editFields.innerHTML = `
            <label class="block space-y-2">
            <span class="text-[10px] font-black text-cafe/40 uppercase tracking-widest">Nombre</span>
                        <input id="edit-nombre" class="field" value="${escapeHtml(nombre)}" required>
            </label>
          `;
        }

        if (type === 'proveedor') {
          editTitle.textContent = 'Editar proveedor';
          editFields.innerHTML = `
            <div class="grid gap-3 sm:grid-cols-2">
            <label class="block space-y-2 sm:col-span-2">
              <span class="text-[10px] font-black text-cafe/40 uppercase tracking-widest">Nombre proveedor</span>
                          <input id="edit-nombre" class="field" value="${escapeHtml(nombre)}" required>
            </label>
            <label class="block space-y-2">
              <span class="text-[10px] font-black text-cafe/40 uppercase tracking-widest">RUT</span>
                          <input id="edit-rut" class="field" value="${escapeHtml(button.dataset.rut || '')}">
            </label>
            <label class="block space-y-2">
              <span class="text-[10px] font-black text-cafe/40 uppercase tracking-widest">Contacto</span>
                          <input id="edit-contacto" class="field" value="${escapeHtml(button.dataset.contacto || '')}">
            </label>
            <label class="block space-y-2 sm:col-span-2">
              <span class="text-[10px] font-black text-cafe/40 uppercase tracking-widest">Telefono</span>
                          <input id="edit-telefono" class="field" value="${escapeHtml(button.dataset.telefono || '')}">
            </label>
            </div>
          `;
        }

        editModal.classList.remove('hidden');
      });
    });

    document.querySelectorAll('[data-delete-type]').forEach((button) => {
      button.addEventListener('click', () => {
        currentDelete = { type: button.dataset.deleteType, id: button.dataset.id };
        const nombre = button.dataset.nombre || 'este registro';
        deleteText.textContent = `¿Seguro que deseas eliminar ${nombre}?`;
        deleteModal.classList.remove('hidden');
      });
    });

    editForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!currentEdit) return;

      try {
        if (currentEdit.type === 'categoria') {
          await actualizarCategoria(currentEdit.id, { nombre: document.querySelector('#edit-nombre')?.value });
          showMessage('categoria-message', 'success', 'Categoria actualizada.');
        }

        if (currentEdit.type === 'metodo') {
          await actualizarMetodoPago(currentEdit.id, { nombre: document.querySelector('#edit-nombre')?.value });
          showMessage('metodo-message', 'success', 'Metodo actualizado.');
        }

        if (currentEdit.type === 'proveedor') {
          await actualizarProveedor(currentEdit.id, {
            nombre_empresa: document.querySelector('#edit-nombre')?.value,
            rut_proveedor: document.querySelector('#edit-rut')?.value || null,
            contacto_nombre: document.querySelector('#edit-contacto')?.value || null,
            telefono: document.querySelector('#edit-telefono')?.value || null
          });
          showMessage('proveedor-message', 'success', 'Proveedor actualizado.');
        }

        closeEditModal();
        await hydrateMaestrosView();
      } catch (error) {
        const messageId = currentEdit.type === 'proveedor'
          ? 'proveedor-message'
          : currentEdit.type === 'metodo'
            ? 'metodo-message'
            : 'categoria-message';
        showMessage(messageId, 'error', error.message);
      }
    });

    deleteConfirm?.addEventListener('click', async () => {
      if (!currentDelete) return;
      try {
        if (currentDelete.type === 'categoria') {
          await eliminarCategoria(currentDelete.id);
          showMessage('categoria-message', 'success', 'Categoria eliminada.');
        }

        if (currentDelete.type === 'proveedor') {
          await eliminarProveedor(currentDelete.id);
          showMessage('proveedor-message', 'success', 'Proveedor eliminado.');
        }

        if (currentDelete.type === 'metodo') {
          await eliminarMetodoPago(currentDelete.id);
          showMessage('metodo-message', 'success', 'Metodo eliminado.');
        }

        closeDeleteModal();
        await hydrateMaestrosView();
      } catch (error) {
        const messageId = currentDelete.type === 'proveedor'
          ? 'proveedor-message'
          : currentDelete.type === 'metodo'
            ? 'metodo-message'
            : 'categoria-message';
        showMessage(messageId, 'error', error.message);
      }
    });
    } catch (error) {
        container.innerHTML = `<div class="col-span-2 panel p-8 text-center text-rojoaviso font-bold bg-white">${error.message}</div>`;
    }
}
