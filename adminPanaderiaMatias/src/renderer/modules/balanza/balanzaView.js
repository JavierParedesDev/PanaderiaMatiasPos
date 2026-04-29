import { actualizarProducto, exportarProductosLabelNet, getProductos, importarProductosLabelNet } from '../../services/productService.js';
import { escapeHtml, formatCurrency } from '../../utils/formatters.js';

const SCALES_STORAGE_KEY = 'panaderia_matias_balanzas';
const DEFAULT_SCALES = [
  { id: 'digi-sm120-239', nombre: 'DIGI SM-120LL', ip: '192.168.1.239', puerto: 2239, activa: true }
];

let productosCache = [];
let balanzasCache = [];
let selectedScaleId = '';
let searchQuery = '';
let onlyReady = true;
let currentPage = 1;
let directFormat = 'digi-f1-25';

const ITEMS_PER_PAGE = 50;

export function renderBalanzaSkeleton() {
  return `
    <div class="space-y-6">
      <header class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 class="text-3xl font-bold text-[#2d221b]">Balanza</h1>
          <p class="text-sm text-[#705f52] mt-1">Administra PLU, precios y envio a las balanzas DIGI.</p>
        </div>
        <div class="grid gap-3 sm:grid-cols-[1fr_140px_96px_auto] lg:w-[660px]">
          <input id="balanza-nombre" class="field h-11" value="DIGI SM-120LL" aria-label="Nombre balanza">
          <input id="balanza-ip" class="field h-11" value="192.168.1.239" aria-label="IP balanza">
          <input id="balanza-puerto" class="field h-11" value="2239" inputmode="numeric" aria-label="Puerto balanza">
          <button id="agregar-balanza" class="btn-secondary h-11">Agregar</button>
        </div>
      </header>

      <div id="balanza-progress-container" class="hidden h-1.5 w-full overflow-hidden rounded-full bg-cafe/10">
        <div id="balanza-progress-bar" class="h-full bg-cafe transition-all duration-300" style="width: 0%"></div>
      </div>

      <div id="balanza-message" class="hidden rounded-xl px-4 py-3 text-sm border"></div>
      <div id="balanza-diagnostics" class="hidden panel bg-white p-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-sm font-black text-[#2d221b]">Diagnostico ultimo envio</p>
            <p id="balanza-diagnostics-summary" class="mt-1 text-xs text-cafe/60"></p>
          </div>
          <button id="copiar-plu-preview" class="btn-secondary h-10 px-3 py-2">Copiar muestra</button>
        </div>
        <pre id="balanza-payload-preview" class="mt-3 max-h-40 overflow-auto rounded-xl border border-borde bg-crema/20 p-3 text-xs text-cafe"></pre>
      </div>

      <section class="grid gap-5 2xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside class="panel bg-white p-5 space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-black text-[#2d221b]">Balanzas</h2>
            <span id="balanzas-count" class="badge bg-cafe/10 text-cafe">0</span>
          </div>
          <div id="balanzas-list" class="space-y-2"></div>
        </aside>

        <main class="panel min-w-0 bg-white p-4 sm:p-6 space-y-5">
          <div class="grid gap-4 xl:grid-cols-[minmax(220px,1fr)_auto_auto_auto] xl:items-center">
            <input id="buscar-plu" class="field h-11" placeholder="Buscar PLU, nombre o codigo">
            <label class="flex items-center gap-3 text-sm font-semibold text-cafe">
              <input id="solo-listos" type="checkbox" class="h-4 w-4 accent-[#6b4226]" checked>
              Solo listos para balanza
            </label>
            <select id="formato-directo" class="field h-11 min-w-44 py-2" aria-label="Formato directo">
              <option value="digi-f1-25" selected>Directo: DIGI F1-25</option>
              <option value="standard">Directo: TXT estandar</option>
              <option value="legacy">Directo: LabelNet legacy</option>
              <option value="tws-csv">Directo: TWS CSV</option>
              <option value="tws-frame">Directo: TWS frame</option>
            </select>
            <div class="flex flex-wrap justify-end gap-2">
              <input id="importar-labelnet-file" type="file" accept=".csv,text/csv" class="hidden">
              <button id="importar-labelnet" class="btn-secondary h-11">Importar CSV</button>
              <button id="enviar-plu-balanza" class="btn-secondary h-11">Envio masivo pausado</button>
            </div>
          </div>

          <div class="grid gap-3 md:grid-cols-4">
            <div class="rounded-xl border border-borde bg-crema/20 p-4">
              <p class="text-[10px] font-black uppercase tracking-widest text-cafe/40">Productos PLU</p>
              <p id="metric-plu" class="text-2xl font-black text-cafe">0</p>
            </div>
            <div class="rounded-xl border border-borde bg-crema/20 p-4">
              <p class="text-[10px] font-black uppercase tracking-widest text-cafe/40">Listos</p>
              <p id="metric-ready" class="text-2xl font-black text-verdeok">0</p>
            </div>
            <div class="rounded-xl border border-borde bg-crema/20 p-4">
              <p class="text-[10px] font-black uppercase tracking-widest text-cafe/40">Sin PLU</p>
              <p id="metric-missing" class="text-2xl font-black text-caramelo">0</p>
            </div>
            <div class="rounded-xl border border-borde bg-crema/20 p-4">
              <p class="text-[10px] font-black uppercase tracking-widest text-cafe/40">Seleccionada</p>
              <p id="metric-scale" class="truncate text-sm font-black text-[#2d221b]">-</p>
            </div>
          </div>

          <div id="plu-table-container">
            <div class="animate-pulse space-y-4">
              <div class="h-10 bg-crema/50 rounded-lg w-full"></div>
              <div class="h-12 bg-crema/20 rounded-lg w-full"></div>
              <div class="h-12 bg-crema/20 rounded-lg w-full"></div>
            </div>
          </div>

          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
            <button id="balanza-prev-page" class="btn-secondary h-10 px-4 py-2 disabled:opacity-30">Anterior</button>
            <span id="balanza-page-info" class="text-center text-sm font-semibold text-cafe">Pagina 1 de 1</span>
            <button id="balanza-next-page" class="btn-secondary h-10 px-4 py-2 disabled:opacity-30">Siguiente</button>
          </div>
        </main>
      </section>
    </div>
  `;
}

