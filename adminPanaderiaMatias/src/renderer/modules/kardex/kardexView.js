import { getKardexTodos, ingresarFactura, registrarMerma } from '../../services/kardexService.js';
import { getProductos } from '../../services/productService.js';
import { escapeHtml, formatCurrency } from '../../utils/formatters.js';

let currentTab = 'auditoria';

export function renderKardexSkeleton() {
  return `
    <div class="space-y-8 pb-10">
      <header>
        <h1 class="text-3xl font-black text-[#2d221b] tracking-tighter">Inventario y Auditoría</h1>
        <p class="text-sm font-medium text-[#705f52] mt-1">Control integral de movimientos, facturas y mermas.</p>
      </header>

      <div class="flex flex-wrap gap-2 p-1 bg-white/60 rounded-2xl w-fit border border-borde shadow-sm">
        <button class="tab-btn px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all bg-cafe text-white shadow-md" data-tab="auditoria">📋 Kardex</button>
        <button class="tab-btn px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all text-cafe/60 hover:bg-white" data-tab="ingreso">📥 Ingreso Facturas</button>
        <button class="tab-btn px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all text-cafe/60 hover:bg-white" data-tab="mermas">🍂 Mermas</button>
      </div>

      <div id="kardex-content">
        <div class="panel h-96 animate-pulse bg-white/50"></div>
      </div>
    </div>
  `;
}

/* ───────────── AUDITORÍA ───────────── */
async function renderAuditoria() {
  const container = document.querySelector('#kardex-content');
  container.innerHTML = `<div class="panel h-80 animate-pulse bg-white/50"></div>`;
  try {
    const res = await getKardexTodos();
    const movimientos = res.data || [];

    const typeStyle = (tipo) => {
      if (['COMPRA', 'CARGA_INICIAL', 'VENTA_ANULADA'].includes(tipo)) return 'bg-verdeok/10 text-verdeok';
      if (['VENTA', 'MERMA', 'AJUSTE_NEGATIVO'].includes(tipo)) return 'bg-rojoaviso/10 text-rojoaviso';
      return 'bg-azulaviso/10 text-azulaviso';
    };
    const isEntry = (tipo) => ['COMPRA', 'CARGA_INICIAL', 'VENTA_ANULADA'].includes(tipo);

    container.innerHTML = `
      <div class="panel bg-white shadow-sm overflow-hidden">
        <div class="px-6 py-4 border-b border-borde/30 flex items-center justify-between bg-crema/10">
          <h2 class="text-lg font-black text-[#2d221b]">📋 Historial de Movimientos</h2>
          <span class="text-[10px] font-bold text-cafe/30 uppercase">${movimientos.length} registros</span>
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
      </div>`;
  } catch (e) {
    container.innerHTML = errorCard(e.message);
  }
}

/* ───────────── INGRESO FACTURAS ───────────── */
async function renderIngreso() {
  const container = document.querySelector('#kardex-content');
  container.innerHTML = `<div class="panel h-80 animate-pulse bg-white/50"></div>`;
  try {
    const resProd = await getProductos();
    const productos = (resProd.data || []).sort((a, b) => a.nombre.localeCompare(b.nombre));

    container.innerHTML = `
      <div class="max-w-2xl mx-auto">
        <div class="panel bg-white p-8 shadow-lg border-t-4 border-t-azulaviso rounded-3xl">
          <div class="flex items-center gap-4 mb-6">
            <div class="w-12 h-12 rounded-2xl bg-azulaviso/10 flex items-center justify-center text-2xl">📥</div>
            <div>
              <h2 class="text-xl font-black text-[#2d221b]">Ingreso por Factura</h2>
              <p class="text-xs text-cafe/50">El stock se actualizará automáticamente.</p>
            </div>
          </div>

          <form id="form-factura" class="space-y-5">
            <!-- Fila 1 -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-[10px] font-black uppercase tracking-widest text-cafe/50 mb-1.5">N° Factura</label>
                <input name="numero_factura" class="field h-11 text-sm" required placeholder="Ej: 45672">
              </div>
              <div>
                <label class="block text-[10px] font-black uppercase tracking-widest text-cafe/50 mb-1.5">Proveedor ID</label>
                <input name="id_proveedor" type="number" class="field h-11 text-sm" required value="1" min="1">
              </div>
            </div>

            <!-- Separador -->
            <div class="pt-2 pb-1 border-t border-borde/30">
              <p class="text-[10px] font-black uppercase tracking-widest text-cafe/40">Producto a ingresar</p>
            </div>

            <!-- Buscador de producto -->
            <div>
              <label class="block text-[10px] font-black uppercase tracking-widest text-cafe/50 mb-1.5">Buscar Producto</label>
              <input id="prod-search" type="text" class="field h-11 text-sm" placeholder="Escribe para filtrar...">
              <select name="id_producto" id="prod-select" size="5" class="field mt-1 text-sm py-1" style="height:auto">
                ${productos.map(p => `<option value="${p.id}" data-nombre="${escapeHtml(p.nombre).toLowerCase()}">${escapeHtml(p.nombre)}</option>`).join('')}
              </select>
            </div>

            <!-- Fila cantidad y costo -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-[10px] font-black uppercase tracking-widest text-cafe/50 mb-1.5">Cantidad</label>
                <input name="cantidad" type="number" step="0.01" class="field h-11 text-sm font-bold" value="1" min="0.01">
              </div>
              <div>
                <label class="block text-[10px] font-black uppercase tracking-widest text-cafe/50 mb-1.5">Costo Unitario ($)</label>
                <input name="costo_unitario" type="number" step="0.01" class="field h-11 text-sm font-bold" placeholder="0.00">
              </div>
            </div>

            <button type="submit" id="btn-factura" class="w-full h-13 py-3 bg-cafe text-white rounded-2xl font-black text-base shadow-lg hover:scale-[1.02] transition-all mt-2">
              📥 Registrar e Incrementar Stock
            </button>
          </form>
        </div>
      </div>`;

    // Filtro de búsqueda de producto
    document.querySelector('#prod-search')?.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll('#prod-select option').forEach(opt => {
        opt.style.display = opt.dataset.nombre.includes(q) ? '' : 'none';
      });
    });

    document.querySelector('#form-factura')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.querySelector('#btn-factura');
      btn.disabled = true;
      btn.innerText = 'Procesando...';
      const f = new FormData(e.target);
      const qty = parseFloat(f.get('cantidad'));
      const cost = parseFloat(f.get('costo_unitario')) || 0;
      const payload = {
        numero_factura: f.get('numero_factura'),
        id_proveedor: parseInt(f.get('id_proveedor')),
        fecha_emision: new Date().toISOString().split('T')[0],
        monto_total: qty * cost,
        detalle_productos: [{ id_producto: parseInt(f.get('id_producto')), cantidad: qty, costo_unitario: cost }]
      };
      try {
        await ingresarFactura(payload);
        alert('✅ Factura ingresada. Stock actualizado correctamente.');
        const tab = document.querySelector('[data-tab="auditoria"]');
        if (tab) { tab.click(); } else { await renderAuditoria(); }
      } catch (err) {
        alert('❌ Error: ' + err.message);
        btn.disabled = false;
        btn.innerText = '📥 Registrar e Incrementar Stock';
      }
    });
  } catch (e) {
    container.innerHTML = errorCard(e.message);
  }
}

