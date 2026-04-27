import { getCategorias } from '../../services/masterService.js';
import { actualizarProducto, crearProducto, getProductos, eliminarProducto } from '../../services/productService.js';
import { escapeHtml, formatCurrency } from '../../utils/formatters.js';
import { getSession } from '../../state/sessionStore.js';
import { showNotification } from '../../utils/notifications.js';

export function renderProductosSkeleton() {
  const isAdmin = getSession()?.usuario?.rol === 'Admin';

  return `
    <div class="px-10 py-10 space-y-8">
      <header class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold text-[#2d221b]">Productos</h1>
          <p class="text-sm text-[#705f52] mt-1">Consulta el catálogo de panadería y pastelería.</p>
        </div>
        ${isAdmin ? `
        <button id="abrir-modal-nuevo" class="btn-primary">
          <span class="mr-2">+</span> Agregar Producto
        </button>` : ''}
      </header>

      <!-- Barra de progreso / carga -->
      <div id="productos-progress-container" class="hidden h-1.5 w-full overflow-hidden rounded-full bg-cafe/10">
        <div id="productos-progress-bar" class="h-full bg-cafe transition-all duration-300" style="width: 0%"></div>
      </div>

      <div class="panel bg-white p-6">
        <div class="mb-6 flex flex-col md:flex-row gap-4 items-center justify-between font-medium">
          <div class="relative w-full md:w-96">
            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-cafe/40 text-lg">🔍</span>
            <input id="buscador-productos" type="text" class="field pl-12 h-11" placeholder="Buscar por nombre o código...">
          </div>
          <div class="flex items-center gap-2 text-sm text-[#705f52]">
            <span id="total-productos-count">0</span> productos encontrados
          </div>
        </div>

        <div id="productos-table-container">
          <div class="animate-pulse space-y-4">
            <div class="h-10 bg-crema/50 rounded-lg w-full"></div>
            <div class="h-12 bg-crema/20 rounded-lg w-full"></div>
            <div class="h-12 bg-crema/20 rounded-lg w-full"></div>
          </div>
        </div>

        <!-- Paginación -->
        <div class="mt-8 flex items-center justify-center gap-4">
          <button id="prev-page" class="btn-secondary py-2 px-4 text-xs disabled:opacity-30 disabled:cursor-not-allowed">Anterior</button>
          <span id="page-info" class="text-sm font-semibold text-cafe">Página 1 de 1</span>
          <button id="next-page" class="btn-secondary py-2 px-4 text-xs disabled:opacity-30 disabled:cursor-not-allowed">Siguiente</button>
        </div>
      </div>

      <!-- Modal para Agregar/Editar -->
      <div id="producto-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4 bg-tinta/40 backdrop-blur-sm transition-opacity">
        <div class="panel w-full max-w-2xl bg-papel shadow-2xl overflow-hidden scale-95 transition-transform">
          <div class="p-6 border-b border-borde/40 flex items-center justify-between">
            <h2 id="producto-modal-title" class="text-xl font-bold text-[#2d221b]">Nuevo Producto</h2>
            <button id="cerrar-modal" class="text-cafe/60 hover:text-cafe text-2xl font-light">&times;</button>
          </div>
          <form id="producto-form" class="p-8 space-y-5">
            <input id="producto-id" type="hidden">
            <div class="grid gap-5 md:grid-cols-2">
              <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-cafe/60 mb-2">Código Interno</label>
                <input id="producto-codigo-interno" class="field" placeholder="Ej: 01476">
              </div>
              <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-cafe/60 mb-2">Código Externo</label>
                <input id="producto-codigo-externo" class="field" placeholder="Ej: 7804612345678">
              </div>
            </div>
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-cafe/60 mb-2">Nombre del Producto</label>
              <input id="producto-nombre" class="field" placeholder="Ej: Pan Batido Especial">
            </div>
            <div class="grid gap-5 md:grid-cols-2">
              <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-cafe/60 mb-2">Unidad</label>
                <input id="producto-unidad" class="field" placeholder="UN/KG">
              </div>
              <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-cafe/60 mb-2">Categoría</label>
                <select id="producto-categoria" class="field">
                  <option value="">Cargando...</option>
                </select>
              </div>
            </div>
            <div class="grid gap-5 md:grid-cols-3">
              <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-cafe/60 mb-2">Precio Costo</label>
                <input id="producto-costo" type="number" step="0.01" class="field" placeholder="0.00">
              </div>
              <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-cafe/60 mb-2">Precio Venta</label>
                <input id="producto-precio" type="number" step="0.01" class="field" placeholder="0.00">
              </div>
              <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-cafe/60 mb-2">Impuesto Específico (%)</label>
                <input id="producto-impuesto" type="number" step="0.01" class="field" placeholder="0.00">
              </div>
            </div>

            <!-- Pesable Toggle -->
            <div class="flex items-center justify-between p-4 rounded-2xl bg-crema/30 border border-borde/30">
              <div>
                <p class="text-sm font-black text-[#2d221b]">⚖️ Producto Pesable</p>
                <p class="text-[10px] text-cafe/50 mt-0.5">Se vende por peso (kg/gramos), no por unidad.</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input id="producto-pesable" type="checkbox" class="sr-only peer">
                <div class="w-11 h-6 bg-cafe/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[\'\'] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cafe"></div>
                <span class="ml-3 text-xs font-bold text-cafe/60 peer-has-[:checked]:text-cafe" id="pesable-label">No pesable</span>
              </label>
            </div>

            <div id="producto-form-message" class="hidden rounded-xl px-4 py-3 text-sm text-center"></div>
            <div class="pt-4 flex gap-3 justify-end border-t border-borde/40">
              <button id="cancelar-modal" type="button" class="btn-secondary px-8">Cancelar</button>
              <button id="producto-submit" type="submit" class="btn-primary px-10 font-bold">Guardar Producto</button>
            </div>
          </form>
        </div>
      </div>
      <!-- Modal de Confirmación Personalizado -->
      <div id="confirm-modal" class="hidden fixed inset-0 z-[60] flex items-center justify-center p-4 bg-tinta/60 backdrop-blur-md transition-opacity">
        <div class="panel w-full max-w-md bg-crema shadow-2xl overflow-hidden scale-95 transition-transform border-2 border-cafe/20">
          <div class="p-8 text-center space-y-4">
            <div class="w-16 h-16 bg-rojoaviso/10 text-rojoaviso rounded-full flex items-center justify-center mx-auto text-3xl mb-2">
              ⚠️
            </div>
            <h2 id="confirm-modal-title" class="text-xl font-bold text-[#2d221b]">¿Estás seguro?</h2>
            <p id="confirm-modal-message" class="text-[#705f52]">Esta acción no se puede deshacer.</p>
            <div class="pt-6 flex gap-3 justify-center">
              <button id="confirm-cancel" type="button" class="btn-secondary px-6">Cancelar</button>
              <button id="confirm-accept" type="button" class="btn-primary bg-rojoaviso hover:bg-[#b03020] px-8 border-none ring-offset-crema">Confirmar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderProductosTable(productos = []) {
  const isAdmin = getSession()?.usuario?.rol === 'Admin';

  if (!productos.length) {
    return `
      <div class="py-20 text-center">
        <p class="text-cafe/40 text-lg italic">No se encontraron productos.</p>
      </div>
    `;
  }

  return `
    <div class="overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead class="bg-crema/30">
          <tr class="text-left text-[#6a584b] uppercase tracking-tighter text-[10px] font-black opacity-60">
            <th class="px-4 py-4">Códigos</th>
            <th class="px-4 py-4">Producto</th>
            <th class="px-4 py-4">Categoría</th>
            ${isAdmin ? '<th class="px-4 py-4">Costo</th>' : ''}
            <th class="px-4 py-4">P. Venta</th>
            ${isAdmin ? '<th class="px-4 py-4 text-center">Margen</th>' : ''}
            <th class="px-4 py-4 text-center">⚖️ Pesable</th>
            <th class="px-4 py-4 text-center">Activo</th>
            ${isAdmin ? '<th class="px-4 py-4 text-right">Acciones</th>' : ''}
          </tr>
        </thead>
        <tbody class="divide-y divide-borde/20">
          ${productos.map((producto) => `
            <tr class="hover:bg-crema/10 transition-colors ${!producto.activo ? 'opacity-50 grayscale-[0.5]' : ''}">
              <td class="px-4 py-4">
                <p class="font-mono text-[11px] text-cafe">IN: ${escapeHtml(producto.codigo_interno || '-')}</p>
                <p class="font-mono text-[10px] text-cafe/40">EX: ${escapeHtml(producto.codigo_barra_externo || '-')}</p>
              </td>
              <td class="px-4 py-4 font-bold text-[#2d221b]">${escapeHtml(producto.nombre)}</td>
              <td class="px-4 py-4 text-xs text-cafe/70">${escapeHtml(producto.categoria || '-')}</td>
              ${isAdmin ? `<td class="px-4 py-4 text-cafe/60 font-medium">${formatCurrency(producto.precio_costo)}</td>` : ''}
              <td class="px-4 py-4 font-black text-cafe">${formatCurrency(producto.precio_venta)}</td>
              ${isAdmin ? `
              <td class="px-4 py-4 text-center">
                <span class="badge ${producto.margen_porcentaje > 30 ? 'bg-verdeok/10 text-verdeok' : 'bg-caramelo/10 text-caramelo'}">
                  ${producto.margen_porcentaje}%
                </span>
              </td>` : ''}
              <td class="px-4 py-4 text-center">
                ${producto.pesable
      ? '<span class="badge bg-azulaviso/10 text-azulaviso font-black">⚖️ Sí</span>'
      : '<span class="text-cafe/20 text-xs">—</span>'}
              </td>
              <td class="px-4 py-4 text-center">
                <button type="button" class="switch focus:ring-verdeok/30 ${!isAdmin ? 'pointer-events-none' : ''}" 
                        role="switch" 
                        aria-checked="${producto.activo ? 'true' : 'false'}" 
                        data-action="${isAdmin ? 'toggle-status' : 'none'}" 
                        data-id="${escapeHtml(producto.id)}">
                  <span class="switch-thumb"></span>
                </button>
              </td>
              ${isAdmin ? `
              <td class="px-4 py-4 text-right">
                <div class="flex justify-end gap-2">
                  <button class="w-8 h-8 rounded-lg bg-cafe text-white flex items-center justify-center hover:bg-[#4a2f1d] transition-colors" data-action="editar-producto" data-id="${escapeHtml(producto.id)}" title="Editar">
                    ✏️
                  </button>
                  <button class="w-8 h-8 rounded-lg bg-rojoaviso/10 text-rojoaviso hover:bg-rojoaviso hover:text-white flex items-center justify-center transition-all" data-action="eliminar-producto" data-id="${escapeHtml(producto.id)}" title="Eliminar">
                    🗑️
                  </button>
                </div>
              </td>` : ''}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

let productosCache = [];
let currentPage = 1;
const itemsPerPage = 15;
let searchQuery = '';
let editingProductId = null;

export async function hydrateProductosView() {
  const container = document.querySelector('#productos-table-container');
  const buscador = document.querySelector('#buscador-productos');
  const countLabel = document.querySelector('#total-productos-count');
  const pageInfo = document.querySelector('#page-info');
  const prevBtn = document.querySelector('#prev-page');
  const nextBtn = document.querySelector('#next-page');
  const openModalBtn = document.querySelector('#abrir-modal-nuevo');
  const modal = document.querySelector('#producto-modal');
  const closeModalBtn = document.querySelector('#cerrar-modal');
  const cancelModalBtn = document.querySelector('#cancelar-modal');
  const form = document.querySelector('#producto-form');
  const submitButton = document.querySelector('#producto-submit');
  const messageBox = document.querySelector('#producto-form-message');
  const categorySelect = document.querySelector('#producto-categoria');
  const modalTitle = document.querySelector('#producto-modal-title');

  const confirmModal = document.querySelector('#confirm-modal');
  const confirmCancel = document.querySelector('#confirm-cancel');
  const confirmAccept = document.querySelector('#confirm-accept');
  const confirmTitle = document.querySelector('#confirm-modal-title');
  const confirmMessage = document.querySelector('#confirm-modal-message');

  let onConfirmCallback = null;

  function showProgress(show) {
    const pContainer = document.querySelector('#productos-progress-container');
    const pBar = document.querySelector('#productos-progress-bar');
    if (!pContainer || !pBar) return;
    if (show) {
      pContainer.classList.remove('hidden');
      pBar.style.width = '30%';
      setTimeout(() => pBar.style.width = '90%', 200);
    } else {
      pBar.style.width = '100%';
      setTimeout(() => pContainer.classList.add('hidden'), 500);
    }
  }

  function openConfirmModal(title, message, callback) {
    if (confirmTitle) confirmTitle.textContent = title;
    if (confirmMessage) confirmMessage.textContent = message;
    onConfirmCallback = callback;
    confirmModal?.classList.remove('hidden');
    setTimeout(() => {
      confirmModal?.querySelector('.panel')?.classList.remove('scale-95');
      confirmModal?.querySelector('.panel')?.classList.add('scale-100');
    }, 10);
  }

  function closeConfirmModal() {
    confirmModal?.querySelector('.panel')?.classList.add('scale-95');
    confirmModal?.querySelector('.panel')?.classList.remove('scale-100');
    setTimeout(() => {
      confirmModal?.classList.add('hidden');
      onConfirmCallback = null;
    }, 200);
  }

  function openModal(editing = false, producto = null) {
    if (getSession()?.usuario?.rol !== 'Admin') return;

    editingProductId = editing ? (producto?.id || null) : null;
    modalTitle.textContent = editing ? `Editar Producto - ${producto.nombre}` : 'Nuevo Producto';
    submitButton.textContent = editing ? 'Guardar Cambios' : 'Guardar Producto';
    messageBox?.classList.add('hidden');

    if (editing && producto) {
      document.querySelector('#producto-id').value = producto.id;
      document.querySelector('#producto-codigo-interno').value = producto.codigo_interno || '';
      document.querySelector('#producto-codigo-externo').value = producto.codigo_barra_externo || '';
      document.querySelector('#producto-nombre').value = producto.nombre || '';
      document.querySelector('#producto-unidad').value = producto.unidad || '';
      document.querySelector('#producto-costo').value = producto.precio_costo ?? '';
      document.querySelector('#producto-precio').value = producto.precio_venta ?? '';
      document.querySelector('#producto-categoria').value = producto.id_categoria ?? '';
      document.querySelector('#producto-impuesto').value = producto.impuesto_especifico ?? 0;
      const pesableCheck = document.querySelector('#producto-pesable');
      if (pesableCheck) {
        pesableCheck.checked = !!producto.pesable;
        const label = document.querySelector('#pesable-label');
        if (label) label.textContent = pesableCheck.checked ? 'Pesable (⚖️)' : 'No pesable';
      }
    } else {
      form?.reset();
      document.querySelector('#producto-id').value = '';
      const pesableCheck = document.querySelector('#producto-pesable');
      if (pesableCheck) pesableCheck.checked = false;
      const label = document.querySelector('#pesable-label');
      if (label) label.textContent = 'No pesable';
    }

    // Listener para actualizar la etiqueta del toggle en tiempo real
    const pesableCheck = document.querySelector('#producto-pesable');
    const pesableLabel = document.querySelector('#pesable-label');
    pesableCheck?.addEventListener('change', () => {
      if (pesableLabel) pesableLabel.textContent = pesableCheck.checked ? 'Pesable (⚖️)' : 'No pesable';
    });

    modal?.classList.remove('hidden');
    setTimeout(() => {
      modal?.querySelector('.panel')?.classList.remove('scale-95');
      modal?.querySelector('.panel')?.classList.add('scale-100');
    }, 10);
  }

  function closeModal() {
    modal?.querySelector('.panel')?.classList.add('scale-95');
    modal?.querySelector('.panel')?.classList.remove('scale-100');
    setTimeout(() => {
      modal?.classList.add('hidden');
    }, 200);
  }

  async function renderTable() {
    if (!container) return;

    // Filtrado
    const filtered = productosCache.filter(p => {
      const term = searchQuery.toLowerCase();
      return (p.nombre || '').toLowerCase().includes(term) ||
        (p.codigo_interno || '').toLowerCase().includes(term) ||
        (p.codigo_barra_externo || '').toLowerCase().includes(term);
    });

    if (countLabel) countLabel.textContent = filtered.length;

    // Paginación
    const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pagedItems = filtered.slice(start, end);

    container.innerHTML = renderProductosTable(pagedItems);

    // Controles paginación
    if (pageInfo) pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
    if (prevBtn) prevBtn.disabled = currentPage === 1;
    if (nextBtn) nextBtn.disabled = currentPage === totalPages;

    // Eventos de la tabla
    container.querySelectorAll('[data-action="editar-producto"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const prod = productosCache.find(p => String(p.id) === btn.dataset.id);
        if (prod) openModal(true, prod);
      });
    });

    container.querySelectorAll('[data-action="toggle-status"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (getSession()?.usuario?.rol !== 'Admin') return;

        const prod = productosCache.find(p => String(p.id) === btn.dataset.id);
        if (!prod) return;

        const newState = btn.getAttribute('aria-checked') === 'false';

        try {
          btn.setAttribute('aria-checked', newState ? 'true' : 'false');
          showProgress(true);
          await actualizarProducto(prod.id, { ...prod, activo: newState });
          prod.activo = newState;
        } catch (error) {
          btn.setAttribute('aria-checked', (!newState) ? 'true' : 'false');
          showNotification(`Error al cambiar estado: ${error.message}`);
        } finally {
          showProgress(false);
        }
      });
    });

    container.querySelectorAll('[data-action="eliminar-producto"]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (getSession()?.usuario?.rol !== 'Admin') return;

        const prodId = btn.dataset.id;
        const prod = productosCache.find(p => String(p.id) === prodId);
        if (!prod) return;

        openConfirmModal(
          'Eliminar Producto',
          `¿Estás seguro de que deseas eliminar permanentemente "${prod.nombre}"? Esta acción no se puede deshacer si el producto no tiene ventas.`,
          async () => {
            try {
              showProgress(true);
              await eliminarProducto(prodId);
              await loadData(false);
            } catch (error) {
              showNotification(`Error al eliminar: ${error.message}`);
            } finally {
              showProgress(false);
            }
          }
        );
      });
    });
  }

  async function loadData(withProgress = true) {
    if (withProgress) showProgress(true);
    try {
      const [categoriasResponse, productosResponse] = await Promise.all([
        getCategorias(),
        getProductos()
      ]);

      productosCache = productosResponse.data || [];

      if (categorySelect) {
        categorySelect.innerHTML = `<option value="">Seleccione categoría</option>` +
          (categoriasResponse.data || []).map(c => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`).join('');
      }

      await renderTable();
    } catch (error) {
      if (container) container.innerHTML = `<div class="p-8 text-center text-rojoaviso">${escapeHtml(error.message)}</div>`;
    } finally {
      if (withProgress) showProgress(false);
    }
  }

  // --- Event Listeners ---
  openModalBtn?.addEventListener('click', () => openModal(false));
  closeModalBtn?.addEventListener('click', closeModal);
  cancelModalBtn?.addEventListener('click', closeModal);

  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  confirmCancel?.addEventListener('click', closeConfirmModal);
  confirmAccept?.addEventListener('click', async () => {
    if (onConfirmCallback) await onConfirmCallback();
    closeConfirmModal();
  });
  confirmModal?.addEventListener('click', (e) => { if (e.target === confirmModal) closeConfirmModal(); });

  buscador?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    currentPage = 1;
    renderTable();
  });

  prevBtn?.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderTable();
      container?.scrollIntoView({ behavior: 'smooth' });
    }
  });

  nextBtn?.addEventListener('click', () => {
    const filtered = productosCache.filter(p => {
      const term = searchQuery.toLowerCase();
      return (p.nombre || '').toLowerCase().includes(term) || (p.codigo_interno || '').toLowerCase().includes(term);
    });
    const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;

    if (currentPage < totalPages) {
      currentPage++;
      renderTable();
      container?.scrollIntoView({ behavior: 'smooth' });
    }
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (getSession()?.usuario?.rol !== 'Admin') return;

    const payload = {
      codigo_interno: document.querySelector('#producto-codigo-interno')?.value?.trim() || null,
      codigo_barra_externo: document.querySelector('#producto-codigo-externo')?.value?.trim() || null,
      nombre: document.querySelector('#producto-nombre')?.value?.trim() || null,
      unidad: document.querySelector('#producto-unidad')?.value?.trim() || null,
      precio_costo: Number(document.querySelector('#producto-costo')?.value || 0),
      precio_venta: Number(document.querySelector('#producto-precio')?.value || 0),
      id_categoria: Number(document.querySelector('#producto-categoria')?.value || 0) || null,
      impuesto_especifico: Number(document.querySelector('#producto-impuesto')?.value || 0),
      pesable: document.querySelector('#producto-pesable')?.checked === true
    };

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Procesando...';
    }

    try {
      if (editingProductId) {
        const original = productosCache.find(p => p.id === editingProductId);
        await actualizarProducto(editingProductId, { ...payload, activo: original?.activo ?? true });
      } else {
        await crearProducto(payload);
      }

      closeModal();
      await loadData(false);
    } catch (error) {
      if (messageBox) {
        messageBox.textContent = error.message;
        messageBox.classList.remove('hidden');
        messageBox.classList.add('bg-rojoaviso/10', 'text-rojoaviso');
      }
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = editingProductId ? 'Guardar Cambios' : 'Guardar Producto';
      }
    }
  });

  // --- Initial Load ---
  await loadData();
}
