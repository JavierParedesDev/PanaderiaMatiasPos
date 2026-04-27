import { getProductos } from '../../services/productService.js';
import { getCategorias } from '../../services/masterService.js';
import { registrarVenta } from '../../services/saleService.js';
import { formatCurrency, escapeHtml } from '../../utils/formatters.js';
import { showNotification } from '../../utils/notifications.js';
import { getSession } from '../../state/sessionStore.js';

let allProducts = [];
let cart = [];
let selectedPaymentMethod = 'Efectivo';
let searchResults = [];
let currentShift = null;
let paymentMethods = [];
let isProcessingSale = false;

function getStock(product) {
  return Number(product?.stock_actual ?? 0);
}

function getCartTotal() {
  return cart.reduce((acc, item) => acc + ((item.precio_venta || 0) * item.quantity), 0);
}

export function renderPosSkeleton() {
  return `
    <div class="h-full flex bg-[#f0f2f5] overflow-hidden">
      
      <!-- COLUMNA CENTRAL: TICKET (Items más pequeños) -->
      <main class="flex-1 flex flex-col p-10 gap-8 min-w-0">
        <header class="flex items-center justify-between px-6">
           <h2 class="text-3xl font-black text-cafe uppercase tracking-tighter italic">Venta actual <span id="cart-count" class="text-caramelo ml-2">(0)</span></h2>
           <button id="clear-cart" class="p-3.5 rounded-xl bg-white border border-borde/40 shadow-sm hover:bg-rojoaviso/5 text-rojoaviso/40 hover:text-rojoaviso transition-all font-black text-[10px] uppercase tracking-widest">Vaciar Ticket</button>
        </header>

        <div id="cart-container" class="flex-1 bg-white border border-borde/40 shadow-xl overflow-hidden flex flex-col">
          <div class="flex items-center px-8 py-5 border-b border-borde/10 text-[10px] font-black uppercase tracking-[0.2em] text-cafe/30 shrink-0">
             <div class="flex-1">Descripción del Producto</div>
             <div class="w-40 text-center">Cantidad</div>
             <div class="w-40 text-right pr-10">Precio Unit.</div>
             <div class="w-48 text-right pr-6">Subtotal</div>
             <div class="w-12"></div>
          </div>

          <div id="cart-items" class="flex-1 overflow-y-auto space-y-px custom-scrollbar">
             <div class="h-full flex flex-col items-center justify-center opacity-10">
                <img src="./assets/logo.png" class="w-32 mb-6 grayscale">
                <p class="text-lg font-black uppercase tracking-[0.3em]">Esperando Selección...</p>
             </div>
          </div>
        </div>
      </main>

      <!-- COLUMNA DERECHA: PAGO (Checkout optimizado para visibilidad) -->
      <aside class="w-[420px] bg-white border-l border-borde/40 flex flex-col shadow-2xl z-20">
        <div class="flex-1 p-10 space-y-8 overflow-y-auto custom-scrollbar">
          
          <!-- Resumen de Totales -->
          <div class="space-y-4">
            <div class="flex items-center justify-between text-sm font-bold text-cafe/40 uppercase tracking-widest">
              <span>Subtotal</span>
              <span id="cart-subtotal" class="text-cafe font-black">$ 0</span>
            </div>
            <div class="flex items-center justify-between text-sm font-bold text-cafe/40 uppercase tracking-widest">
              <span>Descuento</span>
              <span id="cart-discount" class="text-verdeok font-black">-$ 0</span>
            </div>
            <div class="pt-6 border-t border-borde/40 flex flex-col items-end">
               <span class="text-[10px] font-black text-cafe/30 uppercase tracking-[0.3em] mb-1">Total a Cobrar</span>
               <span id="cart-total" class="text-5xl font-black text-cafe tracking-tighter leading-none">$ 0</span>
            </div>
          </div>

          <!-- Matriz de Pago Simplificada (Espacios reducidos) -->
          <div class="space-y-4">
             <p class="text-[10px] font-black text-cafe/30 uppercase tracking-[0.4em] text-center italic">Método de Recepción</p>
             <div class="grid grid-cols-1 gap-3">
                <button class="pay-method-btn active h-20 flex-row justify-start px-6 gap-6" data-method="Efectivo">
                   <span class="text-3xl">💵</span>
                   <div class="text-left">
                     <span class="block text-xs font-black uppercase tracking-widest">Efectivo</span>
                     <span class="text-[8px] font-bold opacity-50 uppercase mt-0.5">Dinero en mano</span>
                   </div>
                </button>
                <button class="pay-method-btn h-20 flex-row justify-start px-6 gap-6" data-method="Tarjeta">
                   <span class="text-3xl">💳</span>
                   <div class="text-left">
                     <span class="block text-xs font-black uppercase tracking-widest">Tarjeta</span>
                     <span class="text-[8px] font-bold opacity-50 uppercase mt-0.5">Deb/Cred</span>
                   </div>
                </button>
                <button class="pay-method-btn h-20 flex-row justify-start px-6 gap-6" data-method="Mixto">
                   <span class="text-3xl">🌓</span>
                   <div class="text-left">
                     <span class="block text-xs font-black uppercase tracking-widest text-[#3b82f6]">Mixto</span>
                     <span class="text-[8px] font-bold opacity-50 uppercase mt-0.5 text-[#3b82f6]/60">Combinado</span>
                   </div>
                </button>
             </div>
          </div>
        </div>

        <!-- Botón Cobrar (VERDE / CUADRADO TOTAL AL FONDO) -->
        <button id="pay-button" class="btn-pos-pay-success h-28 flex flex-col items-center justify-center gap-1 active:brightness-90 transition-all font-black italic uppercase" disabled>
           <span class="text-[10px] opacity-60 tracking-[0.3em]">Finalizar Venta</span>
           <span class="text-2xl tracking-tighter" id="pay-button-text">COBRAR $ 0</span>
        </button>
      </aside>
    </div>

    <!-- Modal de Pago Mixto -->
    <div id="mixed-payment-modal" class="hidden fixed inset-0 z-[300] flex items-center justify-center p-4 bg-cafe/90 backdrop-blur-md">
      <div class="panel w-full max-w-sm bg-white p-10 space-y-8 animate-zoomIn">
        <h2 class="text-2xl font-black text-cafe uppercase italic tracking-tighter">Pago Mixto</h2>
        <div class="space-y-6">
           <div class="space-y-2">
              <label class="text-[10px] font-black text-cafe/30 uppercase tracking-[0.2em]">Monto Efectivo</label>
              <input id="mixed-efectivo" type="number" class="w-full h-16 bg-papel border-2 border-borde/40 rounded-2xl px-6 text-2xl font-black outline-none focus:border-caramelo transition-all" defaultValue="0">
           </div>
           <div class="space-y-2">
              <label class="text-[10px] font-black text-cafe/30 uppercase tracking-[0.2em]">Monto Tarjeta (Automático)</label>
              <input id="mixed-tarjeta" type="number" class="w-full h-16 bg-papel border-2 border-borde/40 rounded-2xl px-6 text-2xl font-black text-cafe/40" disabled>
           </div>
        </div>
        <div class="flex gap-4">
           <button id="cancel-mixed" class="flex-1 py-4 rounded-xl font-black uppercase text-xs tracking-widest text-cafe/40 hover:bg-papel">Cancelar</button>
           <button id="confirm-mixed" class="flex-[2] py-4 rounded-xl bg-caramelo text-white font-black uppercase text-xs tracking-widest shadow-lg shadow-caramelo/30">Confirmar Pago</button>
        </div>
      </div>
    </div>

    <!-- Modal de confirmación -->
    <div id="payment-modal" class="hidden fixed inset-0 z-[300] flex items-center justify-center p-4 bg-cafe/95 backdrop-blur-xl">
      <div class="panel w-full max-w-md bg-white border-none shadow-[0_0_150px_rgba(0,0,0,0.6)] overflow-hidden text-center p-10 space-y-6 animate-zoomIn">
        <div class="w-24 h-24 bg-verdeok text-white rounded-full flex items-center justify-center text-5xl mx-auto shadow-2xl shadow-verdeok/40 ring-8 ring-verdeok/10 animate-bounce">✓</div>
        <div>
          <h2 class="text-3xl font-black text-cafe tracking-tighter uppercase italic">Venta Registrada</h2>
          <p class="text-[10px] font-bold text-cafe/40 uppercase tracking-[0.4em] mt-2">Folio #<span id="modal-folio">---</span></p>
        </div>
        <div class="p-6 bg-[#f8f5f0] rounded-[2rem] border-2 border-dashed border-borde/60">
           <p class="text-[9px] font-black text-cafe/30 uppercase tracking-[0.3em] mb-2">Total Recaudado</p>
           <p id="modal-payment-total" class="text-4xl font-black text-verdeok tracking-tighter">$ 0</p>
        </div>
        <button id="close-payment-modal" class="w-full py-5 rounded-xl bg-cafe text-white font-black uppercase tracking-[0.3em] shadow-2xl shadow-cafe/40 hover:scale-[1.02] transition-transform">Siguiente Ticket 🥖</button>
      </div>
    <!-- Modal de confirmación genérico -->
    <div id="confirm-modal" class="hidden fixed inset-0 z-[400] flex items-center justify-center p-4 bg-cafe/90 backdrop-blur-md">
      <div class="panel w-full max-w-sm bg-white p-10 space-y-6 text-center animate-zoomIn">
        <div class="w-20 h-20 bg-rojoaviso/10 text-rojoaviso rounded-full flex items-center justify-center text-4xl mx-auto">❓</div>
        <div>
          <h3 id="confirm-title" class="text-xl font-black text-cafe uppercase italic tracking-tighter">Confirmar Acción</h3>
          <p id="confirm-message" class="text-[10px] font-bold text-cafe/40 uppercase tracking-[0.2em] mt-2"></p>
        </div>
        <div class="flex gap-4 pt-4">
          <button id="confirm-cancel" class="flex-1 py-4 rounded-xl font-black uppercase text-xs tracking-widest text-cafe/40 hover:bg-papel">Cancelar</button>
          <button id="confirm-ok" class="flex-1 py-4 rounded-xl bg-rojoaviso text-white font-black uppercase text-xs tracking-widest shadow-lg shadow-rojoaviso/30">Sí, Confirmar</button>
        </div>
      </div>
    </div>
    <!-- Modal de Apertura de Caja -->
    <div id="open-shift-modal" class="hidden fixed inset-0 z-[500] flex items-center justify-center p-4 bg-cafe/95 backdrop-blur-2xl">
      <div class="panel w-full max-w-md bg-white border-none shadow-[0_0_150px_rgba(0,0,0,0.6)] overflow-hidden p-10 space-y-8 animate-zoomIn">
        <div class="space-y-2 text-center">
          <div class="text-6xl mb-4">🚪</div>
          <h2 class="text-3xl font-black text-cafe tracking-tighter uppercase italic">Apertura de Caja</h2>
          <p class="text-[10px] font-bold text-cafe/40 uppercase tracking-[0.4em]">Ingresa el fondo inicial para comenzar</p>
        </div>
        <form id="open-shift-form" class="space-y-6">
           <div class="space-y-2">
              <label class="text-[10px] font-black text-cafe/30 uppercase tracking-[0.2em]">Monto Inicial en Efectivo</label>
              <div class="relative">
                <span class="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-cafe/20">$</span>
                <input id="monto-apertura-pos" type="number" step="1" required class="w-full h-20 bg-papel border-2 border-borde/40 rounded-3xl pl-14 pr-6 text-4xl font-black outline-none focus:border-caramelo transition-all text-cafe" placeholder="0">
              </div>
           </div>
           <div class="space-y-2">
              <label class="text-[10px] font-black text-cafe/30 uppercase tracking-[0.2em]">Tipo de Turno</label>
              <select id="tipo-turno-pos" class="w-full h-14 bg-papel border-2 border-borde/40 rounded-2xl px-6 text-sm font-black uppercase tracking-widest outline-none focus:border-caramelo transition-all text-cafe">
                <option value="Mañana">Mañana</option>
                <option value="Tarde">Tarde</option>
                <option value="Único" selected>Único</option>
              </select>
           </div>
           <button type="submit" class="w-full py-6 rounded-2xl bg-caramelo text-white font-black uppercase tracking-[0.3em] shadow-2xl shadow-caramelo/40 hover:scale-[1.02] active:scale-95 transition-all text-lg">Abrir Turno Ahora 🥖</button>
        </form>
      </div>
    </div>
  `;
}

