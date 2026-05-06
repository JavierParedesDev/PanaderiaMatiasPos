import { fijarInventario, getInventario } from '../../services/inventoryService.js';
import { getSucursales } from '../../services/masterService.js';
import { escapeHtml } from '../../utils/formatters.js';
import { getSession } from '../../state/sessionStore.js';

let inventarioCache = [];
let sucursalesCache = [];
let currentSucursalId = null;
let searchQuery = '';
let currentPage = 1;
let selectedProduct = null;

const ITEMS_PER_PAGE = 50;

export function renderInventarioSkeleton() {
  return `
    <section class="space-y-6">
      <header class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p class="text-sm uppercase tracking-[0.28em] text-cafe/60">Stock por sucursal</p>
          <h1 class="mt-2 text-3xl font-bold text-[#2d221b]">Inventario</h1>
          <p class="mt-2 text-sm text-[#705f52]">Lista simple de productos con su stock actual y minimo critico.</p>
        </div>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
          <select id="inventario-sucursal" class="field min-w-[220px]">
            <option value="">Cargando sucursales...</option>
          </select>
          <button id="recargar-inventario" class="btn-secondary">Recargar</button>
        </div>
      </header>

      <div class="panel p-6">
        <div class="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 class="text-xl font-bold text-[#2d221b]">Productos y stock</h2>
            <p id="inventario-count" class="mt-1 text-xs uppercase tracking-[0.2em] text-cafe/40">0 productos</p>
          </div>
          <div class="relative w-full lg:w-80">
            <input id="inventario-search" type="text" class="field pr-11" placeholder="Buscar por nombre o codigo...">
            <span class="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-cafe/30">SKU</span>
          </div>
        </div>

        <div id="inventario-message" class="hidden mb-4 rounded-xl px-4 py-3 text-sm"></div>
        <div id="inventario-table">Cargando inventario...</div>

        <div class="mt-5 flex items-center justify-between gap-3">
          <button id="inventario-prev" class="btn-secondary px-4 py-2 text-xs">Anterior</button>
          <p id="inventario-page-info" class="text-xs font-bold uppercase tracking-[0.18em] text-cafe/45">Pagina 1 de 1</p>
          <button id="inventario-next" class="btn-secondary px-4 py-2 text-xs">Siguiente</button>
        </div>
      </div>

      <div id="inventario-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4 bg-tinta/40 backdrop-blur-sm">
        <div class="panel w-full max-w-md bg-papel shadow-2xl overflow-hidden">
          <div class="p-6 border-b border-borde/30 flex items-center justify-between">
            <div>
              <h2 class="text-xl font-bold text-[#2d221b]">Ajustar stock</h2>
              <p id="inventario-modal-producto" class="mt-1 text-xs uppercase tracking-[0.18em] text-cafe/45"></p>
            </div>
            <button id="cerrar-inventario-modal" class="text-cafe/60 hover:text-cafe text-2xl font-light">&times;</button>
          </div>

          <form id="inventario-modal-form" class="p-6 space-y-4">
            <div class="rounded-2xl bg-crema/30 p-4">
              <p class="text-[10px] uppercase tracking-widest text-cafe/40">Stock actual</p>
              <p id="inventario-stock-actual-label" class="mt-1 text-2xl font-black text-cafe">0</p>
            </div>

            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-cafe/60 mb-2">Nuevo stock</label>
              <input id="inventario-stock-input" type="number" step="0.01" min="0" class="field" placeholder="0">
            </div>

            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-cafe/60 mb-2">Stock minimo critico</label>
              <input id="inventario-stock-minimo-input" type="number" step="0.01" min="0" class="field" placeholder="0">
              <p class="mt-1 text-[10px] text-cafe/40">Se marcara como critico cuando el stock actual sea igual o menor a este valor.</p>
            </div>

            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-cafe/60 mb-2">Observacion</label>
              <textarea id="inventario-stock-observacion" class="field min-h-[110px]" placeholder="Motivo del cambio"></textarea>
            </div>

            <div id="inventario-modal-message" class="hidden rounded-xl px-4 py-3 text-sm"></div>

            <div class="pt-2 flex gap-3 justify-end">
              <button id="cancelar-inventario-modal" type="button" class="btn-secondary px-6">Cancelar</button>
              <button id="guardar-inventario-modal" type="submit" class="btn-primary px-8">Guardar</button>
            </div>
          </form>
        </div>
      </div>
    </section>
  `;
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

function getDefaultSucursalId() {
  const sessionSucursal = Number(getSession()?.usuario?.id_sucursal);
  if (Number.isInteger(sessionSucursal) && sessionSucursal > 0) return sessionSucursal;
  return null;
}

function getFilteredItems() {
  const term = searchQuery.trim().toLowerCase();
  if (!term) return inventarioCache;

  return inventarioCache.filter((item) =>
    (item.nombre || '').toLowerCase().includes(term) ||
    (item.codigo_interno || '').toLowerCase().includes(term)
  );
}

function getPaginationState(items) {
  const totalPages = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  return {
    totalPages,
    pageItems: items.slice(startIndex, startIndex + ITEMS_PER_PAGE)
  };
}

function renderInventarioTable(items = []) {
  if (!items.length) {
    return `<div class="rounded-2xl border border-dashed border-borde bg-crema/10 px-6 py-12 text-center text-sm text-cafe/50">No hay productos para mostrar en esta sucursal.</div>`;
  }

  return `
    <div class="max-h-[650px] overflow-auto rounded-2xl border border-borde/40">
      <table class="min-w-full text-sm">
        <thead class="sticky top-0 bg-papel">
          <tr class="text-left text-[#6a584b]">
            <th class="px-3 py-3">Codigo</th>
            <th class="px-3 py-3">Producto</th>
            <th class="px-3 py-3">Unidad</th>
            <th class="px-3 py-3 text-right">Stock</th>
            <th class="px-3 py-3 text-right">Minimo</th>
            <th class="px-3 py-3 text-right">Accion</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item) => {
            const stockActual = Number(item.stock_actual ?? 0);
            const stockMinimo = Number(item.stock_minimo ?? 0);
            const critical = stockMinimo > 0 && stockActual <= stockMinimo;

            return `
              <tr class="border-t border-borde/60 hover:bg-crema/20">
                <td class="px-3 py-3 text-xs font-mono text-cafe/70">${escapeHtml(item.codigo_interno || '-')}</td>
                <td class="px-3 py-3">
                  <p class="font-semibold text-[#2d221b]">${escapeHtml(item.nombre)}</p>
                </td>
                <td class="px-3 py-3">${escapeHtml(item.unidad || '-')}</td>
                <td class="px-3 py-3 text-right font-black ${critical ? 'text-rojoaviso' : 'text-[#2d221b]'}">${escapeHtml(item.stock_actual)}</td>
                <td class="px-3 py-3 text-right font-bold ${critical ? 'text-rojoaviso' : 'text-cafe/50'}">${escapeHtml(item.stock_minimo ?? 0)}</td>
                <td class="px-3 py-3 text-right">
                  <button class="btn-secondary px-3 py-2 text-xs" data-ajustar-stock="${escapeHtml(item.id)}">Ajustar stock</button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderTable() {
  const tableContainer = document.querySelector('#inventario-table');
  const count = document.querySelector('#inventario-count');
  const pageInfo = document.querySelector('#inventario-page-info');
  const prevButton = document.querySelector('#inventario-prev');
  const nextButton = document.querySelector('#inventario-next');
  const filteredItems = getFilteredItems();
  const { totalPages, pageItems } = getPaginationState(filteredItems);

  if (count) count.textContent = `${filteredItems.length} productos`;
  if (pageInfo) pageInfo.textContent = `Pagina ${currentPage} de ${totalPages}`;
  if (prevButton) prevButton.disabled = currentPage === 1;
  if (nextButton) nextButton.disabled = currentPage === totalPages;
  if (tableContainer) tableContainer.innerHTML = renderInventarioTable(pageItems);
}

function openModal(product) {
  selectedProduct = product;

  const modal = document.querySelector('#inventario-modal');
  const productLabel = document.querySelector('#inventario-modal-producto');
  const stockLabel = document.querySelector('#inventario-stock-actual-label');
  const stockInput = document.querySelector('#inventario-stock-input');
  const stockMinimoInput = document.querySelector('#inventario-stock-minimo-input');
  const observacionInput = document.querySelector('#inventario-stock-observacion');
  const modalMessage = document.querySelector('#inventario-modal-message');

  if (productLabel) productLabel.textContent = `${product.codigo_interno || 'SIN CODIGO'} - ${product.nombre}`;
  if (stockLabel) stockLabel.textContent = String(product.stock_actual ?? 0);
  if (stockInput) stockInput.value = product.stock_actual ?? 0;
  if (stockMinimoInput) stockMinimoInput.value = product.stock_minimo ?? 0;
  if (observacionInput) observacionInput.value = '';
  if (modalMessage) modalMessage.classList.add('hidden');

  modal?.classList.remove('hidden');
}

function closeModal() {
  selectedProduct = null;
  document.querySelector('#inventario-modal')?.classList.add('hidden');
}

export async function hydrateInventarioView() {
  const sucursalSelect = document.querySelector('#inventario-sucursal');
  const reloadButton = document.querySelector('#recargar-inventario');
  const searchInput = document.querySelector('#inventario-search');
  const messageBox = document.querySelector('#inventario-message');
  const prevButton = document.querySelector('#inventario-prev');
  const nextButton = document.querySelector('#inventario-next');
  const modal = document.querySelector('#inventario-modal');
  const closeModalButton = document.querySelector('#cerrar-inventario-modal');
  const cancelModalButton = document.querySelector('#cancelar-inventario-modal');
  const modalForm = document.querySelector('#inventario-modal-form');
  const modalMessage = document.querySelector('#inventario-modal-message');
  const modalSubmitButton = document.querySelector('#guardar-inventario-modal');

  async function loadSucursales() {
    const response = await getSucursales();
    sucursalesCache = response.data || [];
    currentSucursalId = currentSucursalId || getDefaultSucursalId() || Number(sucursalesCache[0]?.id || 0) || null;

    if (sucursalSelect) {
      sucursalSelect.innerHTML = sucursalesCache
        .map((sucursal) => `<option value="${sucursal.id}">${escapeHtml(sucursal.nombre)}</option>`)
        .join('');

      if (currentSucursalId) {
        sucursalSelect.value = String(currentSucursalId);
      }
    }
  }

  async function loadInventario() {
    const response = await getInventario({ id_sucursal: currentSucursalId });
    inventarioCache = response.data || [];
    currentPage = 1;
    renderTable();
  }

  async function loadScreen() {
    await loadSucursales();
    await loadInventario();
  }

  document.querySelector('#inventario-table')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-ajustar-stock]');
    if (!button) return;

    const product = inventarioCache.find((item) => Number(item.id) === Number(button.dataset.ajustarStock));
    if (!product) return;

    openModal(product);
  });

  try {
    await loadScreen();
  } catch (error) {
    const tableContainer = document.querySelector('#inventario-table');
    if (tableContainer) {
      tableContainer.innerHTML = `<div class="rounded-xl border border-[#efc1bb] bg-[#fff4f2] px-4 py-3 text-sm text-rojoaviso">${escapeHtml(error.message)}</div>`;
    }
  }

  sucursalSelect?.addEventListener('change', async () => {
    currentSucursalId = Number(sucursalSelect.value || 0) || null;
    currentPage = 1;
    messageBox?.classList.add('hidden');

    try {
      await loadInventario();
    } catch (error) {
      showMessage(messageBox, 'error', error.message);
    }
  });

  reloadButton?.addEventListener('click', async () => {
    try {
      await loadInventario();
      showMessage(messageBox, 'success', 'Inventario recargado correctamente.');
    } catch (error) {
      showMessage(messageBox, 'error', error.message);
    }
  });

  searchInput?.addEventListener('input', (event) => {
    searchQuery = event.target.value || '';
    currentPage = 1;
    renderTable();
  });

  prevButton?.addEventListener('click', () => {
    currentPage -= 1;
    renderTable();
  });

  nextButton?.addEventListener('click', () => {
    currentPage += 1;
    renderTable();
  });

  closeModalButton?.addEventListener('click', closeModal);
  cancelModalButton?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });

  modalForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!selectedProduct) {
      showMessage(modalMessage, 'error', 'No hay producto seleccionado.');
      return;
    }

    modalSubmitButton.disabled = true;
    modalSubmitButton.textContent = 'Guardando...';

    try {
      const stockActual = Number(document.querySelector('#inventario-stock-input')?.value || 0);
      const stockMinimo = Number(document.querySelector('#inventario-stock-minimo-input')?.value || 0);
      const observacion = document.querySelector('#inventario-stock-observacion')?.value?.trim() || 'Ajuste manual de stock';

      const response = await fijarInventario(selectedProduct.id, {
        id_sucursal: currentSucursalId,
        stock_actual: stockActual,
        stock_minimo: stockMinimo,
        observacion
      });

      showMessage(messageBox, 'success', `${response.mensaje} Stock actual: ${response.stock_actual}.`);
      closeModal();
      await loadInventario();
    } catch (error) {
      showMessage(modalMessage, 'error', error.message);
    } finally {
      modalSubmitButton.disabled = false;
      modalSubmitButton.textContent = 'Guardar';
    }
  });
}
