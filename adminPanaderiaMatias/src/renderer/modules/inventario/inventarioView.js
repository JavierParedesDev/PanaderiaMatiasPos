import { ajustarInventario, getInventario } from '../../services/inventoryService.js';
import { escapeHtml } from '../../utils/formatters.js';

export function renderInventarioSkeleton() {
  return `
    <section class="space-y-6">
      <div>
        <p class="text-sm uppercase tracking-[0.28em] text-cafe/60">Sucursal</p>
        <h1 class="mt-2 text-3xl font-bold text-[#2d221b]">Inventario</h1>
      </div>
      <div class="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div class="panel p-6">
          <div class="mb-5 flex items-center justify-between">
            <h2 class="text-xl font-bold text-[#2d221b]">Stock actual</h2>
            <button id="recargar-inventario" class="btn-secondary">Recargar</button>
          </div>
          <div id="inventario-table">Cargando inventario...</div>
        </div>
        <div class="panel p-6">
          <h2 class="text-xl font-bold text-[#2d221b]">Ajuste manual</h2>
          <p class="mt-2 text-sm text-[#705f52]">Registra diferencias o correcciones de stock.</p>
          <form id="inventario-form" class="mt-6 space-y-4">
            <input id="ajuste-id-producto" type="number" class="field" placeholder="ID producto">
            <input id="ajuste-cantidad" type="number" step="0.01" class="field" placeholder="Cantidad ajustada">
            <textarea id="ajuste-observacion" class="field min-h-[140px]" placeholder="Observación"></textarea>
            <div id="inventario-message" class="hidden rounded-xl px-4 py-3 text-sm"></div>
            <button id="inventario-submit" type="submit" class="btn-primary w-full">Guardar ajuste</button>
          </form>
        </div>
      </div>
    </section>
  `;
}

function renderInventarioTable(items = []) {
  return `
    <div class="max-h-[650px] overflow-auto">
      <table class="min-w-full text-sm">
        <thead class="sticky top-0 bg-papel">
          <tr class="text-left text-[#6a584b]">
            <th class="px-3 py-3">ID</th>
            <th class="px-3 py-3">Código</th>
            <th class="px-3 py-3">Producto</th>
            <th class="px-3 py-3">Unidad</th>
            <th class="px-3 py-3">Stock</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item) => `
            <tr class="border-t border-borde/80">
              <td class="px-3 py-3">${escapeHtml(item.id)}</td>
              <td class="px-3 py-3">${escapeHtml(item.codigo_interno || '-')}</td>
              <td class="px-3 py-3 font-semibold text-[#2d221b]">${escapeHtml(item.nombre)}</td>
              <td class="px-3 py-3">${escapeHtml(item.unidad || '-')}</td>
              <td class="px-3 py-3 ${Number(item.stock_actual) <= 0 ? 'font-semibold text-rojoaviso' : 'text-[#2d221b]'}">${escapeHtml(item.stock_actual)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

export async function hydrateInventarioView() {
  const tableContainer = document.querySelector('#inventario-table');
  const reloadButton = document.querySelector('#recargar-inventario');
  const form = document.querySelector('#inventario-form');
  const messageBox = document.querySelector('#inventario-message');
  const submitButton = document.querySelector('#inventario-submit');

  async function loadInventario() {
    const response = await getInventario();
    tableContainer.innerHTML = renderInventarioTable(response.data || []);
  }

  try {
    await loadInventario();
  } catch (error) {
    tableContainer.innerHTML = `<div class="rounded-xl border border-[#efc1bb] bg-[#fff4f2] px-4 py-3 text-sm text-rojoaviso">${escapeHtml(error.message)}</div>`;
  }

  reloadButton?.addEventListener('click', async () => {
    tableContainer.innerHTML = 'Recargando inventario...';
    try {
      await loadInventario();
    } catch (error) {
      tableContainer.innerHTML = `<div class="rounded-xl border border-[#efc1bb] bg-[#fff4f2] px-4 py-3 text-sm text-rojoaviso">${escapeHtml(error.message)}</div>`;
    }
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = {
      id_producto: Number(document.querySelector('#ajuste-id-producto')?.value || 0),
      cantidad_ajustada: Number(document.querySelector('#ajuste-cantidad')?.value || 0),
      observacion: document.querySelector('#ajuste-observacion')?.value?.trim() || ''
    };

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Guardando ajuste...';
    }

    messageBox?.classList.add('hidden');
    messageBox?.classList.remove('border', 'bg-[#fff4f2]', 'text-rojoaviso', 'bg-[#eef8f0]', 'text-verdeok');

    try {
      const response = await ajustarInventario(payload);
      form.reset();
      messageBox.textContent = `${response.mensaje} Stock actual: ${response.stock_actual}`;
      messageBox.classList.add('border', 'border-[#c5dfcb]', 'bg-[#eef8f0]', 'text-verdeok');
      messageBox.classList.remove('hidden');
      await loadInventario();
    } catch (error) {
      messageBox.textContent = error.message;
      messageBox.classList.add('border', 'border-[#efc1bb]', 'bg-[#fff4f2]', 'text-rojoaviso');
      messageBox.classList.remove('hidden');
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Guardar ajuste';
      }
    }
  });
}
