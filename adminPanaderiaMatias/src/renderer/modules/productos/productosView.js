import { getCategorias } from '../../services/masterService.js';
import { actualizarProducto, crearProducto, eliminarProducto, exportarBackupProductos, getProductos } from '../../services/productService.js';
import { escapeHtml, formatCurrency } from '../../utils/formatters.js';
import { getSession } from '../../state/sessionStore.js';

let productosCache = [];
let categoriasCache = [];
let currentPage = 1;
let searchQuery = '';
let editingProductId = null;

const ITEMS_PER_PAGE = 15;

export function renderProductosSkeleton() {
  const isAdmin = getSession()?.usuario?.rol === 'Admin';

  return `
    <div class="space-y-6">
      <header class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold text-[#2d221b]">Productos</h1>
          <p class="text-sm text-[#705f52] mt-1">Administra el catalogo y los datos para LabelNet.</p>
        </div>
        ${isAdmin ? `
          <div class="flex flex-col sm:flex-row sm:items-center gap-3">
            <button id="abrir-modal-nuevo" class="btn-primary">+ Agregar Producto</button>
            <button id="exportar-excel" class="btn-secondary">Exportar Excel</button>
          </div>
        ` : ''}
      </header>

      <div id="productos-progress-container" class="hidden h-1.5 w-full overflow-hidden rounded-full bg-cafe/10">
        <div id="productos-progress-bar" class="h-full bg-cafe transition-all duration-300" style="width: 0%"></div>
      </div>

      <div class="panel bg-white p-6">
        <div id="productos-page-message" class="hidden mb-4 rounded-xl px-4 py-3 text-sm"></div>
        <div class="mb-6 flex flex-col md:flex-row gap-4 items-center justify-between font-medium">
          <div class="relative w-full md:w-96">
            <input id="buscador-productos" type="text" class="field h-11" placeholder="Buscar por nombre o codigo...">
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

        <div class="mt-8 flex items-center justify-center gap-4">
          <button id="prev-page" class="btn-secondary py-2 px-4 text-xs disabled:opacity-30 disabled:cursor-not-allowed">Anterior</button>
          <span id="page-info" class="text-sm font-semibold text-cafe">Pagina 1 de 1</span>
          <button id="next-page" class="btn-secondary py-2 px-4 text-xs disabled:opacity-30 disabled:cursor-not-allowed">Siguiente</button>
        </div>
      </div>

      <div id="producto-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4 bg-tinta/40 backdrop-blur-sm">
        <div class="panel w-full max-w-3xl max-h-[90vh] bg-papel shadow-2xl overflow-hidden flex flex-col">
          <div class="p-6 border-b border-borde/40 flex items-center justify-between shrink-0">
            <h2 id="producto-modal-title" class="text-xl font-bold text-[#2d221b]">Nuevo Producto</h2>
            <button id="cerrar-modal" class="text-cafe/60 hover:text-cafe text-2xl font-light">&times;</button>
          </div>
          <form id="producto-form" class="flex-1 overflow-y-auto p-8 space-y-5">
            <input id="producto-id" type="hidden">

            <div class="grid gap-5 md:grid-cols-2">
              <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-cafe/60 mb-2">Codigo Interno</label>
                <input id="producto-codigo-interno" class="field" placeholder="Ej: 01476">
              </div>
              <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-cafe/60 mb-2">Codigo Externo</label>
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
                <label class="block text-xs font-bold uppercase tracking-wider text-cafe/60 mb-2">Categoria</label>
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
                <label class="block text-xs font-bold uppercase tracking-wider text-cafe/60 mb-2">Impuesto Especifico (%)</label>
                <input id="producto-impuesto" type="number" step="0.01" class="field" placeholder="0.00">
              </div>
            </div>

            <!-- Configuración de Promoción -->
            <div class="p-5 rounded-2xl bg-caramelo/5 border border-caramelo/20 space-y-4">
              <div class="flex items-center gap-2">
                <span class="text-lg">🏷️</span>
                <p class="text-xs font-black uppercase tracking-widest text-caramelo">Configuración de Promoción (Opcional)</p>
              </div>
              <div class="grid gap-5 md:grid-cols-2">
                <div>
                  <label class="block text-[10px] font-bold uppercase tracking-wider text-cafe/50 mb-2">Cantidad para Promo (ej: 2)</label>
                  <input id="producto-cantidad-promo" type="number" step="1" class="field" placeholder="0">
                </div>
                <div>
                  <label class="block text-[10px] font-bold uppercase tracking-wider text-cafe/50 mb-2">Precio de la Promo (ej: 1000)</label>
                  <input id="producto-precio-promo" type="number" step="0.01" class="field" placeholder="0.00">
                </div>
              </div>
              <p class="text-[9px] text-cafe/40 italic">* Si se configura, el sistema aplicará este precio al alcanzar la cantidad. El resto se cobra a precio normal.</p>
            </div>

            <div class="flex items-center justify-between p-4 rounded-2xl bg-crema/30 border border-borde/30">
              <div>
                <p class="text-sm font-black text-[#2d221b]">Producto Pesable</p>
                <p class="text-[10px] text-cafe/50 mt-0.5">Se vende por peso (kg/gramos), no por unidad.</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input id="producto-pesable" type="checkbox" class="sr-only peer">
                <div class="w-11 h-6 bg-cafe/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cafe"></div>
                <span class="ml-3 text-xs font-bold text-cafe/60 peer-has-[:checked]:text-cafe" id="pesable-label">No pesable</span>
              </label>
            </div>

            <div class="grid gap-5 md:grid-cols-3">
              <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-cafe/60 mb-2">PLU Balanza</label>
                <input id="producto-plu-balanza" type="number" min="1" class="field" placeholder="Ej: 123">
              </div>
              <div class="md:col-span-2">
                <label class="block text-xs font-bold uppercase tracking-wider text-cafe/60 mb-2">Nombre Etiqueta</label>
                <input id="producto-nombre-etiqueta" class="field" placeholder="Ej: PAN CORRIENTE">
              </div>
            </div>

            <div class="flex items-center justify-between p-4 rounded-2xl bg-papel/60 border border-borde/30">
              <div>
                <p class="text-sm font-black text-[#2d221b]">Enviar a LabelNet</p>
                <p class="text-[10px] text-cafe/50 mt-0.5">Incluye este producto en la exportacion para la balanza.</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input id="producto-activo-balanza" type="checkbox" class="sr-only peer">
                <div class="w-11 h-6 bg-cafe/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cafe"></div>
                <span class="ml-3 text-xs font-bold text-cafe/60 peer-has-[:checked]:text-cafe" id="balanza-label">No exportar</span>
              </label>
            </div>

            <div id="producto-form-message" class="hidden rounded-xl px-4 py-3 text-sm text-center"></div>
            <div class="sticky bottom-0 bg-papel pt-4 flex gap-3 justify-end border-t border-borde/40">
              <button id="cancelar-modal" type="button" class="btn-secondary px-8">Cancelar</button>
              <button id="producto-submit" type="submit" class="btn-primary px-10 font-bold">Guardar Producto</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
}

function showProgress(show) {
  const pContainer = document.querySelector('#productos-progress-container');
  const pBar = document.querySelector('#productos-progress-bar');
  if (!pContainer || !pBar) return;

  if (show) {
    pContainer.classList.remove('hidden');
    pBar.style.width = '30%';
    setTimeout(() => { pBar.style.width = '90%'; }, 150);
  } else {
    pBar.style.width = '100%';
    setTimeout(() => pContainer.classList.add('hidden'), 300);
  }
}

function showMessage(element, tone, text) {
  if (!element) return;

  element.textContent = text;
  element.className = 'rounded-xl px-4 py-3 text-sm border';

  if (tone === 'error') {
    element.classList.add('border-[#efc1bb]', 'bg-[#fff4f2]', 'text-rojoaviso');
  } else {
    element.classList.add('border-[#c5dfcb]', 'bg-[#eef8f0]', 'text-verdeok');
  }
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
            <th class="px-4 py-4">Codigos</th>
            <th class="px-4 py-4">Producto</th>
            <th class="px-4 py-4">Categoria</th>
            ${isAdmin ? '<th class="px-4 py-4">Costo</th>' : ''}
            <th class="px-4 py-4">P. Venta</th>
            ${isAdmin ? '<th class="px-4 py-4 text-center">PLU</th>' : ''}
            ${isAdmin ? '<th class="px-4 py-4 text-center">Margen</th>' : ''}
            <th class="px-4 py-4 text-center">Pesable</th>
            ${isAdmin ? '<th class="px-4 py-4 text-center">LabelNet</th>' : ''}
            <th class="px-4 py-4 text-center">Activo</th>
            ${isAdmin ? '<th class="px-4 py-4 text-right">Acciones</th>' : ''}
          </tr>
        </thead>
        <tbody class="divide-y divide-borde/20">
          ${productos.map((producto) => {
            const hasPromo = Number(producto.cantidad_promo) > 0 && Number(producto.precio_promo) > 0;
            return `
            <tr class="hover:bg-crema/10 transition-colors ${!producto.activo ? 'opacity-50 grayscale-[0.5]' : ''} ${hasPromo ? 'bg-caramelo/5' : ''}">
              <td class="px-4 py-4">
                <p class="font-mono text-[11px] text-cafe">IN: ${escapeHtml(producto.codigo_interno || '-')}</p>
                <p class="font-mono text-[10px] text-cafe/40">EX: ${escapeHtml(producto.codigo_barra_externo || '-')}</p>
              </td>
              <td class="px-4 py-4">
                <div class="flex items-center gap-2">
                  <p class="font-bold text-[#2d221b]">${escapeHtml(producto.nombre)}</p>
                  ${Number(producto.cantidad_promo) > 0 && Number(producto.precio_promo) > 0 ? `
                    <span class="px-3 py-1 rounded-full text-[8px] font-black bg-caramelo text-white uppercase tracking-tighter shadow-sm">PROMO</span>
                  ` : ''}
                </div>
                ${producto.nombre_etiqueta ? `<p class="text-[10px] text-cafe/40">ETQ: ${escapeHtml(producto.nombre_etiqueta)}</p>` : ''}
              </td>
              <td class="px-4 py-4 text-xs text-cafe/70">${escapeHtml(producto.categoria || '-')}</td>
              ${isAdmin ? `<td class="px-4 py-4 text-cafe/60 font-medium">${formatCurrency(producto.precio_costo)}</td>` : ''}
              <td class="px-4 py-4 font-black text-cafe">${formatCurrency(producto.precio_venta)}</td>
              ${isAdmin ? `<td class="px-4 py-4 text-center font-mono text-xs text-cafe">${escapeHtml(producto.plu_balanza || '-')}</td>` : ''}
              ${isAdmin ? `
                <td class="px-4 py-4 text-center">
                  <span class="badge ${producto.margen_porcentaje > 30 ? 'bg-verdeok/10 text-verdeok' : 'bg-caramelo/10 text-caramelo'}">
                    ${producto.margen_porcentaje}%
                  </span>
                </td>` : ''}
              <td class="px-4 py-4 text-center">
                ${producto.pesable ? '<span class="badge bg-azulaviso/10 text-azulaviso font-black">SI</span>' : '<span class="text-cafe/20 text-xs">-</span>'}
              </td>
              ${isAdmin ? `
                <td class="px-4 py-4 text-center">
                  ${producto.activo_balanza ? '<span class="badge bg-verdeok/10 text-verdeok font-black">ACTIVO</span>' : '<span class="text-cafe/20 text-xs">-</span>'}
                </td>` : ''}
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
                    <button class="w-8 h-8 rounded-lg bg-cafe text-white flex items-center justify-center hover:bg-[#4a2f1d] transition-colors" data-action="editar-producto" data-id="${escapeHtml(producto.id)}" title="Editar">E</button>
                    <button class="w-8 h-8 rounded-lg bg-rojoaviso/10 text-rojoaviso hover:bg-rojoaviso hover:text-white flex items-center justify-center transition-all" data-action="eliminar-producto" data-id="${escapeHtml(producto.id)}" title="Eliminar">X</button>
                  </div>
                </td>` : ''}
            </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function getFilteredProductos() {
  const term = searchQuery.toLowerCase();
  return productosCache.filter((p) =>
    (p.nombre || '').toLowerCase().includes(term) ||
    (p.codigo_interno || '').toLowerCase().includes(term) ||
    (p.codigo_barra_externo || '').toLowerCase().includes(term) ||
    (p.nombre_etiqueta || '').toLowerCase().includes(term)
  );
}

function syncToggleLabels() {
  const pesableCheck = document.querySelector('#producto-pesable');
  const pesableLabel = document.querySelector('#pesable-label');
  const balanzaCheck = document.querySelector('#producto-activo-balanza');
  const balanzaLabel = document.querySelector('#balanza-label');

  if (pesableLabel) pesableLabel.textContent = pesableCheck?.checked ? 'Pesable' : 'No pesable';
  if (balanzaLabel) balanzaLabel.textContent = balanzaCheck?.checked ? 'Exportar' : 'No exportar';
}

function openModal(producto = null) {
  const modal = document.querySelector('#producto-modal');
  const modalTitle = document.querySelector('#producto-modal-title');
  const submitButton = document.querySelector('#producto-submit');
  const messageBox = document.querySelector('#producto-form-message');
  const form = document.querySelector('#producto-form');

  editingProductId = producto?.id || null;
  modalTitle.textContent = producto ? `Editar Producto - ${producto.nombre}` : 'Nuevo Producto';
  submitButton.textContent = producto ? 'Guardar Cambios' : 'Guardar Producto';
  messageBox?.classList.add('hidden');

  if (producto) {
    document.querySelector('#producto-id').value = producto.id;
    document.querySelector('#producto-codigo-interno').value = producto.codigo_interno || '';
    document.querySelector('#producto-codigo-externo').value = producto.codigo_barra_externo || '';
    document.querySelector('#producto-nombre').value = producto.nombre || '';
    document.querySelector('#producto-unidad').value = producto.unidad || '';
    document.querySelector('#producto-costo').value = producto.precio_costo ?? '';
    document.querySelector('#producto-precio').value = producto.precio_venta ?? '';
    document.querySelector('#producto-categoria').value = producto.id_categoria ?? '';
    document.querySelector('#producto-impuesto').value = producto.impuesto_especifico ?? 0;
    document.querySelector('#producto-cantidad-promo').value = producto.cantidad_promo ?? 0;
    document.querySelector('#producto-precio-promo').value = producto.precio_promo ?? 0;
    document.querySelector('#producto-pesable').checked = !!producto.pesable;
    document.querySelector('#producto-plu-balanza').value = producto.plu_balanza ?? '';
    document.querySelector('#producto-nombre-etiqueta').value = producto.nombre_etiqueta || '';
    document.querySelector('#producto-activo-balanza').checked = !!producto.activo_balanza;
  } else {
    form?.reset();
    document.querySelector('#producto-id').value = '';
    document.querySelector('#producto-cantidad-promo').value = 0;
    document.querySelector('#producto-precio-promo').value = 0;
    document.querySelector('#producto-pesable').checked = false;
    document.querySelector('#producto-activo-balanza').checked = false;
  }

  syncToggleLabels();
  modal?.classList.remove('hidden');
}

function closeModal() {
  document.querySelector('#producto-modal')?.classList.add('hidden');
}

function downloadTextFile(filename, content) {
  const isCsv = filename.toLowerCase().endsWith('.csv');
  const blob = new Blob([content], { type: isCsv ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function enviarPluABalanza(content, host, port) {
  if (!window.electronAPI?.enviarPluBalanza) {
    throw new Error('El envio local a balanza solo esta disponible desde la app de escritorio.');
  }

  return window.electronAPI.enviarPluBalanza({
    host: host.trim(),
    port: Number(port),
    payload: content.endsWith('\n') ? content : `${content}\n`
  });
}

export async function hydrateProductosView() {
  const container = document.querySelector('#productos-table-container');
  const buscador = document.querySelector('#buscador-productos');
  const countLabel = document.querySelector('#total-productos-count');
  const pageInfo = document.querySelector('#page-info');
  const prevBtn = document.querySelector('#prev-page');
  const nextBtn = document.querySelector('#next-page');
  const openModalBtn = document.querySelector('#abrir-modal-nuevo');
  const exportExcelBtn = document.querySelector('#exportar-excel');
  const closeModalBtn = document.querySelector('#cerrar-modal');
  const cancelModalBtn = document.querySelector('#cancelar-modal');
  const modal = document.querySelector('#producto-modal');
  const form = document.querySelector('#producto-form');
  const submitButton = document.querySelector('#producto-submit');
  const messageBox = document.querySelector('#producto-form-message');
  const categorySelect = document.querySelector('#producto-categoria');
  const pageMessage = document.querySelector('#productos-page-message');

  async function renderTable() {
    const filtered = getFilteredProductos();
    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const pagedItems = filtered.slice(start, start + ITEMS_PER_PAGE);

    if (countLabel) countLabel.textContent = filtered.length;
    if (pageInfo) pageInfo.textContent = `Pagina ${currentPage} de ${totalPages}`;
    if (prevBtn) prevBtn.disabled = currentPage === 1;
    if (nextBtn) nextBtn.disabled = currentPage === totalPages;

    container.innerHTML = renderProductosTable(pagedItems);

    container.querySelectorAll('[data-action="editar-producto"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const producto = productosCache.find((p) => String(p.id) === btn.dataset.id);
        if (producto) openModal(producto);
      });
    });

    container.querySelectorAll('[data-action="toggle-status"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const producto = productosCache.find((p) => String(p.id) === btn.dataset.id);
        if (!producto) return;

        const newState = btn.getAttribute('aria-checked') === 'false';
        showProgress(true);
        try {
          await actualizarProducto(producto.id, { ...producto, activo: newState });
          producto.activo = newState;
          await renderTable();
        } catch (error) {
          showMessage(pageMessage, 'error', error.message);
        } finally {
          showProgress(false);
        }
      });
    });

    container.querySelectorAll('[data-action="eliminar-producto"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const producto = productosCache.find((p) => String(p.id) === btn.dataset.id);
        if (!producto) return;

        if (!window.confirm(`Eliminar "${producto.nombre}"?`)) return;

        showProgress(true);
        try {
          await eliminarProducto(producto.id);
          await loadData(false);
        } catch (error) {
          showMessage(pageMessage, 'error', error.message);
        } finally {
          showProgress(false);
        }
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

      categoriasCache = categoriasResponse.data || [];
      productosCache = productosResponse.data || [];

      categorySelect.innerHTML = `<option value="">Seleccione categoria</option>${categoriasCache.map((c) => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`).join('')}`;
      await renderTable();
    } catch (error) {
      container.innerHTML = `<div class="p-8 text-center text-rojoaviso">${escapeHtml(error.message)}</div>`;
    } finally {
      if (withProgress) showProgress(false);
    }
  }

  openModalBtn?.addEventListener('click', () => openModal());
  exportExcelBtn?.addEventListener('click', async () => {
    showProgress(true);
    try {
      const content = await exportarBackupProductos();
      downloadTextFile('productos.xlsx.csv', content);
      showMessage(pageMessage, 'success', 'Exportación Excel (CSV) generada correctamente.');
    } catch (error) {
      showMessage(pageMessage, 'error', error.message);
    } finally {
      showProgress(false);
    }
  });

  closeModalBtn?.addEventListener('click', closeModal);
  cancelModalBtn?.addEventListener('click', closeModal);
  /* El modal ya no se cierra al hacer clic fuera para evitar pérdida de datos */

  document.querySelector('#producto-pesable')?.addEventListener('change', syncToggleLabels);
  document.querySelector('#producto-activo-balanza')?.addEventListener('change', syncToggleLabels);

  buscador?.addEventListener('input', (event) => {
    searchQuery = event.target.value || '';
    currentPage = 1;
    renderTable();
  });

  prevBtn?.addEventListener('click', () => {
    currentPage -= 1;
    renderTable();
  });

  nextBtn?.addEventListener('click', () => {
    currentPage += 1;
    renderTable();
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const payload = {
      codigo_interno: document.querySelector('#producto-codigo-interno')?.value?.trim() || null,
      codigo_barra_externo: document.querySelector('#producto-codigo-externo')?.value?.trim() || null,
      nombre: document.querySelector('#producto-nombre')?.value?.trim() || null,
      unidad: document.querySelector('#producto-unidad')?.value?.trim() || null,
      precio_costo: Number(document.querySelector('#producto-costo')?.value || 0),
      precio_venta: Number(document.querySelector('#producto-precio')?.value || 0),
      id_categoria: Number(document.querySelector('#producto-categoria')?.value || 0) || null,
      impuesto_especifico: Number(document.querySelector('#producto-impuesto')?.value || 0),
      cantidad_promo: Number(document.querySelector('#producto-cantidad-promo')?.value || 0),
      precio_promo: Number(document.querySelector('#producto-precio-promo')?.value || 0),
      pesable: document.querySelector('#producto-pesable')?.checked === true,
      plu_balanza: document.querySelector('#producto-plu-balanza')?.value?.trim() || null,
      nombre_etiqueta: document.querySelector('#producto-nombre-etiqueta')?.value?.trim() || null,
      activo_balanza: document.querySelector('#producto-activo-balanza')?.checked === true
    };

    submitButton.disabled = true;
    submitButton.textContent = 'Procesando...';

    try {
      if (editingProductId) {
        const original = productosCache.find((p) => p.id === editingProductId);
        await actualizarProducto(editingProductId, { ...payload, activo: original?.activo ?? true });
      } else {
        await crearProducto(payload);
      }

      closeModal();
      await loadData(false);
      showMessage(pageMessage, 'success', 'Producto guardado correctamente.');
    } catch (error) {
      showMessage(messageBox, 'error', error.message);
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = editingProductId ? 'Guardar Cambios' : 'Guardar Producto';
    }
  });

  await loadData();
}