function loadScales() {
  try {
    const stored = JSON.parse(localStorage.getItem(SCALES_STORAGE_KEY) || 'null');
    if (Array.isArray(stored) && stored.length) return stored;
  } catch {
    // Use defaults when localStorage has invalid content.
  }

  return DEFAULT_SCALES;
}

function saveScales() {
  localStorage.setItem(SCALES_STORAGE_KEY, JSON.stringify(balanzasCache));
}

function selectedScale() {
  return balanzasCache.find((scale) => scale.id === selectedScaleId) || balanzasCache[0] || null;
}

function showProgress(show) {
  const pContainer = document.querySelector('#balanza-progress-container');
  const pBar = document.querySelector('#balanza-progress-bar');
  if (!pContainer || !pBar) return;

  if (show) {
    pContainer.classList.remove('hidden');
    pBar.style.width = '35%';
    setTimeout(() => { pBar.style.width = '88%'; }, 150);
  } else {
    pBar.style.width = '100%';
    setTimeout(() => pContainer.classList.add('hidden'), 300);
  }
}

function showMessage(tone, text) {
  const element = document.querySelector('#balanza-message');
  if (!element) return;

  element.textContent = text;
  element.className = 'rounded-xl px-4 py-3 text-sm border';

  if (tone === 'error') {
    element.classList.add('border-[#efc1bb]', 'bg-[#fff4f2]', 'text-rojoaviso');
  } else {
    element.classList.add('border-[#c5dfcb]', 'bg-[#eef8f0]', 'text-verdeok');
  }
}

function showDiagnostics(result, content) {
  const box = document.querySelector('#balanza-diagnostics');
  const summary = document.querySelector('#balanza-diagnostics-summary');
  const preview = document.querySelector('#balanza-payload-preview');
  if (!box || !summary || !preview) return;

  const responseHex = result.responseHex ? ` Respuesta HEX: ${result.responseHex}.` : '';
  const responseText = result.response ? ` Respuesta: ${result.response.slice(0, 120)}` : ' Sin respuesta de la balanza.';
  summary.textContent = `Enviado a ${result.host}:${result.port}. Bytes: ${result.bytesSent}.${responseHex}${responseText}`;
  preview.textContent = content.split('\n').slice(0, 12).join('\n');
  box.classList.remove('hidden');
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function parseCsv(content) {
  const lines = content
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '');

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce((row, header, index) => {
      row[header] = values[index] ?? '';
      return row;
    }, {});
  });
}