/* ───────────── MERMAS ───────────── */
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
            <div class="w-12 h-12 rounded-2xl bg-rojoaviso/10 flex items-center justify-center text-2xl">🍂</div>
            <div>
              <h2 class="text-xl font-black text-[#2d221b]">Registro de Merma</h2>
              <p class="text-xs text-cafe/50">El stock se descontará automáticamente.</p>
            </div>
          </div>

          <form id="form-merma" class="space-y-5">
            <!-- Buscador de producto -->
            <div>
              <label class="block text-[10px] font-black uppercase tracking-widest text-cafe/50 mb-1.5">Buscar Producto</label>
              <input id="merma-search" type="text" class="field h-11 text-sm" placeholder="Escribe para filtrar...">
              <select name="id_producto" id="merma-select" size="5" class="field mt-1 text-sm py-1" style="height:auto">
                ${productos.map(p => `<option value="${p.id}" data-nombre="${escapeHtml(p.nombre).toLowerCase()}">${escapeHtml(p.nombre)}</option>`).join('')}
              </select>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-[10px] font-black uppercase tracking-widest text-cafe/50 mb-1.5">Cantidad a Descontar</label>
                <input name="cantidad" type="number" step="0.01" class="field h-11 text-sm font-bold" placeholder="0.00">
              </div>
              <div>
                <label class="block text-[10px] font-black uppercase tracking-widest text-cafe/50 mb-1.5">Motivo</label>
                <select name="motivo" class="field h-11 text-sm font-bold">
                  <option value="Vencimiento">⏰ Vencimiento</option>
                  <option value="Daño/Rotura">💔 Daño / Rotura</option>
                  <option value="Robo/Pérdida">🔍 Robo / Pérdida</option>
                  <option value="Consumo Personal">🍽️ Consumo Personal</option>
                </select>
              </div>
            </div>

            <button type="submit" id="btn-merma" class="w-full py-3 bg-rojoaviso text-white rounded-2xl font-black text-base shadow-lg hover:scale-[1.02] transition-all mt-2">
              🍂 Registrar Merma y Rebajar Stock
            </button>
          </form>
        </div>
      </div>`;

    document.querySelector('#merma-search')?.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll('#merma-select option').forEach(opt => {
        opt.style.display = opt.dataset.nombre.includes(q) ? '' : 'none';
      });
    });

    document.querySelector('#form-merma')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.querySelector('#btn-merma');
      btn.disabled = true;
      btn.innerText = 'Procesando...';
      const f = new FormData(e.target);
      const payload = {
        id_producto: parseInt(f.get('id_producto')),
        cantidad: parseFloat(f.get('cantidad')),
        motivo: f.get('motivo')
      };
      try {
        await registrarMerma(payload);
        alert('✅ Merma registrada. Stock actualizado.');
        const tab = document.querySelector('[data-tab="auditoria"]');
        if (tab) { tab.click(); } else { await renderAuditoria(); }
      } catch (err) {
        alert('❌ Error: ' + err.message);
        btn.disabled = false;
        btn.innerText = '🍂 Registrar Merma y Rebajar Stock';
      }
    });
  } catch (e) {
    container.innerHTML = errorCard(e.message);
  }
}

function errorCard(msg) {
  return `<div class="panel p-10 text-center text-rojoaviso font-bold bg-white rounded-3xl shadow">❌ Error: ${escapeHtml(msg)}</div>`;
}

/* ───────────── TABS ───────────── */
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
      if (currentTab === 'mermas') await renderMermas();
    });
  });

  await renderAuditoria();
}
