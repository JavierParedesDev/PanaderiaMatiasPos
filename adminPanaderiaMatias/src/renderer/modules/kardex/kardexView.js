import { getFacturasIngreso, getKardexTodos, ingresarFactura, registrarMerma } from '../../services/kardexService.js';
import { getProveedores } from '../../services/masterService.js';
import { getProductos } from '../../services/productService.js';
import { escapeHtml, formatCurrency } from '../../utils/formatters.js';

let currentTab = 'auditoria';

function normalizeSearch(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function productOptionLabel(producto) {
  const stock = producto.stock_actual !== undefined && producto.stock_actual !== null
    ? `Stock: ${producto.stock_actual} ${producto.unidad || ''}`
    : 'Sin stock registrado';

  return `${producto.nombre} - ${stock}`;
}

function renderProductPicker(prefix, productos) {
  return `
    <input type="hidden" name="id_producto" id="${prefix}-producto-id" required>
    <input id="${prefix}-search" type="text" class="field h-11 text-sm" autocomplete="off" placeholder="Escribe nombre, codigo o PLU...">
    <div id="${prefix}-results" class="mt-2 max-h-64 overflow-y-auto rounded-2xl border border-borde bg-white shadow-sm"></div>
    <p id="${prefix}-selected" class="mt-2 text-xs font-bold text-cafe/45">Selecciona un producto de la lista.</p>
  `;
}

function attachProductPicker(prefix, productos) {
  const searchInput = document.querySelector(`#${prefix}-search`);
  const results = document.querySelector(`#${prefix}-results`);
  const hiddenInput = document.querySelector(`#${prefix}-producto-id`);
  const selectedLabel = document.querySelector(`#${prefix}-selected`);

  if (!searchInput || !results || !hiddenInput || !selectedLabel) return;

  const renderResults = () => {
    const term = normalizeSearch(searchInput.value);
    const matches = productos
      .filter((producto) => {
        if (!term) return true;
        return normalizeSearch([
          producto.nombre,
          producto.codigo_interno,
          producto.codigo_barra_externo,
          producto.plu_balanza
        ].filter(Boolean).join(' ')).includes(term);
      })
      .slice(0, 30);

    results.innerHTML = matches.length
      ? matches.map((producto) => `
          <button
            type="button"
            class="producto-option flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-crema/30"
            data-id="${producto.id}"
            data-label="${escapeHtml(producto.nombre)}"
          >
            <span class="min-w-0">
              <span class="block truncate font-bold text-[#2d221b]">${escapeHtml(producto.nombre)}</span>
              <span class="block text-[10px] font-bold uppercase tracking-wider text-cafe/40">${escapeHtml(productOptionLabel(producto))}</span>
            </span>
            <span class="shrink-0 rounded-lg bg-cafe/10 px-2 py-1 text-[10px] font-black text-cafe">ID ${producto.id}</span>
          </button>
        `).join('')
      : '<div class="px-4 py-6 text-center text-sm text-cafe/35">No hay productos con ese filtro.</div>';
  };

  searchInput.addEventListener('input', () => {
    hiddenInput.value = '';
    selectedLabel.textContent = 'Selecciona un producto de la lista.';
    renderResults();
  });

  results.addEventListener('click', (event) => {
    const option = event.target.closest('.producto-option');
    if (!option) return;

    hiddenInput.value = option.dataset.id;
    searchInput.value = option.dataset.label || '';
    selectedLabel.textContent = `Producto seleccionado: ${option.dataset.label || ''}`;
  });

  renderResults();
}

function renderFormMessage(id) {
  return `<div id="${id}" class="hidden rounded-2xl border px-4 py-3 text-sm font-bold"></div>`;
}

function showFormMessage(id, tone, message) {
  const box = document.querySelector(`#${id}`);
  if (!box) return;

  box.textContent = message;
  box.className = 'rounded-2xl border px-4 py-3 text-sm font-bold';
  if (tone === 'success') {
    box.classList.add('border-[#c5dfcb]', 'bg-[#eef8f0]', 'text-verdeok');
  } else {
    box.classList.add('border-[#efc1bb]', 'bg-[#fff4f2]', 'text-rojoaviso');
  }
}

function resetSubmitButton(button, label) {
  if (!button) return;
  button.disabled = false;
  button.innerText = label;
}

function formatDateOnly(value) {
  if (!value) return '-';
  const [date] = String(value).split('T');
  const parts = date.split('-');
  return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : date;
}

export function renderKardexSkeleton() {
  return `
    <div class="space-y-8 pb-10">
      <header>
        <h1 class="text-3xl font-black text-[#2d221b] tracking-tighter">Inventario y Auditoria</h1>
        <p class="text-sm font-medium text-[#705f52] mt-1">Control integral de movimientos, facturas y mermas.</p>
      </header>

      <div class="flex flex-wrap gap-2 p-1 bg-white/60 rounded-2xl w-fit border border-borde shadow-sm">
        <button class="tab-btn px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all bg-cafe text-white shadow-md" data-tab="auditoria">Kardex</button>
        <button class="tab-btn px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all text-cafe/60 hover:bg-white" data-tab="ingreso">Ingreso Facturas</button>
        <button class="tab-btn px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all text-cafe/60 hover:bg-white" data-tab="facturas">Facturas</button>
        <button class="tab-btn px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all text-cafe/60 hover:bg-white" data-tab="mermas">Mermas</button>
      </div>

      <div id="kardex-content">
        <div class="panel h-96 animate-pulse bg-white/50"></div>
      </div>
    </div>
  `;
}

/* AUDITORIA */
async function renderAuditoria(params = {}) {
  const container = document.querySelector('#kardex-content');
  container.innerHTML = `<div class="panel h-80 animate-pulse bg-white/50"></div>`;
  try {
    const page = params.page || 1;
    const res = await getKardexTodos({ page });
    const movimientos = res.data || [];
    const currentPage = Number(res.page || 1);
    const totalPages = Number(res.total_pages || 1);

    const typeStyle = (tipo) => {
      if (['COMPRA', 'CARGA_INICIAL', 'VENTA_ANULADA'].includes(tipo)) return 'bg-verdeok/10 text-verdeok';
      if (['VENTA', 'MERMA', 'AJUSTE_NEGATIVO'].includes(tipo)) return 'bg-rojoaviso/10 text-rojoaviso';
      return 'bg-azulaviso/10 text-azulaviso';
    };
    const isEntry = (tipo) => ['COMPRA', 'CARGA_INICIAL', 'VENTA_ANULADA'].includes(tipo);

    container.innerHTML = `
      <div class="panel bg-white shadow-sm overflow-hidden mb-4">
        <div class="px-6 py-4 border-b border-borde/30 flex items-center justify-between bg-crema/10">
          <h2 class="text-lg font-black text-[#2d221b]">Historial de Movimientos</h2>
          <span class="text-[10px] font-bold text-cafe/30 uppercase">${res.total_items || movimientos.length} registros</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead class="bg-crema/20 text-[10px] font-black uppercase tracking-widest text-cafe/50">
              <tr>
                <th class="px-5 py-3">Fecha</th>
                <th class="px-5 py-3">Producto</th>
                <th class="px-5 py-3 text-center">Tipo</th>
                <th class="px-5 py-3 text-right">Cant.</th>
                <th class="px-5 py-3 text-right">Stock Final</th>
                <th class="px-5 py-3">Responsable</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-borde/20 text-sm">
              ${movimientos.length ? movimientos.map(m => `
                <tr class="hover:bg-papel/10">
                  <td class="px-5 py-3 text-xs text-cafe/50">${new Date(m.fecha).toLocaleString('es-CL')}</td>
                  <td class="px-5 py-3">
                    <p class="font-bold text-[#2d221b] truncate max-w-[180px]">${escapeHtml(m.producto)}</p>
                    <p class="text-[10px] text-cafe/30">${escapeHtml(m.sucursal)}</p>
                  </td>
                  <td class="px-5 py-3 text-center">
                    <span class="px-2 py-0.5 rounded-md text-[10px] font-black ${typeStyle(m.tipo_movimiento)}">${m.tipo_movimiento}</span>
                  </td>
                  <td class="px-5 py-3 text-right font-black text-sm ${isEntry(m.tipo_movimiento) ? 'text-verdeok' : 'text-rojoaviso'}">
                    ${isEntry(m.tipo_movimiento) ? '+' : ''}${m.cantidad}
                  </td>
                  <td class="px-5 py-3 text-right font-black text-cafe">${m.stock_posterior}</td>
                  <td class="px-5 py-3 text-xs font-bold text-cafe/60">${escapeHtml(m.responsable)}</td>
                </tr>`).join('')
        : '<tr><td colspan="6" class="p-12 text-center italic text-cafe/25 text-xs uppercase tracking-widest">Sin movimientos registrados</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
      <div class="flex items-center justify-center gap-4 mt-6">
        <button id="kardex-prev" class="btn-secondary px-4 py-2 text-xs" ${currentPage <= 1 ? 'disabled' : ''}>Anterior</button>
        <span class="text-sm font-black text-cafe">Pagina ${currentPage} de ${totalPages}</span>
        <button id="kardex-next" class="btn-secondary px-4 py-2 text-xs" ${currentPage >= totalPages ? 'disabled' : ''}>Siguiente</button>
      </div>`;

    document.querySelector('#kardex-prev')?.addEventListener('click', async () => {
      await renderAuditoria({ page: Math.max(1, currentPage - 1) });
    });

    document.querySelector('#kardex-next')?.addEventListener('click', async () => {
      await renderAuditoria({ page: Math.min(totalPages, currentPage + 1) });
    });
  } catch (e) {
    container.innerHTML = errorCard(e.message);
  }
}

/* FACTURAS RECIBIDAS */
async function renderFacturasRecibidas(params = {}) {
  const container = document.querySelector('#kardex-content');
  container.innerHTML = `<div class="panel h-80 animate-pulse bg-white/50"></div>`;

  try {
    const [resFacturas, resProveedores] = await Promise.all([
      getFacturasIngreso({ ...params, page: params.page || 1 }),
      getProveedores()
    ]);
    const facturas = resFacturas.data || [];
    const currentFacturasPage = Number(resFacturas.page || params.page || 1);
    const totalFacturasPages = Number(resFacturas.total_pages || 1);
    const proveedores = (resProveedores.data || []).sort((a, b) =>
      String(a.nombre_empresa || '').localeCompare(String(b.nombre_empresa || ''))
    );

    const proveedorOptions = proveedores.map((proveedor) => `
      <option value="${proveedor.id}" ${String(params.id_proveedor || '') === String(proveedor.id) ? 'selected' : ''}>
        ${escapeHtml(proveedor.nombre_empresa || `Proveedor ${proveedor.id}`)}
      </option>
    `).join('');

    container.innerHTML = `
      <div class="space-y-5">
        <section class="panel bg-white p-5 shadow-sm">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 class="text-xl font-black text-[#2d221b]">Historial de Facturas Recibidas</h2>
              <p class="text-xs font-medium text-cafe/45">Busca por fecha, folio o proveedor.</p>
            </div>
            <form id="filtro-facturas" class="grid gap-3 md:grid-cols-[150px_150px_1fr_220px_auto] md:items-end">
              <div>
                <label class="block text-[10px] font-black uppercase tracking-widest text-cafe/45 mb-1">Desde</label>
                <input name="fecha_desde" type="date" class="field h-10 text-xs" value="${escapeHtml(params.fecha_desde || '')}">
              </div>
              <div>
                <label class="block text-[10px] font-black uppercase tracking-widest text-cafe/45 mb-1">Hasta</label>
                <input name="fecha_hasta" type="date" class="field h-10 text-xs" value="${escapeHtml(params.fecha_hasta || '')}">
              </div>
              <div>
                <label class="block text-[10px] font-black uppercase tracking-widest text-cafe/45 mb-1">Folio</label>
                <input name="folio" class="field h-10 text-xs" placeholder="Numero factura" value="${escapeHtml(params.folio || '')}">
              </div>
              <div>
                <label class="block text-[10px] font-black uppercase tracking-widest text-cafe/45 mb-1">Proveedor</label>
                <select name="id_proveedor" class="field h-10 text-xs">
                  <option value="">Todos</option>
                  ${proveedorOptions}
                </select>
              </div>
              <button type="submit" class="btn-secondary h-10 px-4 py-2 text-xs">Filtrar</button>
            </form>
          </div>
        </section>

        <div class="grid gap-4">
          ${facturas.length ? facturas.map((factura) => {
            const detalle = Array.isArray(factura.detalle) ? factura.detalle : [];
            const fecha = formatDateOnly(factura.fecha_emision);
            return `
              <article class="panel bg-white p-5 shadow-sm">
                <div class="flex flex-col gap-3 border-b border-borde/30 pb-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p class="text-[10px] font-black uppercase tracking-widest text-cafe/35">Factura recibida</p>
                    <h3 class="text-lg font-black text-[#2d221b]">Folio ${escapeHtml(factura.numero_factura)}</h3>
                    <p class="text-sm font-bold text-cafe/60">${escapeHtml(factura.proveedor)} · ${escapeHtml(factura.sucursal)} · ${fecha}</p>
                  </div>
                  <div class="text-left md:text-right">
                    <p class="text-[10px] font-black uppercase tracking-widest text-cafe/35">Total</p>
                    <p class="text-xl font-black text-cafe">${formatCurrency(factura.monto_total || 0)}</p>
                    <p class="text-[10px] font-bold uppercase tracking-widest text-cafe/35">${detalle.length} items</p>
                  </div>
                </div>

                <div class="mt-4 overflow-x-auto">
                  <table class="w-full text-left text-sm">
                    <thead class="text-[10px] font-black uppercase tracking-widest text-cafe/40">
                      <tr>
                        <th class="py-2 pr-3">Producto</th>
                        <th class="py-2 px-3 text-right">Cantidad</th>
                        <th class="py-2 px-3 text-right">Costo</th>
                        <th class="py-2 pl-3 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-borde/20">
                      ${detalle.map((item) => `
                        <tr>
                          <td class="py-2 pr-3 font-bold text-[#2d221b]">${escapeHtml(item.producto || `Producto ${item.id_producto}`)}</td>
                          <td class="py-2 px-3 text-right font-bold text-cafe/70">${item.cantidad}</td>
                          <td class="py-2 px-3 text-right font-bold text-cafe/70">${formatCurrency(item.costo_unitario || 0)}</td>
                          <td class="py-2 pl-3 text-right font-black text-cafe">${formatCurrency(item.subtotal || 0)}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              </article>
            `;
          }).join('') : `
            <div class="panel bg-white p-10 text-center">
              <p class="text-sm font-black uppercase tracking-widest text-cafe/30">Sin facturas para los filtros seleccionados</p>
            </div>
          `}
        </div>

        <div class="flex items-center justify-center gap-4">
          <button id="facturas-prev" class="btn-secondary px-4 py-2 text-xs" ${currentFacturasPage <= 1 ? 'disabled' : ''}>Anterior</button>
          <span class="text-sm font-black text-cafe">Pagina ${currentFacturasPage} de ${totalFacturasPages}</span>
          <button id="facturas-next" class="btn-secondary px-4 py-2 text-xs" ${currentFacturasPage >= totalFacturasPages ? 'disabled' : ''}>Siguiente</button>
        </div>
      </div>`;

    document.querySelector('#filtro-facturas')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const f = new FormData(event.target);
      await renderFacturasRecibidas({
        fecha_desde: f.get('fecha_desde'),
        fecha_hasta: f.get('fecha_hasta'),
        folio: f.get('folio'),
        id_proveedor: f.get('id_proveedor'),
        page: 1
      });
    });

    document.querySelector('#facturas-prev')?.addEventListener('click', async () => {
      await renderFacturasRecibidas({ ...params, page: Math.max(1, currentFacturasPage - 1) });
    });

    document.querySelector('#facturas-next')?.addEventListener('click', async () => {
      await renderFacturasRecibidas({ ...params, page: Math.min(totalFacturasPages, currentFacturasPage + 1) });
    });
  } catch (e) {
    container.innerHTML = errorCard(e.message);
  }
}

/* INGRESO FACTURAS */
async function renderIngreso() {
  const container = document.querySelector('#kardex-content');
  container.innerHTML = `<div class="panel h-80 animate-pulse bg-white/50"></div>`;

  try {
    const [resProd, resProveedores] = await Promise.all([getProductos(), getProveedores()]);
    const productos = (resProd.data || []).sort((a, b) => a.nombre.localeCompare(b.nombre));
    const proveedores = (resProveedores.data || []).sort((a, b) =>
      String(a.nombre_empresa || '').localeCompare(String(b.nombre_empresa || ''))
    );

    container.innerHTML = `
      <div class="max-w-5xl mx-auto">
        <div class="panel bg-white p-8 shadow-lg border-t-4 border-t-azulaviso rounded-3xl">
          <div class="flex items-center gap-4 mb-6">
            <div class="w-12 h-12 rounded-2xl bg-azulaviso/10 flex items-center justify-center text-xl font-black text-azulaviso">IN</div>
            <div>
              <h2 class="text-xl font-black text-[#2d221b]">Ingreso por Factura</h2>
              <p class="text-xs text-cafe/50">Agrega todos los productos de la factura antes de registrar.</p>
            </div>
          </div>

          <form id="form-factura" class="space-y-5">
            <div class="grid gap-4 md:grid-cols-2">
              <div>
                <label class="block text-[10px] font-black uppercase tracking-widest text-cafe/50 mb-1.5">Numero Factura</label>
                <input name="numero_factura" class="field h-11 text-sm" required placeholder="Ej: 45672">
              </div>
              <div>
                <label class="block text-[10px] font-black uppercase tracking-widest text-cafe/50 mb-1.5">Proveedor</label>
                <select name="id_proveedor" class="field h-11 text-sm" required>
                  <option value="">Selecciona proveedor</option>
                  ${proveedores.map((proveedor) => `
                    <option value="${proveedor.id}">${escapeHtml(proveedor.nombre_empresa || `Proveedor ${proveedor.id}`)}</option>
                  `).join('')}
                </select>
              </div>
            </div>

            <div class="pt-2 pb-1 border-t border-borde/30">
              <p class="text-[10px] font-black uppercase tracking-widest text-cafe/40">Agregar producto</p>
            </div>

            <div>
              <label class="block text-[10px] font-black uppercase tracking-widest text-cafe/50 mb-1.5">Buscar Producto</label>
              ${renderProductPicker('factura', productos)}
            </div>

            <div class="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
              <div>
                <label class="block text-[10px] font-black uppercase tracking-widest text-cafe/50 mb-1.5">Cantidad</label>
                <input name="cantidad" type="number" step="0.01" class="field h-11 text-sm font-bold" value="1" min="0.01">
              </div>
              <div>
                <label class="block text-[10px] font-black uppercase tracking-widest text-cafe/50 mb-1.5">Costo Unitario ($)</label>
                <input name="costo_unitario" type="number" step="0.01" class="field h-11 text-sm font-bold" placeholder="0.00">
              </div>
              <button type="button" id="btn-agregar-item-factura" class="btn-secondary h-11 px-5 py-2 text-xs">Agregar item</button>
            </div>

            <div class="rounded-2xl border border-borde bg-crema/10 overflow-hidden">
              <div class="flex items-center justify-between px-4 py-3 border-b border-borde/30">
                <p class="text-[10px] font-black uppercase tracking-widest text-cafe/45">Detalle de factura</p>
                <p id="factura-total-label" class="text-sm font-black text-cafe">${formatCurrency(0)}</p>
              </div>
              <div id="factura-items" class="divide-y divide-borde/20">
                <div class="p-5 text-center text-sm text-cafe/35">Agrega uno o mas productos antes de registrar.</div>
              </div>
            </div>

            <button type="submit" id="btn-factura" class="w-full h-13 py-3 bg-cafe text-white rounded-2xl font-black text-base shadow-lg hover:scale-[1.02] transition-all mt-2">
              Registrar factura e incrementar stock
            </button>
            ${renderFormMessage('factura-message')}
          </form>
        </div>
      </div>`;

    attachProductPicker('factura', productos);

    const invoiceItems = [];
    const renderInvoiceItems = () => {
      const list = document.querySelector('#factura-items');
      const totalLabel = document.querySelector('#factura-total-label');
      const total = invoiceItems.reduce((sum, item) => sum + (item.cantidad * item.costo_unitario), 0);

      if (totalLabel) totalLabel.textContent = formatCurrency(total);
      if (!list) return;

      list.innerHTML = invoiceItems.length
        ? invoiceItems.map((item, index) => `
            <div class="grid gap-3 px-4 py-3 text-sm md:grid-cols-[minmax(0,1fr)_90px_120px_120px_auto] md:items-center">
              <div class="min-w-0">
                <p class="truncate font-bold text-[#2d221b]">${escapeHtml(item.nombre)}</p>
                <p class="text-[10px] font-bold uppercase tracking-wider text-cafe/35">ID ${item.id_producto}</p>
              </div>
              <p class="font-black text-cafe">${item.cantidad}</p>
              <p class="font-bold text-cafe/70">${formatCurrency(item.costo_unitario)}</p>
              <p class="font-black text-cafe">${formatCurrency(item.cantidad * item.costo_unitario)}</p>
              <button type="button" class="rounded-lg bg-rojoaviso/10 px-3 py-2 text-[10px] font-black text-rojoaviso" data-remove-item="${index}">Quitar</button>
            </div>
          `).join('')
        : '<div class="p-5 text-center text-sm text-cafe/35">Agrega uno o mas productos antes de registrar.</div>';
    };

    document.querySelector('#factura-items')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-remove-item]');
      if (!button) return;
      invoiceItems.splice(Number(button.dataset.removeItem), 1);
      renderInvoiceItems();
    });

    document.querySelector('#btn-agregar-item-factura')?.addEventListener('click', () => {
      const form = document.querySelector('#form-factura');
      const f = new FormData(form);
      const idProducto = parseInt(f.get('id_producto'), 10);
      const qty = parseFloat(f.get('cantidad'));
      const cost = parseFloat(f.get('costo_unitario')) || 0;
      const producto = productos.find((item) => Number(item.id) === idProducto);

      if (!producto) {
        showFormMessage('factura-message', 'error', 'Selecciona un producto de la lista antes de agregarlo.');
        return;
      }

      if (!Number.isFinite(qty) || qty <= 0) {
        showFormMessage('factura-message', 'error', 'La cantidad debe ser mayor a cero.');
        return;
      }

      const existing = invoiceItems.find((item) => item.id_producto === idProducto && item.costo_unitario === cost);
      if (existing) {
        existing.cantidad = Number((existing.cantidad + qty).toFixed(3));
      } else {
        invoiceItems.push({
          id_producto: idProducto,
          nombre: producto.nombre,
          cantidad: qty,
          costo_unitario: cost
        });
      }

      document.querySelector('#factura-producto-id').value = '';
      document.querySelector('#factura-search').value = '';
      document.querySelector('#factura-selected').textContent = 'Selecciona un producto de la lista.';
      renderInvoiceItems();
      showFormMessage('factura-message', 'success', 'Item agregado al detalle.');
    });

    document.querySelector('#form-factura')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.querySelector('#btn-factura');
      btn.disabled = true;
      btn.innerText = 'Procesando...';

      const f = new FormData(e.target);
      const idProveedor = parseInt(f.get('id_proveedor'), 10);

      if (!Number.isInteger(idProveedor) || idProveedor <= 0) {
        showFormMessage('factura-message', 'error', 'Selecciona un proveedor antes de registrar la factura.');
        resetSubmitButton(btn, 'Registrar factura e incrementar stock');
        return;
      }

      if (!invoiceItems.length) {
        showFormMessage('factura-message', 'error', 'Agrega al menos un producto al detalle de la factura.');
        resetSubmitButton(btn, 'Registrar factura e incrementar stock');
        return;
      }

      const total = invoiceItems.reduce((sum, item) => sum + (item.cantidad * item.costo_unitario), 0);
      const payload = {
        numero_factura: f.get('numero_factura'),
        id_proveedor: idProveedor,
        fecha_emision: new Date().toISOString().split('T')[0],
        monto_total: total,
        detalle_productos: invoiceItems.map((item) => ({
          id_producto: item.id_producto,
          cantidad: item.cantidad,
          costo_unitario: item.costo_unitario
        }))
      };

      try {
        await ingresarFactura(payload);
        showFormMessage('factura-message', 'success', 'Factura ingresada. Stock actualizado correctamente.');
        const tab = document.querySelector('[data-tab="facturas"]');
        if (tab) { tab.click(); } else { await renderFacturasRecibidas(); }
      } catch (err) {
        showFormMessage('factura-message', 'error', err.message);
        resetSubmitButton(btn, 'Registrar factura e incrementar stock');
      }
    });
  } catch (e) {
    container.innerHTML = errorCard(e.message);
  }
}
async function renderMermas() {
  const container = document.querySelector('#kardex-content');
  container.innerHTML = `<div class="panel h-80 animate-pulse bg-white/50"></div>`;
  try {
    const resProd = await getProductos();
    const productos = (resProd.data || []).sort((a, b) => a.nombre.localeCompare(b.nombre));

    container.innerHTML = `
      <div class="max-w-2xl mx-auto">
        <div class="panel bg-white p-8 shadow-lg border-t-4 border-t-rojoaviso rounded-3xl">
          <div class="flex items-center gap-4 mb-6">
            <div class="w-12 h-12 rounded-2xl bg-rojoaviso/10 flex items-center justify-center text-xl font-black text-rojoaviso">ME</div>
            <div>
              <h2 class="text-xl font-black text-[#2d221b]">Registro de Merma</h2>
              <p class="text-xs text-cafe/50">El stock se descontara automaticamente.</p>
            </div>
          </div>

          <form id="form-merma" class="space-y-5">
            <!-- Buscador de producto -->
            <div>
              <label class="block text-[10px] font-black uppercase tracking-widest text-cafe/50 mb-1.5">Buscar Producto</label>
              ${renderProductPicker('merma', productos)}
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-[10px] font-black uppercase tracking-widest text-cafe/50 mb-1.5">Cantidad a Descontar</label>
                <input name="cantidad" type="number" step="0.01" class="field h-11 text-sm font-bold" placeholder="0.00">
              </div>
              <div>
                <label class="block text-[10px] font-black uppercase tracking-widest text-cafe/50 mb-1.5">Motivo</label>
                <select name="motivo" class="field h-11 text-sm font-bold">
                  <option value="Vencimiento">Vencimiento</option>
                  <option value="Dano/Rotura">Dano / Rotura</option>
                  <option value="Robo/Perdida">Robo / Perdida</option>
                  <option value="Consumo Personal">Consumo Personal</option>
                </select>
              </div>
            </div>

            <button type="submit" id="btn-merma" class="w-full py-3 bg-rojoaviso text-white rounded-2xl font-black text-base shadow-lg hover:scale-[1.02] transition-all mt-2">
              Registrar Merma y Rebajar Stock
            </button>
            ${renderFormMessage('merma-message')}
          </form>
        </div>
      </div>`;

    attachProductPicker('merma', productos);

    document.querySelector('#form-merma')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.querySelector('#btn-merma');
      btn.disabled = true;
      btn.innerText = 'Procesando...';
      const f = new FormData(e.target);
      const idProducto = parseInt(f.get('id_producto'), 10);
      const cantidad = parseFloat(f.get('cantidad'));
      if (!Number.isInteger(idProducto) || idProducto <= 0) {
        showFormMessage('merma-message', 'error', 'Selecciona un producto de la lista antes de registrar la merma.');
        resetSubmitButton(btn, 'Registrar Merma y Rebajar Stock');
        return;
      }
      if (!Number.isFinite(cantidad) || cantidad <= 0) {
        showFormMessage('merma-message', 'error', 'La cantidad de merma debe ser mayor a cero.');
        resetSubmitButton(btn, 'Registrar Merma y Rebajar Stock');
        return;
      }
      const payload = {
        id_producto: idProducto,
        cantidad,
        motivo: f.get('motivo')
      };
      try {
        await registrarMerma(payload);
        showFormMessage('merma-message', 'success', 'Merma registrada. Stock actualizado.');
        const tab = document.querySelector('[data-tab="auditoria"]');
        if (tab) { tab.click(); } else { await renderAuditoria(); }
      } catch (err) {
        showFormMessage('merma-message', 'error', err.message);
        resetSubmitButton(btn, 'Registrar Merma y Rebajar Stock');
      }
    });
  } catch (e) {
    container.innerHTML = errorCard(e.message);
  }
}

function errorCard(msg) {
  return `<div class="panel p-10 text-center text-rojoaviso font-bold bg-white rounded-3xl shadow">Error: ${escapeHtml(msg)}</div>`;
}

/* TABS */
export async function hydrateKardexView() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      currentTab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('bg-cafe', 'text-white', 'shadow-md');
        b.classList.add('text-cafe/60', 'hover:bg-white');
      });
      btn.classList.remove('text-cafe/60', 'hover:bg-white');
      btn.classList.add('bg-cafe', 'text-white', 'shadow-md');

      if (currentTab === 'auditoria') await renderAuditoria();
      if (currentTab === 'ingreso') await renderIngreso();
      if (currentTab === 'facturas') await renderFacturasRecibidas();
      if (currentTab === 'mermas') await renderMermas();
    });
  });

  await renderAuditoria();
}