export async function hydratePosView() {
  const searchInput = document.querySelector('#header-search');
  const headerResults = document.querySelector('#header-search-results');
  const cartItemsContainer = document.querySelector('#cart-items');
  const cartTotal = document.querySelector('#cart-total');
  const cartSubtotal = document.querySelector('#cart-subtotal');
  const cartCount = document.querySelector('#cart-count');
  const payButton = document.querySelector('#pay-button');
  const payButtonText = document.querySelector('#pay-button-text');
  const clearCartBtn = document.querySelector('#clear-cart');
  const methodBtns = document.querySelectorAll('.pay-method-btn');

  const paymentModal = document.querySelector('#payment-modal');
  const closePaymentModalBtn = document.querySelector('#close-payment-modal');
  const modalTotal = document.querySelector('#modal-payment-total');

  // Selectores Confirmación
  const confirmModal = document.querySelector('#confirm-modal');
  const confirmTitle = document.querySelector('#confirm-title');
  const confirmMsg = document.querySelector('#confirm-message');
  const confirmOkBtn = document.querySelector('#confirm-ok');
  const confirmCancelBtn = document.querySelector('#confirm-cancel');

  function showConfirm(title, message, onConfirm) {
    confirmTitle.textContent = title;
    confirmMsg.textContent = message;
    confirmModal.classList.remove('hidden');

    // Clonar para limpiar handlers viejos
    const newOk = confirmOkBtn.cloneNode(true);
    confirmOkBtn.parentNode.replaceChild(newOk, confirmOkBtn);
    const newCancel = confirmCancelBtn.cloneNode(true);
    confirmCancelBtn.parentNode.replaceChild(newCancel, confirmCancelBtn);

    newOk.addEventListener('click', () => {
      confirmModal.classList.add('hidden');
      onConfirm();
    });
    newCancel.addEventListener('click', () => {
      confirmModal.classList.add('hidden');
    });
  }

  async function loadData() {
    try {
      const session = getSession();
      const userId = session?.usuario?.id;

      // 1. Verificar Turno PRIMERO para mostrar modal rápido
      const { getTurnos } = await import('../../services/shiftService.js');
      const sRes = await getTurnos({ estado: 'Abierto' });
      currentShift = (sRes.data || []).find(t => t.id_usuario === userId);

      if (!currentShift) {
        document.querySelector('#open-shift-modal')?.classList.remove('hidden');
        document.querySelector('#monto-apertura-pos')?.focus();
      }

      // 2. Cargar el resto en segundo plano o después
      const pRes = await getProductos();
      allProducts = (pRes.data || [])
        .filter(p => p.activo)
        .map(p => ({ ...p, stock_actual: getStock(p) }));

      const { getMetodosPago } = await import('../../services/masterService.js');
      const mRes = await getMetodosPago();
      paymentMethods = mRes.data || [];

    } catch (e) {
      console.error('Error al cargar datos iniciales POS:', e);
    }
  }

  const openShiftForm = document.querySelector('#open-shift-form');
  openShiftForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const monto = Number(document.querySelector('#monto-apertura-pos').value);
    const tipo = document.querySelector('#tipo-turno-pos').value;

    try {
      const { abrirTurno } = await import('../../services/shiftService.js');
      const res = await abrirTurno({ tipo_turno: tipo, monto_apertura: monto });

      currentShift = res.turno;
      document.querySelector('#open-shift-modal').classList.add('hidden');
      showNotification('¡TURNO ABIERTO! Ya puedes vender.', 'success');
      searchInput.focus();
    } catch (error) {
      showNotification(error.message || 'Error al abrir turno', 'error');
    }
  });

  // Escuchar búsqueda desde el evento global de app.js
  window.addEventListener('pos-search', (e) => {
    const term = (e.detail || '').trim().toLowerCase();

    if (term.length < 2) {
      headerResults.classList.add('hidden');
      return;
    }

    const filtered = allProducts.filter(p =>
      p.nombre.toLowerCase().includes(term) ||
      (p.codigo_interno || '').toLowerCase().includes(term) ||
      (p.codigo_barra_externo || '').toLowerCase().includes(term)
    ).slice(0, 15);

    // AUTO-ADD si hay coincidencia EXACTA por código (Ideal para Scanners)
    const exactMatch = allProducts.find(p =>
      (p.codigo_interno || '').toLowerCase() === term ||
      (p.codigo_barra_externo || '').toLowerCase() === term
    );

    if (exactMatch) {
      addToCart(exactMatch.id);
      headerResults.classList.add('hidden');
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
      }
      return; // Detener flujo para no mostrar dropdown
    }

    if (filtered.length > 0) {
      headerResults.classList.remove('hidden');
      headerResults.innerHTML = filtered.map(p => `
        <div class="search-result-item group p-8 border-b border-borde/5" data-id="${p.id}">
          <div class="flex-1 min-w-0 pr-6">
             <p class="text-sm font-black text-cafe uppercase truncate">${escapeHtml(p.nombre)}</p>
             <p class="text-[10px] font-bold text-cafe/30 uppercase mt-1.5 font-mono">STOCK: ${getStock(p)} • ${formatCurrency(p.precio_venta)}</p>
          </div>
          <button class="add-btn w-12 h-12 text-2xl shadow-md" data-id="${p.id}">+</button>
        </div>
      `).join('');

      headerResults.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', () => {
          const id = Number(item.dataset.id);
          addToCart(id);
          headerResults.classList.add('hidden');
          if (searchInput) {
            searchInput.value = '';
            searchInput.focus();
          }
        });
      });
    } else {
      headerResults.classList.remove('hidden');
      headerResults.innerHTML = `
        <div class="p-10 text-center opacity-40">
          <p class="text-xs font-black uppercase tracking-widest text-cafe/50">Nada encontrado</p>
        </div>
      `;
    }
  });

  if (searchInput && headerResults) {
    // Cerrar al clickear fuera
    document.addEventListener('click', (e) => {
      if (!searchInput.contains(e.target) && !headerResults.contains(e.target)) {
        headerResults.classList.add('hidden');
      }
    });
  }

  function addToCart(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;

    // Validación de stock
    const existing = cart.find(i => i.id === productId);
    const currentQty = existing ? existing.quantity : 0;

    if (getStock(product) <= currentQty) {
      showNotification(`STOCK INSUFICIENTE: Solo quedan ${getStock(product)} unidades de ${product.nombre}`, 'warning');
      return;
    }

    if (existing) {
      existing.quantity++;
      const idx = cart.indexOf(existing);
      cart.splice(idx, 1);
      cart.unshift(existing);
    } else {
      cart.unshift({ ...product, quantity: 1 });
    }
    updateCartUI();
  }

  function updateCartUI() {
    if (cart.length === 0) {
      cartItemsContainer.innerHTML = `
         <div class="h-full flex flex-col items-center justify-center opacity-10">
            <img src="./assets/logo.png" class="w-32 mb-6 grayscale">
            <p class="text-lg font-black uppercase tracking-[0.3em]">Esperando Selección...</p>
         </div>
       `;
      payButton.disabled = true;
      payButtonText.textContent = 'COBRAR $ 0';
    } else {
      cartItemsContainer.innerHTML = cart.map((item, idx) => `
         <div class="flex items-center px-8 py-8 bg-white border-b border-borde/5 hover:bg-cafe/[0.01] transition-all group animate-slideInRight" style="animation-delay: ${idx * 0.05}s">
            <!-- Col 1: Info Producto (flex-1) -->
            <div class="flex-1 min-w-0 pr-12">
               <div class="flex items-start gap-5">
                  <div class="w-1.5 h-12 bg-caramelo rounded-full shrink-0"></div>
                  <div>
                    <h4 class="text-3xl font-black text-cafe uppercase tracking-tighter leading-tight">${escapeHtml(item.nombre)}</h4>
                    <div class="flex items-center gap-4 mt-2">
                        <span class="text-[10px] font-black text-cafe/30 uppercase tracking-[0.2em] bg-papel px-2.5 py-1 rounded-md">${item.codigo_interno || 'SKU'}</span>
                        <span class="text-[10px] font-black text-caramelo uppercase tracking-[0.1em] italic text-xs">${item.categoria || 'Sin Categoría'}</span>
                    </div>
                  </div>
               </div>
            </div>
            
            <!-- Col 2: Cantidad (w-40) -->
            <div class="w-40 flex justify-center shrink-0">
               <div class="qty-control-wrapper shadow-lg scale-125">
                  <button class="cart-item-qty-btn" data-action="dec" data-id="${item.id}">−</button>
                  <span class="text-2xl font-black text-cafe w-12 text-center select-none tracking-tighter tabular-nums">${item.quantity}</span>
                  <button class="cart-item-qty-btn" data-action="inc" data-id="${item.id}">+</button>
               </div>
            </div>

            <!-- Col 3: Precio Unitario (w-40) -->
            <div class="w-40 text-right pr-10 shrink-0">
               <p class="text-2xl font-bold text-cafe/40 tabular-nums">${formatCurrency(item.precio_venta)}</p>
               <p class="text-[8px] font-black text-cafe/20 uppercase tracking-[0.2em] mt-1.5 opacity-60">Unit.</p>
            </div>

            <!-- Col 4: Subtotal (w-48) -->
            <div class="w-48 text-right pr-6 shrink-0">
               <p class="text-5xl font-black text-cafe tracking-tighter tabular-nums leading-none">${formatCurrency(item.precio_venta * item.quantity)}</p>
               <p class="text-[10px] font-black text-caramelo uppercase tracking-[0.2em] mt-2.5">Subtotal</p>
            </div>

            <!-- Col 5: Eliminar (w-12) -->
            <div class="w-12 flex justify-end shrink-0">
               <button class="w-10 h-10 rounded-xl flex items-center justify-center bg-rojoaviso text-white shadow-md hover:bg-rojoaviso/90 active:scale-95 transition-all text-sm font-black" data-action="remove" data-id="${item.id}">✕</button>
            </div>
         </div>
       `).join('');

      payButton.disabled = false;

      cartItemsContainer.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = Number(btn.dataset.id);
          const action = btn.dataset.action;
          const item = cart.find(i => i.id === id);
          if (action === 'inc') {
            const product = allProducts.find(p => p.id === id) || item;
            if (getStock(product) <= item.quantity) {
              showNotification(`STOCK INSUFICIENTE: Solo quedan ${getStock(product)} unidades de ${item.nombre}`, 'warning');
              return;
            }
            item.quantity++;
          }
          else if (action === 'dec') {
            item.quantity--;
            if (item.quantity <= 0) cart = cart.filter(i => i.id !== id);
          } else if (action === 'remove') {
            cart = cart.filter(i => i.id !== id);
          }
          updateCartUI();
        });
      });
    }

    const total = getCartTotal();
    cartTotal.textContent = formatCurrency(total);
    cartSubtotal.textContent = formatCurrency(total);
    cartCount.textContent = `(${cart.reduce((acc, i) => acc + i.quantity, 0)})`;
    payButtonText.textContent = `COBRAR ${formatCurrency(total)}`;
  }

  methodBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      methodBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedPaymentMethod = btn.dataset.method;
    });
  });

  const mixedModal = document.querySelector('#mixed-payment-modal');
  const mixedEfectivoInput = document.querySelector('#mixed-efectivo');
  const mixedTarjetaInput = document.querySelector('#mixed-tarjeta');
  const confirmMixedBtn = document.querySelector('#confirm-mixed');
  const cancelMixedBtn = document.querySelector('#cancel-mixed');

  // Lógica de cálculo automático para pago mixto
  mixedEfectivoInput.addEventListener('input', () => {
    const total = getCartTotal();
    const efectivo = Number(mixedEfectivoInput.value) || 0;
    const tarjeta = Math.max(0, total - efectivo);
    mixedTarjetaInput.value = tarjeta;
  });

  payButton.addEventListener('click', async () => {
    if (isProcessingSale) return;

    const total = getCartTotal();

    if (selectedPaymentMethod === 'Mixto') {
      mixedEfectivoInput.value = 0;
      mixedTarjetaInput.value = total;
      mixedModal.classList.remove('hidden');
      mixedEfectivoInput.focus();
      mixedEfectivoInput.select();
      return;
    }

    await processSale(total, selectedPaymentMethod);
  });

  confirmMixedBtn.addEventListener('click', async () => {
    if (isProcessingSale) return;

    const total = getCartTotal();
    const efectivo = Number(mixedEfectivoInput.value) || 0;
    const tarjeta = Number(mixedTarjetaInput.value) || 0;

    if (efectivo < 0 || efectivo > total || efectivo + tarjeta !== total) {
      showNotification('REVISA EL PAGO MIXTO: LOS MONTOS DEBEN SUMAR EL TOTAL EXACTO', 'warning');
      return;
    }

    mixedModal.classList.add('hidden');
    await processSale(total, 'Mixto', { efectivo, tarjeta });
  });

  cancelMixedBtn.addEventListener('click', () => {
    mixedModal.classList.add('hidden');
  });

  function getPaymentMethodId(label) {
    const normalizedLabel = String(label || '').toLowerCase();
    const found = paymentMethods.find(m => String(m.nombre || '').toLowerCase().includes(normalizedLabel));
    return found?.id || null;
  }

  function validateCartStock() {
    for (const item of cart) {
      const product = allProducts.find(p => p.id === item.id) || item;
      if (getStock(product) < item.quantity) {
        showNotification(`STOCK INSUFICIENTE: Solo quedan ${getStock(product)} unidades de ${item.nombre}`, 'warning');
        return false;
      }
    }
    return true;
  }

  async function printSaleTicket(printData) {
    if (!window.electronAPI?.printTicket) {
      showNotification('VENTA REGISTRADA, PERO LA IMPRESORA NO ESTA DISPONIBLE', 'warning');
      return;
    }

    try {
      const result = await window.electronAPI.printTicket(printData);
      if (!result?.success) {
        showNotification(`VENTA REGISTRADA, PERO NO SE IMPRIMIO EL TICKET: ${result?.failureReason || 'REVISA LA IMPRESORA'}`, 'warning');
      }
    } catch (error) {
      console.error('Print Error:', error);
      showNotification('VENTA REGISTRADA, PERO FALLO LA IMPRESION DEL TICKET', 'warning');
    }
  }

  async function processSale(total, method, mixedData = null) {
    if (isProcessingSale) return;
    if (cart.length === 0) return;
    if (!currentShift) {
      showNotification('NO SE PUEDE COBRAR SIN UN TURNO ABIERTO', 'error');
      return;
    }
    if (!Number.isFinite(total) || total <= 0) {
      showNotification('EL TOTAL DE LA VENTA NO ES VALIDO', 'error');
      return;
    }
    if (!validateCartStock()) return;

    isProcessingSale = true;
    payButton.disabled = true;
    confirmMixedBtn.disabled = true;
    payButtonText.textContent = 'PROCESANDO...';

    let payloadPagos = [];
    if (mixedData) {
      const efectivoMethodId = getPaymentMethodId('Efectivo');
      const tarjetaMethodId = getPaymentMethodId('Tarjeta');
      if (!efectivoMethodId || !tarjetaMethodId) {
        showNotification('FALTAN METODOS DE PAGO PARA REGISTRAR PAGO MIXTO', 'error');
        isProcessingSale = false;
        payButton.disabled = false;
        confirmMixedBtn.disabled = false;
        payButtonText.textContent = `COBRAR ${formatCurrency(total)}`;
        return;
      }

      payloadPagos = [
        { id_metodo_pago: efectivoMethodId, monto_pagado: mixedData.efectivo },
        { id_metodo_pago: tarjetaMethodId, monto_pagado: mixedData.tarjeta }
      ];
    } else {
      const methodId = getPaymentMethodId(method);
      if (!methodId) {
        showNotification(`NO EXISTE EL METODO DE PAGO ${method}`, 'error');
        isProcessingSale = false;
        payButton.disabled = false;
        confirmMixedBtn.disabled = false;
        payButtonText.textContent = `COBRAR ${formatCurrency(total)}`;
        return;
      }

      payloadPagos = [{ id_metodo_pago: methodId, monto_pagado: total }];
    }

    const payload = {
      id_turno: currentShift.id,
      total_venta: total,
      detalle_productos: cart.map(item => ({
        id_producto: item.id,
        cantidad: item.quantity,
        precio_unitario: item.precio_venta || 0,
        subtotal: (item.precio_venta || 0) * item.quantity
      })),
      pagos_mixtos: payloadPagos
    };

    try {
      console.log('Enviando Venta:', payload);

      const res = await registrarVenta(payload);
      console.log('Respuesta:', res);

      const folio = res.venta?.folio || res.data?.folio_interno || 'N/A';
      document.querySelector('#modal-folio').textContent = folio;
      modalTotal.textContent = formatCurrency(total);
      paymentModal.classList.remove('hidden');

      await printSaleTicket({
        folio: folio,
        total: total,
        metodo: method,
        items: cart.map(i => ({ nombre: i.nombre, cantidad: i.quantity, precio_unitario: i.precio_venta || 0 }))
      });

      cart.forEach(item => {
        const product = allProducts.find(p => p.id === item.id);
        if (product) {
          product.stock_actual = Math.max(0, getStock(product) - item.quantity);
        }
      });

      cart = [];
      updateCartUI();
      isProcessingSale = false;
      confirmMixedBtn.disabled = false;
    } catch (error) {
      console.error('Error Venta:', error);
      showNotification(`ERROR AL COBRAR: ${error.error || error.message || 'Falla de red'}`, 'error');
      isProcessingSale = false;
      payButton.disabled = false;
      confirmMixedBtn.disabled = false;
      payButtonText.textContent = `COBRAR ${formatCurrency(total)}`;
    }
  }

  clearCartBtn.addEventListener('click', () => {
    if (cart.length > 0) {
      showConfirm('VACIAR VENTA', 'Se eliminarán todos los items cargados del ticket actual', () => {
        cart = [];
        updateCartUI();
      });
    }
  });

  closePaymentModalBtn.addEventListener('click', () => {
    paymentModal.classList.add('hidden');
    searchInput.focus();
  });

  // Atajos de teclado
  window.addEventListener('keydown', (e) => {
    // F2: Enfocar búsqueda
    if (e.key === 'F2') {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
    // ESC: Limpiar ticket
    if (e.key === 'Escape') {
      if (cart.length > 0) {
        showConfirm('VACIAR TICKET', '¿Estás seguro de que deseas eliminar todos los productos?', () => {
          cart = [];
          updateCartUI();
        });
      }
    }
    // F1: Cobrar
    if (e.key === 'F1') {
      e.preventDefault();
      if (cart.length > 0 && !payButton.disabled) {
        payButton.click();
      }
    }
  });

  await loadData();
}