function isReadyForScale(producto) {
  return producto.activo && producto.pesable && producto.activo_balanza && producto.plu_balanza;
}

function getFilteredProducts() {
  const term = searchQuery.toLowerCase();

  return productosCache
    .filter((producto) => !onlyReady || isReadyForScale(producto))
    .filter((producto) =>
      String(producto.plu_balanza || '').includes(term) ||
      (producto.nombre || '').toLowerCase().includes(term) ||
      (producto.nombre_etiqueta || '').toLowerCase().includes(term) ||
      (producto.codigo_interno || '').toLowerCase().includes(term) ||
      (producto.codigo_barra_externo || '').toLowerCase().includes(term)
    )
    .sort((a, b) => Number(a.plu_balanza || 999999) - Number(b.plu_balanza || 999999));
}

function buildProductPayload(producto, overrides = {}) {
  return {
    codigo_interno: producto.codigo_interno || null,
    codigo_barra_externo: producto.codigo_barra_externo || null,
    nombre: producto.nombre || null,
    unidad: producto.unidad || null,
    precio_costo: Number(producto.precio_costo || 0),
    precio_venta: Number(producto.precio_venta || 0),
    id_categoria: producto.id_categoria || null,
    activo: producto.activo,
    pesable: !!producto.pesable,
    plu_balanza: producto.plu_balanza || null,
    nombre_etiqueta: producto.nombre_etiqueta || producto.nombre || null,
    activo_balanza: !!producto.activo_balanza,
    ...overrides
  };
}

function renderScales() {
  const list = document.querySelector('#balanzas-list');
  const count = document.querySelector('#balanzas-count');
  const metricScale = document.querySelector('#metric-scale');
  if (!list) return;

  if (count) count.textContent = balanzasCache.length;
  const activeScale = selectedScale();
  if (metricScale) metricScale.textContent = activeScale ? `${activeScale.ip}:${activeScale.puerto}` : '-';

  if (!balanzasCache.length) {
    list.innerHTML = '<p class="py-6 text-center text-sm text-cafe/40">Agrega una balanza para enviar PLU.</p>';
    return;
  }

  list.innerHTML = balanzasCache.map((scale) => {
    const active = selectedScaleId === scale.id;
    return `
      <button class="w-full rounded-xl border p-4 text-left transition ${active ? 'border-cafe bg-crema/50' : 'border-borde bg-white hover:bg-crema/20'}" data-scale-id="${escapeHtml(scale.id)}">
        <div class="flex items-center justify-between gap-3">
          <p class="font-black text-[#2d221b]">${escapeHtml(scale.nombre)}</p>
          <span class="h-2.5 w-2.5 rounded-full ${scale.activa ? 'bg-verdeok' : 'bg-cafe/20'}"></span>
        </div>
        <p class="mt-1 font-mono text-xs text-cafe">${escapeHtml(scale.ip)}:${escapeHtml(scale.puerto)}</p>
      </button>
    `;
  }).join('');

  list.querySelectorAll('[data-scale-id]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedScaleId = button.dataset.scaleId;
      renderScales();
    });
  });
}

function renderMetrics() {
  const withPlu = productosCache.filter((producto) => producto.plu_balanza).length;
  const ready = productosCache.filter(isReadyForScale).length;
  const missing = productosCache.filter((producto) => producto.pesable && !producto.plu_balanza).length;

  document.querySelector('#metric-plu').textContent = withPlu;
  document.querySelector('#metric-ready').textContent = ready;
  document.querySelector('#metric-missing').textContent = missing;
}

function renderProducts() {
  const container = document.querySelector('#plu-table-container');
  if (!container) return;

  const products = getFilteredProducts();
  const totalPages = Math.ceil(products.length / ITEMS_PER_PAGE) || 1;
  const pageInfo = document.querySelector('#balanza-page-info');
  const prevButton = document.querySelector('#balanza-prev-page');
  const nextButton = document.querySelector('#balanza-next-page');

  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const pagedProducts = products.slice(start, start + ITEMS_PER_PAGE);

  if (pageInfo) pageInfo.textContent = `Pagina ${currentPage} de ${totalPages} - ${products.length} productos`;
  if (prevButton) prevButton.disabled = currentPage === 1;
  if (nextButton) nextButton.disabled = currentPage === totalPages;

  renderMetrics();

  if (!pagedProducts.length) {
    container.innerHTML = '<div class="py-16 text-center text-cafe/40">No hay productos PLU con esos filtros.</div>';
    return;
  }

  container.innerHTML = `
    <div class="max-w-full overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead class="bg-crema/30">
          <tr class="text-left text-[#6a584b] uppercase tracking-tighter text-[10px] font-black opacity-60">
            <th class="px-4 py-4">PLU</th>
            <th class="px-4 py-4">Producto</th>
            <th class="px-4 py-4">Precio</th>
            <th class="px-4 py-4">Etiqueta</th>
            <th class="px-4 py-4 text-center">Estado</th>
            <th class="px-4 py-4 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-borde/20">
          ${pagedProducts.map((producto) => `
            <tr data-product-id="${escapeHtml(producto.id)}">
              <td class="px-4 py-4">
                <input class="field h-10 w-24 py-2 font-mono" data-field="plu_balanza" type="number" min="1" value="${escapeHtml(producto.plu_balanza || '')}">
              </td>
              <td class="px-4 py-4 min-w-56 max-w-72">
                <p class="font-bold text-[#2d221b]">${escapeHtml(producto.nombre)}</p>
                <p class="font-mono text-[10px] text-cafe/40">IN: ${escapeHtml(producto.codigo_interno || '-')} | EX: ${escapeHtml(producto.codigo_barra_externo || '-')}</p>
              </td>
              <td class="px-4 py-4">
                <input class="field h-10 w-32 py-2" data-field="precio_venta" type="number" min="0" step="1" value="${escapeHtml(producto.precio_venta || 0)}">
                <p class="mt-1 text-[10px] text-cafe/40">${formatCurrency(producto.precio_venta)}</p>
              </td>
              <td class="px-4 py-4 min-w-52">
                <input class="field h-10 py-2" data-field="nombre_etiqueta" value="${escapeHtml(producto.nombre_etiqueta || producto.nombre || '')}">
              </td>
              <td class="px-4 py-4 text-center">
                ${isReadyForScale(producto)
                  ? '<span class="badge bg-verdeok/10 text-verdeok">LISTO</span>'
                  : '<span class="badge bg-caramelo/10 text-caramelo">REVISAR</span>'}
              </td>
              <td class="px-4 py-4 text-right">
                <div class="flex min-w-56 justify-end gap-2">
                  <button class="btn-secondary h-10 px-3 py-2" data-action="guardar">Guardar</button>
                  <button class="btn-primary h-10 px-3 py-2" data-action="guardar-exportar">Exportar</button>
                  <button class="btn-primary h-10 px-3 py-2" data-action="enviar-individual">Enviar a pesa</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  container.querySelectorAll('[data-action="guardar"], [data-action="guardar-exportar"], [data-action="enviar-individual"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const row = button.closest('[data-product-id]');
      const product = productosCache.find((item) => String(item.id) === row?.dataset.productId);
      if (!row || !product) return;

      const plu = row.querySelector('[data-field="plu_balanza"]')?.value?.trim() || null;
      const price = Number(row.querySelector('[data-field="precio_venta"]')?.value || 0);
      const labelName = row.querySelector('[data-field="nombre_etiqueta"]')?.value?.trim() || null;
      const action = button.dataset.action;
      const shouldExport = action === 'guardar-exportar';

      const overrides = {
        plu_balanza: plu,
        precio_venta: price,
        nombre_etiqueta: labelName,
        pesable: true,
        activo_balanza: true
      };

      if (action === 'enviar-individual') {
        await saveAndSendProduct(product, overrides);
        return;
      }

      await saveProduct(product, overrides, shouldExport);
    });
  });
}

async function sendCurrentPlu() {
  const scale = selectedScale();
  if (!scale) {
    throw new Error('Selecciona una balanza.');
  }

  if (!window.electronAPI?.enviarPluBalanza) {
    throw new Error('El envio local a balanza solo esta disponible desde la app de escritorio.');
  }

  const content = await exportarProductosLabelNet();
  const result = await sendPluContent(content, scale);

  showDiagnostics(result, content);
  return result;
}

async function sendSinglePlu(plu) {
  const scale = selectedScale();
  if (!scale) {
    throw new Error('Selecciona una balanza.');
  }

  if (!window.electronAPI?.enviarPluBalanza) {
    throw new Error('El envio local a balanza solo esta disponible desde la app de escritorio.');
  }

  const content = await exportarProductosLabelNet({ plu_balanza: plu });
  const result = await sendPluContent(content, scale);

  showDiagnostics(result, content);
  return result;
}

function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function encodeDigiBcd(value) {
  const digits = String(Math.max(0, Number(value) || 0)).padStart(8, '0').slice(-8);
  const bytes = new Uint8Array(4);

  for (let i = 0; i < 4; i += 1) {
    const high = Number(digits[i * 2]);
    const low = Number(digits[(i * 2) + 1]);
    bytes[i] = (high << 4) | low;
  }

  return bytes;
}

function encodeLatin1(text) {
  const bytes = new Uint8Array(text.length);

  for (let i = 0; i < text.length; i += 1) {
    bytes[i] = text.charCodeAt(i) & 0xff;
  }

  return bytes;
}

function buildDigiPluRecord(producto) {
  const plu = Number(producto.plu_balanza || 0);
  const price = String(Math.max(0, Math.round(Number(producto.precio_venta || 0))));
  const name = String(producto.nombre_etiqueta || producto.nombre || '')
    .trim()
    .toUpperCase()
    .replace(/"/g, '""')
    .slice(0, 120);
  const ean = String(producto.codigo_barra_externo || '')
    .replace(/\D/g, '')
    .slice(0, 10)
    || String(plu).padStart(5, '0').padEnd(10, '0');

  const fields = Array.from({ length: 127 }, () => '0');
  fields[0] = String(plu);
  fields[1] = '';
  fields[2] = producto.pesable ? '0' : '1';
  fields[18] = price;
  fields[21] = '5';
  fields[22] = '25';
  fields[23] = ean;
  fields[24] = '';
  fields[27] = '108';
  fields[74] = '000000';
  fields[75] = '0000';
  fields[76] = '000000';
  fields[77] = '0000';
  fields[100] = '';
  fields[101] = '4';
  fields[102] = `"${name}"`;
  fields[104] = '';
  fields[106] = '';
  fields[108] = '';

  return `${fields.join(',')}\r\n`;
}

function buildDigiF125Payload(producto) {
  const plu = Number(producto.plu_balanza || 0);
  const previousPlu = Math.max(0, plu - 1);
  const record = encodeLatin1(buildDigiPluRecord(producto));
  const recordLength = record.length + 6;
  const endMarker = new Uint8Array([0xf1, 0x25, 0x00, 0x99, 0x99, 0x99, 0xe2]);
  const payload = new Uint8Array(13 + record.length + endMarker.length);

  payload[0] = 0xf1;
  payload[1] = 0x25;
  payload.set(encodeDigiBcd(previousPlu), 2);
  payload.set(encodeDigiBcd(plu), 6);
  payload[10] = (recordLength >>> 8) & 0xff;
  payload[11] = recordLength & 0xff;
  payload.set(record, 12);
  payload[12 + record.length] = 0xe1;
  payload.set(endMarker, 13 + record.length);

  return payload;
}

function buildDirectPayload(producto, format) {
  const plu = String(producto.plu_balanza || '').trim();
  const price = String(Number(producto.precio_venta || 0));
  const ean = String(producto.codigo_barra_externo || '').trim();
  const name = String(producto.nombre_etiqueta || producto.nombre || '').trim().toUpperCase().slice(0, 120);

  if (format === 'digi-f1-25') {
    return buildDigiF125Payload(producto);
  }

  if (format === 'legacy') {
    return `${name}\t${price}\t${plu}\t${ean}\t20\t1\n`;
  }

  if (format === 'tws-csv' || format === 'tws-frame') {
    const fields = Array.from({ length: 127 }, () => '0');
    fields[0] = plu;
    fields[1] = '';
    fields[2] = '1';
    fields[18] = price;
    fields[19] = '0';
    fields[20] = '0';
    fields[21] = '5';
    fields[22] = '25';
    fields[23] = ean || plu.padStart(5, '0').padEnd(10, '0');
    fields[24] = '';
    fields[27] = '106';
    fields[74] = '000000';
    fields[75] = '0000';
    fields[76] = '000000';
    fields[77] = '0000';
    fields[100] = '';
    fields[101] = '4';
    fields[102] = `"${name.replace(/"/g, '""')}"`;

    const csv = fields.join(',');

    if (format === 'tws-csv') {
      return `${csv}\n`;
    }

    const csvBytes = new TextEncoder().encode(csv);
    const prefix = new Uint8Array(6);
    const pluNumber = Number(plu) || 0;
    prefix[0] = (pluNumber >>> 24) & 0xff;
    prefix[1] = (pluNumber >>> 16) & 0xff;
    prefix[2] = (pluNumber >>> 8) & 0xff;
    prefix[3] = pluNumber & 0xff;
    prefix[4] = 1;
    prefix[5] = csvBytes.length & 0xff;

    const payload = new Uint8Array(prefix.length + csvBytes.length);
    payload.set(prefix, 0);
    payload.set(csvBytes, prefix.length);
    return payload;
  }

  return `${plu}\t${price}\t0\t${ean}\t997\t${name}\n`;
}

async function testDirectPlu(producto) {
  const scale = selectedScale();
  if (!scale) {
    showMessage('error', 'Selecciona una balanza.');
    return false;
  }

  if (!window.electronAPI?.enviarPluBalanza) {
    showMessage('error', 'El envio local a balanza solo esta disponible desde la app de escritorio.');
    return false;
  }

  showProgress(true);

  try {
    const format = 'digi-f1-25';
    const payload = buildDirectPayload(producto, format);
    const preview = payload instanceof Uint8Array
      ? Array.from(payload.slice(0, 80)).map((byte) => byte.toString(16).padStart(2, '0')).join(' ')
      : payload;
    const result = await sendPluContent(payload, scale);
    showDiagnostics(result, preview);
    showMessage('success', `Prueba directa enviada con formato ${format}. Revisa el PLU en la balanza.`);
    return true;
  } catch (error) {
    showMessage('error', error.message);
    return false;
  } finally {
    showProgress(false);
  }
}

async function saveAndSendProduct(product, overrides) {
  showProgress(true);

  try {
    const payload = buildProductPayload(product, overrides);
    await actualizarProducto(product.id, payload);

    const productForScale = {
      ...product,
      ...payload,
      plu_balanza: overrides.plu_balanza || product.plu_balanza,
      precio_venta: overrides.precio_venta,
      nombre_etiqueta: overrides.nombre_etiqueta || product.nombre_etiqueta || product.nombre,
      pesable: true,
      activo_balanza: true
    };

    const sent = await testDirectPlu(productForScale);
    if (!sent) return;

    await loadProducts(false);
    showMessage('success', `PLU ${productForScale.plu_balanza} guardado y enviado a la pesa.`);
  } catch (error) {
    showMessage('error', error.message);
  } finally {
    showProgress(false);
  }
}

async function exportSinglePlu(plu) {
  const content = await exportarProductosLabelNet({ plu_balanza: plu, header: false, format: 'legacy' });
  downloadTextFile(`labelnet_plu_${plu}.txt`, content);
  showDiagnostics(
    {
      host: 'LabelNet',
      port: 'archivo',
      bytesSent: new Blob([content]).size,
      response: 'Archivo generado para importar/enviar desde LabelNet.'
    },
    content
  );
}

async function sendPluContent(content, scale) {
  const result = await window.electronAPI.enviarPluBalanza({
    host: scale.ip,
    port: Number(scale.puerto),
    payload: typeof content === 'string' && !content.endsWith('\n') ? `${content}\n` : content
  });

  return result;
}

async function saveProduct(product, overrides, shouldExport) {
  showProgress(true);

  try {
    await actualizarProducto(product.id, buildProductPayload(product, overrides));
    await loadProducts(false);

    if (shouldExport) {
      await exportSinglePlu(overrides.plu_balanza || product.plu_balanza);
      showMessage('success', 'Producto guardado y archivo LabelNet generado.');
    } else {
      showMessage('success', 'Producto PLU guardado correctamente.');
    }
  } catch (error) {
    showMessage('error', error.message);
  } finally {
    showProgress(false);
  }
}

async function loadProducts(withProgress = true) {
  if (withProgress) showProgress(true);

  try {
    const response = await getProductos();
    productosCache = response.data || [];
    renderProducts();
  } catch (error) {
    showMessage('error', error.message);
  } finally {
    if (withProgress) showProgress(false);
  }
}

async function importLabelNetCsv(file) {
  if (!file) return;

  showProgress(true);

  try {
    const content = await file.text();
    const productos = parseCsv(content)
      .map((row) => ({
        plu_balanza: row.plu_balanza || row.PLU_No || row.plu || '',
        nombre: row.nombre || row.Name || row.name || '',
        precio_venta: row.precio_venta || row.PLU_UPrice || row['Unit Price'] || 0,
        codigo_barra_externo: row.codigo_barra_externo || row.PLU_EANItemCode || row.ItemCode || row['Item Code'] || '',
        mg: row.mg || row.PLU_MG || ''
      }))
      .filter((row) => row.plu_balanza && row.nombre);

    if (!productos.length) {
      showMessage('error', 'El archivo no tiene productos PLU validos.');
      return;
    }

    const response = await importarProductosLabelNet({
      productos,
      unidad: 'KG'
    });

    const data = response.data;
    await loadProducts(false);
    showMessage(
      'success',
      `${response.mensaje} Recibidos: ${data.recibidos}. Errores: ${data.errores.length}.`
    );
  } catch (error) {
    showMessage('error', error.message);
  } finally {
    showProgress(false);
  }
}

export async function hydrateBalanzaView() {
  balanzasCache = loadScales();
  selectedScaleId = balanzasCache[0]?.id || '';

  const addScaleButton = document.querySelector('#agregar-balanza');
  const sendButton = document.querySelector('#enviar-plu-balanza');
  const importButton = document.querySelector('#importar-labelnet');
  const importFileInput = document.querySelector('#importar-labelnet-file');
  const searchInput = document.querySelector('#buscar-plu');
  const onlyReadyInput = document.querySelector('#solo-listos');
  const copyPreviewButton = document.querySelector('#copiar-plu-preview');
  const directFormatSelect = document.querySelector('#formato-directo');
  const prevPageButton = document.querySelector('#balanza-prev-page');
  const nextPageButton = document.querySelector('#balanza-next-page');

  renderScales();

  addScaleButton?.addEventListener('click', () => {
    const name = document.querySelector('#balanza-nombre')?.value?.trim() || 'Balanza';
    const ip = document.querySelector('#balanza-ip')?.value?.trim();
    const port = Number(document.querySelector('#balanza-puerto')?.value || 0);

    if (!ip || !Number.isInteger(port) || port <= 0 || port > 65535) {
      showMessage('error', 'Indica una IP y puerto validos para la balanza.');
      return;
    }

    const scale = {
      id: `${ip}:${port}:${Date.now()}`,
      nombre: name,
      ip,
      puerto: port,
      activa: true
    };

    balanzasCache.push(scale);
    selectedScaleId = scale.id;
    saveScales();
    renderScales();
    showMessage('success', 'Balanza agregada.');
  });

  sendButton?.addEventListener('click', async () => {
    showMessage('error', 'Envio masivo pausado mientras calibramos DIGI F1-25. Usa el boton Probar de una fila.');
  });

  importButton?.addEventListener('click', () => {
    importFileInput?.click();
  });

  importFileInput?.addEventListener('change', async (event) => {
    const [file] = event.target.files || [];
    await importLabelNetCsv(file);
    event.target.value = '';
  });

  searchInput?.addEventListener('input', (event) => {
    searchQuery = event.target.value || '';
    currentPage = 1;
    renderProducts();
  });

  onlyReadyInput?.addEventListener('change', (event) => {
    onlyReady = event.target.checked;
    currentPage = 1;
    renderProducts();
  });

  directFormatSelect?.addEventListener('change', (event) => {
    directFormat = event.target.value || 'standard';
  });

  prevPageButton?.addEventListener('click', () => {
    currentPage -= 1;
    renderProducts();
  });

  nextPageButton?.addEventListener('click', () => {
    currentPage += 1;
    renderProducts();
  });

  copyPreviewButton?.addEventListener('click', async () => {
    const preview = document.querySelector('#balanza-payload-preview')?.textContent || '';
    if (!preview) return;

    await navigator.clipboard.writeText(preview);
    showMessage('success', 'Muestra PLU copiada.');
  });

  await loadProducts();
}
