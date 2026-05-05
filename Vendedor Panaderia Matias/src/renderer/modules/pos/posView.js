import { getProductos } from "../../services/productService.js";
import { getCategorias } from "../../services/masterService.js";
import { registrarVenta } from "../../services/saleService.js";
import { getTrabajadores, registrarConsumoPersonal } from "../../services/staffConsumptionService.js";
import { formatCurrency, escapeHtml } from "../../utils/formatters.js";
import { showNotification } from "../../utils/notifications.js";
import { getSession } from "../../state/sessionStore.js";

let allProducts = [];
let cart = [];
let selectedPaymentMethod = "Efectivo";
let searchResults = [];
let currentShift = null;
let paymentMethods = [];
let isProcessingSale = false;
let refreshInterval = null;
const CART_STORAGE_KEY = "panaderia-matias-pos-cart";

function loadCartFromStorage() {
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    const stored = raw ? JSON.parse(raw) : [];
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function saveCartToStorage(items) {
  if (!items?.length) {
    window.localStorage.removeItem(CART_STORAGE_KEY);
    return;
  }

  const payload = items.map((item) => ({
    id: item.id,
    quantity: item.quantity,
    precio_venta: item.precio_venta,
    nombre: item.nombre,
    codigo_interno: item.codigo_interno,
    categoria: item.categoria
  }));
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(payload));
}

function syncCartWithProducts() {
  if (!cart.length || !allProducts.length) return;

  cart = cart.map((item) => {
    const product = allProducts.find((p) => p.id == item.id);
    return product ? { ...product, quantity: item.quantity } : item;
  });
}

function getStock(product) {
  return Number(product?.stock_actual ?? 0);
}

function calculateItemSubtotal(item) {
  const quantity = item.quantity || 0;
  const precioVenta = item.precio_venta || 0;
  const cantidadPromo = Number(item.cantidad_promo) || 0;
  const precioPromo = Number(item.precio_promo) || 0;

  if (cantidadPromo > 0 && precioPromo > 0 && quantity >= cantidadPromo) {
    const numPromos = Math.floor(quantity / cantidadPromo);
    const rest = quantity % cantidadPromo;
    return (numPromos * precioPromo) + (rest * precioVenta);
  }
  return quantity * precioVenta;
}

function getCartTotal() {
  return cart.reduce(
    (acc, item) => acc + calculateItemSubtotal(item),
    0,
  );
}

export function renderPosSkeleton() {
  return `
    <div class="h-full flex bg-[#f0f2f5] overflow-hidden">
      
      <!-- COLUMNA CENTRAL: TICKET (Items más pequeños) -->
      <main class="flex-1 flex flex-col p-4 md:p-10 gap-4 md:gap-8 min-w-0">
      <header class="flex items-center justify-between px-6">
        <h2 class="text-2xl md:text-3xl font-black text-cafe uppercase tracking-tighter italic">Venta actual <span id="cart-count" class="text-caramelo ml-2">(0)</span></h2>
      </header>

        <div id="cart-container" class="flex-1 bg-white border border-borde/40 shadow-xl overflow-hidden flex flex-col">
          <div class="flex items-center px-4 md:px-8 py-3 md:py-5 border-b border-borde/10 text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] text-cafe/30 shrink-0">
             <div class="flex-1">Descripción del Producto</div>
             <div class="w-24 md:w-40 text-center">Cantidad</div>
             <div class="w-24 md:w-40 text-right md:pr-10">Precio Unit.</div>
             <div class="w-32 md:w-48 text-right md:pr-6">Subtotal</div>
             <div class="w-10 md:w-12"></div>
          </div>

          <div id="cart-items" class="flex-1 overflow-y-auto space-y-px custom-scrollbar">
             <div class="h-full flex flex-col items-center justify-center opacity-10">
                <img src="./assets/logo.png" class="w-24 md:w-32 mb-6 grayscale">
                <p class="text-base md:text-lg font-black uppercase tracking-[0.3em]">Esperando Selección...</p>
             </div>
          </div>
        </div>
      </main>

      <!-- COLUMNA DERECHA: PAGO (Checkout optimizado para visibilidad) -->
      <aside class="w-[320px] md:w-[420px] bg-white border-l border-borde/40 flex flex-col shadow-2xl z-20">
        <div class="flex-1 p-2 md:p-8 space-y-3 md:space-y-6 overflow-y-auto custom-scrollbar">
          
          <!-- Resumen de Totales -->
          <div class="space-y-2">
            <div class="pt-2 border-t border-borde/40 flex flex-col items-end">
               <span class="text-[8px] md:text-[10px] font-black text-cafe/30 uppercase tracking-[0.3em] mb-0.5">Total a Cobrar</span>
               <span id="cart-total" class="text-2xl md:text-4xl font-black text-cafe tracking-tighter leading-none">$ 0</span>
            </div>
          </div>

          <!-- Matriz de Pago Compacta (3 columnas para ahorrar espacio) -->
          <div class="space-y-3">
             <p class="text-[8px] md:text-[10px] font-black text-cafe/30 uppercase tracking-[0.4em] text-center italic">Método de Recepción</p>
             <div class="grid grid-cols-3 gap-2">
                <button class="pay-method-btn active flex-col justify-center items-center py-2 h-auto gap-1 border-2" data-method="Efectivo">
                   <span class="text-lg md:text-2xl">💵</span>
                   <span class="block text-[8px] md:text-[10px] font-black uppercase tracking-tighter">Efectivo</span>
                </button>

                <button class="pay-method-btn flex-col justify-center items-center py-2 h-auto gap-1 border-2" data-method="Tarjeta">
                   <span class="text-lg md:text-2xl">💳</span>
                   <span class="block text-[8px] md:text-[10px] font-black uppercase tracking-tighter">Tarjeta</span>
                </button>

                <button class="pay-method-btn flex-col justify-center items-center py-2 h-auto gap-1 border-2" data-method="Mixto">
                   <span class="text-lg md:text-2xl">🌓</span>
                   <span class="block text-[8px] md:text-[10px] font-black uppercase tracking-tighter text-[#3b82f6]">Mixto</span>
                </button>
             </div>
          </div>
        </div>

        <!-- Botón Cobrar (VERDE / CUADRADO TOTAL AL FONDO) -->
        <div class="px-2 pb-1">
          <button id="internal-consumption-button" class="w-full h-8 md:h-14 bg-cafe/10 hover:bg-cafe text-cafe hover:text-white border border-cafe/20 rounded-lg font-black uppercase tracking-widest text-[8px] md:text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed" disabled>
            Consumo Interno
          </button>
        </div>

      <div class="px-2 pb-1">
       <button id="quick-print-toggle" class="w-full py-1.5 rounded-lg border border-borde/30 text-[7px] md:text-[9px] font-black uppercase tracking-[0.2em] text-cafe/60 hover:bg-papel transition-all">Ticket: ON</button>
      </div>

      <button id="pay-button" class="btn-pos-pay-success h-12 md:h-20 flex flex-col items-center justify-center gap-0 active:brightness-90 transition-all font-black italic uppercase shrink-0" disabled>
        <span class="text-[7px] md:text-[9px] opacity-60 tracking-[0.3em]">Finalizar Venta</span>
        <span class="text-base md:text-xl tracking-tighter" id="pay-button-text">COBRAR $ 0</span>
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

    <!-- Modal de Pago en Efectivo -->
    <div id="cash-payment-modal" class="hidden fixed inset-0 z-[300] flex items-center justify-center p-4 bg-cafe/90 backdrop-blur-md">
      <div class="panel w-full max-w-sm bg-white p-10 space-y-8 animate-zoomIn">
        <h2 class="text-2xl font-black text-cafe uppercase italic tracking-tighter">Pago en Efectivo</h2>
        
        <div class="p-6 bg-papel/50 rounded-2xl border-2 border-dashed border-borde/40 text-center">
            <p class="text-[10px] font-black text-cafe/30 uppercase tracking-[0.3em] mb-2">Total a Pagar</p>
            <p id="cash-modal-total" class="text-4xl font-black text-cafe tracking-tighter">$ 0</p>
        </div>

        <div class="space-y-6">
           <div class="space-y-2">
              <label class="text-[10px] font-black text-cafe/30 uppercase tracking-[0.2em]">Efectivo Recibido</label>
              <input id="cash-received" type="number" step="1" class="w-full h-16 bg-papel border-2 border-borde/40 rounded-2xl px-6 text-3xl font-black outline-none focus:border-caramelo transition-all" placeholder="0">
           </div>
           
           <div class="p-6 bg-verdeok/5 rounded-2xl border border-verdeok/20 flex items-center justify-between">
              <span class="text-xs font-black text-verdeok uppercase tracking-widest">Vuelto</span>
              <span id="cash-change" class="text-3xl font-black text-verdeok tracking-tighter">$ 0</span>
           </div>
        </div>

        <div class="flex gap-4">
           <button id="cancel-cash" class="flex-1 py-4 rounded-xl font-black uppercase text-xs tracking-widest text-cafe/40 hover:bg-papel">Cancelar</button>
           <button id="confirm-cash" class="flex-[2] py-4 rounded-xl bg-cafe text-white font-black uppercase text-xs tracking-widest shadow-lg shadow-cafe/30">Finalizar Venta</button>
        </div>
      </div>
    </div>

    <!-- Modal de confirmación -->
        <!-- Modal de Consumo Interno -->
    <div id="internal-consumption-modal" class="hidden fixed inset-0 z-[320] flex items-center justify-center p-4 bg-cafe/90 backdrop-blur-md">
      <div class="panel w-full max-w-md bg-white p-10 space-y-8 animate-zoomIn">
        <div>
          <h2 class="text-2xl font-black text-cafe uppercase italic tracking-tighter">Consumo Interno</h2>
          <p class="text-[10px] font-bold text-cafe/40 uppercase tracking-[0.25em] mt-2">Asignar ticket actual a trabajador</p>
        </div>
        <form id="internal-consumption-form" class="space-y-6">
          <div class="block space-y-2">
            <span class="text-[10px] font-black text-cafe/30 uppercase tracking-[0.2em]">Nombre del trabajador</span>
            <input id="internal-worker-id" type="hidden" required>
            <div class="relative">
              <button type="button" id="internal-worker-button" class="w-full h-16 bg-papel border-2 border-borde/40 rounded-2xl px-5 text-sm font-black uppercase tracking-widest outline-none focus:border-caramelo transition-all text-cafe flex items-center justify-between">
                <span id="internal-worker-label" class="truncate">Selecciona trabajador...</span>
                <span class="text-lg text-cafe/50">⌄</span>
              </button>
              <div id="internal-worker-list" class="hidden absolute z-10 mt-2 w-full max-h-56 overflow-y-auto rounded-2xl border border-borde/40 bg-white shadow-2xl shadow-cafe/20 p-2 space-y-1"></div>
            </div>
          </div>
          <div class="p-5 bg-papel/70 rounded-2xl border border-borde/30">
            <p class="text-[9px] font-black text-cafe/35 uppercase tracking-[0.25em] mb-1">Total a cuenta del trabajador</p>
            <p id="internal-consumption-total" class="text-3xl font-black text-cafe">$ 0</p>
          </div>
          <div id="internal-consumption-message" class="hidden p-3 rounded-xl text-xs text-center font-bold"></div>
          <div class="flex gap-4">
            <button type="button" id="cancel-internal-consumption" class="flex-1 py-4 rounded-xl font-black uppercase text-xs tracking-widest text-cafe/40 hover:bg-papel">Cancelar</button>
            <button type="submit" id="confirm-internal-consumption" class="flex-[2] py-4 rounded-xl bg-cafe text-white font-black uppercase text-xs tracking-widest shadow-lg shadow-cafe/20">Registrar Consumo</button>
          </div>
        </form>
      </div>
    </div>

    <div id="payment-modal" class="hidden fixed inset-0 z-[300] flex items-center justify-center p-4 bg-cafe/95 backdrop-blur-xl">
      <div class="panel w-full max-w-md bg-white border-none shadow-[0_0_150px_rgba(0,0,0,0.6)] overflow-hidden text-center p-10 space-y-6 animate-zoomIn">
        <div class="w-24 h-24 bg-verdeok text-white rounded-full flex items-center justify-center text-5xl mx-auto shadow-2xl shadow-verdeok/40 ring-8 ring-verdeok/10 animate-bounce">✓</div>
        <div>
          <h2 class="text-3xl font-black text-cafe tracking-tighter uppercase italic">Venta Registrada</h2>
          <p class="text-[10px] font-bold text-cafe/40 uppercase tracking-[0.4em] mt-2">Folio #<span id="modal-folio">---</span></p>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="p-6 bg-[#f8f5f0] rounded-[2rem] border-2 border-dashed border-borde/60">
             <p class="text-[9px] font-black text-cafe/30 uppercase tracking-[0.3em] mb-2">Total Recaudado</p>
             <p id="modal-payment-total" class="text-3xl font-black text-verdeok tracking-tighter">$ 0</p>
          </div>
          <div id="modal-change-container" class="p-6 bg-papel/50 rounded-[2rem] border-2 border-dashed border-borde/60 hidden">
             <p class="text-[9px] font-black text-cafe/30 uppercase tracking-[0.3em] mb-2">Vuelto Entregado</p>
             <p id="modal-payment-change" class="text-3xl font-black text-cafe tracking-tighter">$ 0</p>
          </div>
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
                <option value="Unico" selected>Unico</option>
              </select>
           </div>
           <button type="submit" class="w-full py-6 rounded-2xl bg-caramelo text-white font-black uppercase tracking-[0.3em] shadow-2xl shadow-caramelo/40 hover:scale-[1.02] active:scale-95 transition-all text-lg">Abrir Turno Ahora 🥖</button>
        </form>
      </div>
    </div>

    <!-- Modal de Peso -->
    <div id="weight-modal" class="hidden fixed inset-0 flex items-center justify-center p-4 bg-cafe/90 backdrop-blur-md" style="z-index: 9999;">
      <div class="panel w-full max-w-sm bg-white p-10 space-y-6 text-center animate-zoomIn shadow-2xl">
        <h3 class="text-xl font-black text-cafe uppercase italic tracking-tighter" id="weight-product-name">Producto</h3>
        <p class="text-[10px] font-bold text-cafe/40 uppercase tracking-[0.2em] mt-2">Ingrese cantidad en KILOS (ej. 0.500)</p>
        <input id="weight-input" type="number" step="0.001" min="0.001" class="w-full h-16 bg-papel border-2 border-borde/40 rounded-2xl px-6 text-3xl font-black text-center outline-none focus:border-caramelo transition-all text-cafe" placeholder="0.000">
        <div class="flex gap-4 pt-4">
          <button id="weight-cancel" class="flex-1 py-4 rounded-xl font-black uppercase text-xs tracking-widest text-cafe/40 hover:bg-papel transition-all">Cancelar</button>
          <button id="weight-confirm" class="flex-1 py-4 rounded-xl bg-caramelo text-white font-black uppercase text-xs tracking-widest shadow-lg shadow-caramelo/30 hover:scale-105 active:scale-95 transition-all">Agregar</button>
        </div>
      </div>
    </div>

    <!-- Modal de Confirmación -->
    <div id="confirm-modal" class="hidden fixed inset-0 flex items-center justify-center p-4 bg-cafe/70 backdrop-blur-sm" style="z-index: 9999;">
      <div class="panel w-full max-w-sm bg-white p-10 space-y-6 text-center animate-zoomIn shadow-2xl">
        <p class="text-[10px] font-black text-cafe/30 uppercase tracking-[0.3em]">Confirmación</p>
        <h3 id="confirm-title" class="text-xl font-black text-cafe uppercase tracking-tighter">Confirmar</h3>
        <p id="confirm-message" class="text-sm text-cafe/60 font-medium">¿Estás seguro?</p>
        <div class="flex gap-4 pt-4">
          <button id="confirm-cancel" class="flex-1 py-3 rounded-xl font-black uppercase text-xs tracking-widest text-cafe/50 hover:bg-papel transition-all">Cancelar</button>
          <button id="confirm-ok" class="flex-1 py-3 rounded-xl bg-caramelo text-white font-black uppercase text-xs tracking-widest shadow-lg shadow-caramelo/30 hover:scale-105 active:scale-95 transition-all">Aceptar</button>
        </div>
      </div>
    </div>
  `;
}

export async function hydratePosView() {
  cart = loadCartFromStorage();
  const searchInput = document.querySelector("#header-search");
  const headerResults = document.querySelector("#header-search-results");
  const cartItemsContainer = document.querySelector("#cart-items");
  const cartTotal = document.querySelector("#cart-total");
  const cartCount = document.querySelector("#cart-count");
  const payButton = document.querySelector("#pay-button");
  const payButtonText = document.querySelector("#pay-button-text");
  const clearCartBtn = document.querySelector("#clear-cart");
  const methodBtns = document.querySelectorAll(".pay-method-btn");

  const paymentModal = document.querySelector("#payment-modal");
  const closePaymentModalBtn = document.querySelector("#close-payment-modal");
  const modalTotal = document.querySelector("#modal-payment-total");
  const internalConsumptionBtn = document.querySelector("#internal-consumption-button");
  const internalConsumptionModal = document.querySelector("#internal-consumption-modal");
  const internalConsumptionForm = document.querySelector("#internal-consumption-form");
  const internalWorkerId = document.querySelector("#internal-worker-id");
  const internalWorkerButton = document.querySelector("#internal-worker-button");
  const internalWorkerLabel = document.querySelector("#internal-worker-label");
  const internalWorkerList = document.querySelector("#internal-worker-list");
  const internalConsumptionTotal = document.querySelector("#internal-consumption-total");
  const internalConsumptionMessage = document.querySelector("#internal-consumption-message");
  const cancelInternalConsumptionBtn = document.querySelector("#cancel-internal-consumption");
  const confirmInternalConsumptionBtn = document.querySelector("#confirm-internal-consumption");

  // Selectores Confirmación
  const confirmModal = document.querySelector("#confirm-modal");
  const confirmTitle = document.querySelector("#confirm-title");
  const confirmMsg = document.querySelector("#confirm-message");
  const confirmOkBtn = document.querySelector("#confirm-ok");
  const confirmCancelBtn = document.querySelector("#confirm-cancel");
  const quickPrintToggle = document.querySelector('#quick-print-toggle');

  function showConfirm(title, message, onConfirm) {
    const modal = document.querySelector("#confirm-modal");
    const titleEl = document.querySelector("#confirm-title");
    const msgEl = document.querySelector("#confirm-message");
    const okBtn = document.querySelector("#confirm-ok");
    const cancelBtn = document.querySelector("#confirm-cancel");

    if (!modal || !titleEl || !msgEl || !okBtn || !cancelBtn || !okBtn.parentNode || !cancelBtn.parentNode) {
      if (window.confirm(message)) onConfirm();
      return;
    }

    titleEl.textContent = title;
    msgEl.textContent = message;
    modal.classList.remove("hidden");

    okBtn.onclick = () => {
      modal.classList.add("hidden");
      onConfirm();
    };
    cancelBtn.onclick = () => {
      modal.classList.add("hidden");
    };
  }

  async function loadData() {
    const session = getSession();
    const userId = session?.usuario?.id;

    // 1. Verificar Turno (independiente - si falla no bloquea los productos)
    try {
      const { getTurnos } = await import("../../services/shiftService.js");
      const sRes = await getTurnos({ estado: "Abierto" });
      currentShift = (sRes.data || []).find((t) => t.id_usuario === userId);

      if (!currentShift) {
        document.querySelector("#open-shift-modal")?.classList.remove("hidden");
        document.querySelector("#monto-apertura-pos")?.focus();
      }
    } catch (e) {
      console.warn("No se pudo verificar turno (servidor):", e.message || e);
      // Permitir operar sin turno si el servidor falla
    }

    // 2. Cargar productos (siempre, independiente del turno)
    try {
      const pRes = await getProductos();
      allProducts = (pRes.data || [])
        .filter((p) => p.activo)
        .map((p) => ({ ...p, stock_actual: getStock(p) }));
      syncCartWithProducts();
      updateCartUI();
    } catch (e) {
      console.error("Error al cargar productos:", e);
    }

    // 3. Cargar métodos de pago
    try {
      const { getMetodosPago } = await import("../../services/masterService.js");
      const mRes = await getMetodosPago();
      paymentMethods = mRes.data || [];
    } catch (e) {
      console.error("Error al cargar métodos de pago:", e);
    }
  }

  async function refreshProducts() {
    // Si se está procesando una venta, esperamos al siguiente ciclo
    if (isProcessingSale) return;
    
    try {
      const pRes = await getProductos();
      const updatedProducts = (pRes.data || []).filter(p => p.activo);
      
      // Actualizamos allProducts preservando la estructura necesaria
      allProducts = updatedProducts.map(p => ({
        ...p,
        stock_actual: getStock(p)
      }));

      // Sincronizamos el carrito (por si cambió el stock crítico de algo ya en el carro)
      syncCartWithProducts();
      updateCartUI();
      
      console.log("Productos refrescados automáticamente:", new Date().toLocaleTimeString());
    } catch (e) {
      console.warn("Error en auto-refresco de productos:", e);
    }
  }

  const openShiftForm = document.querySelector("#open-shift-form");
  openShiftForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const monto = Number(document.querySelector("#monto-apertura-pos").value);
    const tipo = document.querySelector("#tipo-turno-pos").value;

    try {
      const { abrirTurno } = await import("../../services/shiftService.js");
      const res = await abrirTurno({ tipo_turno: tipo, monto_apertura: monto });

      currentShift = res.turno;
      document.querySelector("#open-shift-modal")?.classList.add("hidden");
      showNotification("TURNO ABIERTO CORRECTAMENTE", "success");

      // Abrir gaveta automáticamente al iniciar el turno (fondo inicial)
      if (window.electronAPI?.printTicket) {
        window.electronAPI.printTicket({ skip_print: true }).catch(() => {});
      }
    } catch (error) {
      showNotification(error.message || "Error al abrir turno", "error");
    }
  });

  // Escuchar búsqueda desde el evento global de app.js
  if (window._posSearchListener)
    window.removeEventListener("pos-search", window._posSearchListener);
  let scanLock = false;
  let scanLockTimer = null;
  window._posSearchListener = (e) => {
    const term = (e.detail || "").trim().toLowerCase();

    if (scanLock) {
      return;
    }

    if (term.length < 2) {
      headerResults.classList.add("hidden");
      return;
    }

    const filtered = allProducts
      .filter(
        (p) =>
          p.nombre.toLowerCase().includes(term) ||
          (p.codigo_interno || "").toLowerCase().includes(term) ||
          (p.codigo_barra_externo || "").toLowerCase().includes(term),
      )
      .slice(0, 15);

    const digiData = parseDigiScaleBarcode(term);
    if (digiData) {
      scanLock = true;
      if (scanLockTimer) clearTimeout(scanLockTimer);
      scanLockTimer = setTimeout(() => {
        scanLock = false;
      }, 250);
      const normalizedPlu = String(digiData.plu).replace(/^0+/, "") || "0";
      const paddedPlu = String(digiData.plu).padStart(digiData.pluLength || 4, "0");
      let scaleMatch = allProducts.find(
        (p) => {
          const pluBalanza = String(p.plu_balanza || "").replace(/^0+/, "");
          const codigoInterno = String(p.codigo_interno || "").replace(/^0+/, "");
          const codigoExterno = String(p.codigo_barra_externo || "").replace(/^0+/, "");

          return (
            String(p.plu_balanza || "").padStart(digiData.pluLength || 4, "0") === paddedPlu ||
            pluBalanza === normalizedPlu ||
            codigoInterno === normalizedPlu ||
            codigoExterno === normalizedPlu
          );
        },
      );

      if (!scaleMatch && digiData.pluLength === 5) {
        const fallbackPlu = normalizedPlu.slice(1);
        scaleMatch = allProducts.find(
          (p) => {
            const pluBalanza = String(p.plu_balanza || "").replace(/^0+/, "");
            const codigoInterno = String(p.codigo_interno || "").replace(/^0+/, "");
            const codigoExterno = String(p.codigo_barra_externo || "").replace(/^0+/, "");

            return (
              pluBalanza === fallbackPlu ||
              codigoInterno === fallbackPlu ||
              codigoExterno === fallbackPlu
            );
          },
        );
      }

      if (scaleMatch) {
        addToCart(scaleMatch.id, true, digiData.weight);
        headerResults.classList.add("hidden");
        if (searchInput) {
          searchInput.value = "";
          searchInput.focus();
        }
        return;
      }

      showNotification(
        `PLU ${paddedPlu} no encontrado en productos. Peso ${digiData.weight.toFixed(3)} kg`,
        "warning",
      );
    }

    // AUTO-ADD si hay coincidencia EXACTA por código (Ideal para Scanners)
    const exactMatch = allProducts.find(
      (p) =>
        (p.codigo_interno || "").toLowerCase() === term ||
        (p.codigo_barra_externo || "").toLowerCase() === term,
    );

    if (exactMatch) {
      scanLock = true;
      if (scanLockTimer) clearTimeout(scanLockTimer);
      scanLockTimer = setTimeout(() => {
        scanLock = false;
      }, 250);
      addToCart(exactMatch.id);
      headerResults.classList.add("hidden");
      if (searchInput) {
        searchInput.value = "";
        searchInput.focus();
      }
      return; // Detener flujo para no mostrar dropdown
    }

    if (filtered.length > 0) {
      headerResults.classList.remove("hidden");
      headerResults.innerHTML = filtered
        .map(
          (p) => `
        <div class="search-result-item group p-8 border-b border-borde/5" data-id="${p.id}">
          <div class="flex-1 min-w-0 pr-6">
             <p class="text-sm font-black text-cafe uppercase truncate">${escapeHtml(p.nombre)}</p>
             <p class="text-[10px] font-bold text-cafe/30 uppercase mt-1.5 font-mono">STOCK: ${getStock(p)} • ${formatCurrency(p.precio_venta)}</p>
          </div>
          <button class="add-btn w-12 h-12 text-2xl shadow-md" data-id="${p.id}">+</button>
        </div>
      `,
        )
        .join("");

      headerResults.querySelectorAll(".search-result-item").forEach((item) => {
        item.addEventListener("click", (e) => {
          e.stopPropagation();
          const id = item.dataset.id;
          addToCart(id);
          headerResults.classList.add("hidden");
          if (searchInput) {
            searchInput.value = "";
            searchInput.focus();
          }
        });
      });
    } else {
      headerResults.classList.remove("hidden");
      headerResults.innerHTML = `
        <div class="p-10 text-center opacity-40">
          <p class="text-xs font-black uppercase tracking-widest text-cafe/50">Nada encontrado</p>
        </div>
      `;
    }
  };
  window.addEventListener("pos-search", window._posSearchListener);

  if (searchInput && headerResults) {
    // Cerrar al clickear fuera
    if (window._posClickListener)
      document.removeEventListener("click", window._posClickListener);
    window._posClickListener = (e) => {
      if (
        !searchInput.contains(e.target) &&
        !headerResults.contains(e.target)
      ) {
        headerResults.classList.add("hidden");
      }
    };
    document.addEventListener("click", window._posClickListener);
  }

  function isPesable(product) {
    const flag = product?.pesable;
    return flag === true || flag === 1 || flag === "1" || flag === "true";
  }

  function validateEAN13(barcode) {
    if (barcode.length !== 13) return false;
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(barcode[i]) * (i % 2 === 0 ? 1 : 3);
    }
    const checksum = (10 - (sum % 10)) % 10;
    return checksum === parseInt(barcode[12]);
  }

  function parseDigiScaleBarcode(rawValue = "") {
    const digits = String(rawValue || "").replace(/\D/g, "");
    if (digits.length !== 13) return null;

    if (!validateEAN13(digits)) {
      console.warn("Check-digit de balanza inv\u00e1lido:", digits);
      return null;
    }

    const prefix = digits.slice(0, 2);
    if (!["59", "95", "25"].includes(prefix)) return null;

    // Prefijo 25: PLU de 5 dígitos (según requerimiento de Panadería Matías)
    // Otros prefijos: PLU de 4 dígitos (estándar común)
    const pluLength = prefix === "25" ? 5 : 4;
    const plu = digits.slice(2, 2 + pluLength);

    // El peso son los dígitos después del PLU hasta el penúltimo dígito (el último es el checksum)
    // Ejemplo 25: 25(2) + 03043(5) + 00582(5) + 0(1) = 13
    const weightRaw = digits.slice(2 + pluLength, 12);
    const weight = Number(weightRaw) / 1000;

    if (!plu || !Number.isFinite(weight) || weight <= 0) return null;

    return { plu, weight, pluLength };
  }

  function showWeightModal(product, onConfirm) {
    // Eliminar modal anterior si existe
    const old = document.getElementById('_dyn_weight_modal');
    if (old) old.remove();

    const modal = document.createElement('div');
    modal.id = '_dyn_weight_modal';
    modal.style.cssText = 'display:flex; position:fixed; top:0; left:0; width:100%; height:100%; z-index:99999; align-items:center; justify-content:center; background:rgba(0,0,0,0.82);';
    modal.innerHTML = `
      <div style="background:#fff; border-radius:20px; padding:40px 36px; max-width:380px; width:92%; text-align:center; box-shadow:0 30px 60px rgba(0,0,0,0.5);">
        <p style="font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:3px; color:#aaa; margin:0 0 8px;">PRODUCTO PESABLE</p>
        <h3 style="font-size:1.15rem; font-weight:900; text-transform:uppercase; color:#3d2b1f; margin:0 0 20px; line-height:1.3;">${product.nombre}</h3>
        <p style="font-size:11px; font-weight:700; color:#aaa; margin:0 0 12px; letter-spacing:1px;">Ingrese cantidad en KILOS (ej: 0.500)</p>
        <input id="_dyn_weight_input" type="number" step="0.001" min="0.001"
          style="width:100%; height:68px; border:2px solid #e0d5cc; border-radius:14px; padding:0 20px; font-size:2.2rem; font-weight:900; text-align:center; outline:none; color:#3d2b1f; box-sizing:border-box; font-family:monospace;"
          placeholder="0.000">
        <div style="display:flex; gap:12px; margin-top:20px;">
          <button id="_dyn_weight_cancel" style="flex:1; padding:15px; border-radius:12px; border:2px solid #eee; background:none; font-weight:800; text-transform:uppercase; font-size:11px; cursor:pointer; color:#bbb; letter-spacing:1px;">Cancelar</button>
          <button id="_dyn_weight_confirm" style="flex:1; padding:15px; border-radius:12px; border:none; background:#c47a2a; color:#fff; font-weight:900; text-transform:uppercase; font-size:11px; cursor:pointer; letter-spacing:1px; box-shadow:0 6px 16px rgba(196,122,42,0.45);">&#10003; Agregar</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const input = document.getElementById('_dyn_weight_input');
    const cancelBtn = document.getElementById('_dyn_weight_cancel');
    const confirmBtn = document.getElementById('_dyn_weight_confirm');

    const hide = () => modal.remove();

    cancelBtn.addEventListener('click', hide);
    confirmBtn.addEventListener('click', () => {
      const weight = Number(input.value);
      if (isNaN(weight) || weight <= 0) {
        showNotification('Ingrese un peso v\u00e1lido mayor a 0', 'warning');
        return;
      }
      hide();
      onConfirm(weight);
    });
    input.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') confirmBtn.click();
      if (e.key === 'Escape') cancelBtn.click();
    });
    setTimeout(() => input.focus(), 60);
  }


  function addToCart(productId, bypassWeightCheck = false, forcedQuantity = 1) {
    const product = allProducts.find((p) => p.id == productId);
    if (!product) return;

    const pesable = isPesable(product);

    if (!bypassWeightCheck && pesable) {
      showWeightModal(product, (weight) => {
        addToCart(productId, true, weight);
      });
      return;
    }

    const existing = cart.find((i) => i.id == productId);
    const currentQty = existing ? existing.quantity : 0;
    const stock = getStock(product);

    // Solo bloquear si el stock es mayor que 0 Y está agotado
    if (stock > 0 && stock <= currentQty) {
      showNotification(
        `STOCK INSUFICIENTE: Solo quedan ${stock} unidades de ${product.nombre}`,
        "warning",
      );
      return;
    }

    if (existing) {
      existing.quantity += forcedQuantity;
      const idx = cart.indexOf(existing);
      cart.splice(idx, 1);
      cart.unshift(existing);
    } else {
      cart.unshift({ ...product, quantity: forcedQuantity });
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
      if (internalConsumptionBtn) internalConsumptionBtn.disabled = true;
      payButtonText.textContent = "COBRAR $ 0";
    } else {
      cartItemsContainer.innerHTML = cart
        .map(
          (item, idx) => `
         <div class="flex items-center px-4 md:px-8 py-4 md:py-8 bg-white border-b border-borde/5 hover:bg-cafe/[0.01] transition-all group animate-slideInRight" style="animation-delay: ${idx * 0.05}s">
            <!-- Col 1: Info Producto (flex-1) -->
            <div class="flex-1 min-w-0 pr-4 md:pr-12">
               <div class="flex items-start gap-3 md:gap-5">
                  <div class="w-1 md:w-1.5 h-8 md:h-12 bg-caramelo rounded-full shrink-0"></div>
                  <div>
                    <h4 class="text-lg md:text-3xl font-black text-cafe uppercase tracking-tighter leading-tight truncate md:whitespace-normal">${escapeHtml(item.nombre)}</h4>
                    <div class="flex items-center gap-2 md:gap-4 mt-1 md:mt-2">
                        <span class="text-[8px] md:text-[10px] font-black text-cafe/30 uppercase tracking-[0.2em] bg-papel px-2 py-0.5 md:py-1 rounded-md">${item.codigo_interno || "SKU"}</span>
                        <span class="text-[8px] md:text-[10px] font-black text-caramelo uppercase tracking-[0.1em] italic text-[9px] md:text-xs">${item.categoria || "Sin Categoría"}</span>
                    </div>
                  </div>
               </div>
            </div>
            
            <!-- Col 2: Cantidad (w-24 md:w-40) -->
            <div class="w-24 md:w-40 flex justify-center shrink-0">
               <div class="qty-control-wrapper shadow-lg scale-90 md:scale-125">
                  <button class="cart-item-qty-btn" data-action="dec" data-id="${item.id}">−</button>
                  <span class="text-sm md:text-2xl font-black text-cafe w-auto min-w-[2rem] md:min-w-[3rem] px-1 md:px-2 text-center select-none tracking-tighter tabular-nums">${item.quantity % 1 !== 0 ? item.quantity.toFixed(3) : item.quantity}</span>
                  <button class="cart-item-qty-btn" data-action="inc" data-id="${item.id}">+</button>
               </div>
            </div>

            <!-- Col 3: Precio Unitario (w-24 md:w-40) -->
            <div class="w-24 md:w-40 text-right md:pr-10 shrink-0">
               <p class="text-sm md:text-2xl font-bold text-cafe/40 tabular-nums">${formatCurrency(item.precio_venta)}</p>
               <p class="text-[7px] md:text-[8px] font-black text-cafe/20 uppercase tracking-[0.2em] mt-1 opacity-60">Unit.</p>
            </div>

            <!-- Col 4: Subtotal (w-32 md:w-48) -->
            <div class="w-32 md:w-48 text-right md:pr-6 shrink-0">
               <p class="text-2xl md:text-5xl font-black text-cafe tracking-tighter tabular-nums leading-none">${formatCurrency(calculateItemSubtotal(item))}</p>
               ${item.cantidad_promo > 0 && item.quantity >= item.cantidad_promo ? `<p class="text-[8px] md:text-[9px] font-bold text-verdeok uppercase tracking-widest mt-1">PROMO APLICADA</p>` : `<p class="text-[8px] md:text-[10px] font-black text-caramelo uppercase tracking-[0.2em] mt-1.5 md:mt-2.5">Subtotal</p>`}
            </div>

            <!-- Col 5: Eliminar (w-10 md:w-12) -->
            <div class="w-10 md:w-12 flex justify-end shrink-0">
               <button class="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center bg-rojoaviso text-white shadow-md hover:bg-rojoaviso/90 active:scale-95 transition-all text-xs md:text-sm font-black" data-action="remove" data-id="${item.id}">✕</button>
            </div>
         </div>
       `,
        )
        .join("");

      payButton.disabled = false;
      if (internalConsumptionBtn) internalConsumptionBtn.disabled = false;

      cartItemsContainer.querySelectorAll("[data-action]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.dataset.id;
          const action = btn.dataset.action;
          const item = cart.find((i) => i.id == id);
          if (action === "inc") {
            const product = allProducts.find((p) => p.id == id) || item;
            if (getStock(product) <= item.quantity) {
              showNotification(
                `STOCK INSUFICIENTE: Solo quedan ${getStock(product)} unidades de ${item.nombre}`,
                "warning",
              );
              return;
            }
            item.quantity++;
          } else if (action === "dec") {
            item.quantity -= item.quantity % 1 !== 0 ? item.quantity : 1;
            if (item.quantity <= 0) cart = cart.filter((i) => i.id != id);
          } else if (action === "remove") {
            cart = cart.filter((i) => i.id != id);
          }
          updateCartUI();
        });
      });
    }

    const total = getCartTotal();
    cartTotal.textContent = formatCurrency(total);
  cartCount.textContent = `(${cart.length})`;
    payButtonText.textContent = `COBRAR ${formatCurrency(total)}`;
    saveCartToStorage(cart);
  }

  methodBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      methodBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      selectedPaymentMethod = btn.dataset.method;
    });
  });

  const mixedModal = document.querySelector("#mixed-payment-modal");
  const mixedEfectivoInput = document.querySelector("#mixed-efectivo");
  const mixedTarjetaInput = document.querySelector("#mixed-tarjeta");
  const confirmMixedBtn = document.querySelector("#confirm-mixed");
  const cancelMixedBtn = document.querySelector("#cancel-mixed");

  const cashModal = document.querySelector("#cash-payment-modal");
  const cashReceivedInput = document.querySelector("#cash-received");
  const cashChangeDisplay = document.querySelector("#cash-change");
  const cashModalTotal = document.querySelector("#cash-modal-total");
  const confirmCashBtn = document.querySelector("#confirm-cash");
  const cancelCashBtn = document.querySelector("#cancel-cash");

  // Lógica de cálculo automático para pago mixto
  mixedEfectivoInput.addEventListener("input", () => {
    const total = getCartTotal();
    const efectivo = Number(mixedEfectivoInput.value) || 0;
    const tarjeta = Math.max(0, total - efectivo);
    mixedTarjetaInput.value = tarjeta;
  });

  // Lógica de cálculo automático para pago en efectivo (vuelto)
  cashReceivedInput.addEventListener("input", () => {
    const total = getCartTotal();
    const recibido = Number(cashReceivedInput.value) || 0;
    const vuelto = Math.max(0, recibido - total);
    cashChangeDisplay.textContent = formatCurrency(vuelto);
  });

  cashReceivedInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      confirmCashBtn.click();
    }
  });

  payButton.addEventListener("click", async () => {
    if (isProcessingSale) return;

    const total = getCartTotal();

    if (selectedPaymentMethod === "Mixto") {
      mixedEfectivoInput.value = 0;
      mixedTarjetaInput.value = total;
      mixedModal.classList.remove("hidden");
      mixedEfectivoInput.focus();
      mixedEfectivoInput.select();
      return;
    }

    if (selectedPaymentMethod === "Efectivo") {
      cashModalTotal.textContent = formatCurrency(total);
      cashReceivedInput.value = "";
      cashChangeDisplay.textContent = formatCurrency(0);
      cashModal.classList.remove("hidden");
      cashReceivedInput.focus();
      return;
    }

    await processSale(total, selectedPaymentMethod);
  });

  confirmCashBtn.addEventListener("click", async () => {
    if (isProcessingSale) return;
    const total = getCartTotal();
    const recibido = Number(cashReceivedInput.value) || 0;

    if (recibido < total) {
      showNotification("EL MONTO RECIBIDO ES MENOR AL TOTAL", "warning");
      return;
    }

    cashModal.classList.add("hidden");
    const vuelto = recibido - total;

    // ABRIR GAVETA AL FINALIZAR COMPRA (EFECTIVO)
    if (window.electronAPI?.printTicket) {
      window.electronAPI.printTicket({ skip_print: true }).catch(() => {});
    }

    await processSale(total, "Efectivo", null, vuelto);
  });

  cancelCashBtn.addEventListener("click", () => {
    cashModal.classList.add("hidden");
  });

  confirmMixedBtn.addEventListener("click", async () => {
    if (isProcessingSale) return;

    const total = getCartTotal();
    const efectivo = Number(mixedEfectivoInput.value) || 0;
    const tarjeta = Number(mixedTarjetaInput.value) || 0;

    if (efectivo < 0 || efectivo > total || efectivo + tarjeta !== total) {
      showNotification(
        "REVISA EL PAGO MIXTO: LOS MONTOS DEBEN SUMAR EL TOTAL EXACTO",
        "warning",
      );
      return;
    }

    mixedModal.classList.add("hidden");

    // ABRIR GAVETA AL FINALIZAR COMPRA (PAGO MIXTO)
    if (window.electronAPI?.printTicket) {
      window.electronAPI.printTicket({ skip_print: true }).catch(() => {});
    }

    await processSale(total, "Mixto", { efectivo, tarjeta });
  });

  cancelMixedBtn.addEventListener("click", () => {
    mixedModal.classList.add("hidden");
  });

  function getPaymentMethodId(label) {
    const normalizedLabel = String(label || "").toLowerCase();
    const found = paymentMethods.find((m) =>
      String(m.nombre || "")
        .toLowerCase()
        .includes(normalizedLabel),
    );
    return found?.id || null;
  }

  function validateCartStock() {
    for (const item of cart) {
      const product = allProducts.find((p) => p.id === item.id) || item;
      if (getStock(product) < item.quantity) {
        showNotification(
          `STOCK INSUFICIENTE: Solo quedan ${getStock(product)} unidades de ${item.nombre}`,
          "warning",
        );
        return false;
      }
    }
    return true;
  }

  function setInternalWorker(id, label) {
    internalWorkerId.value = id || "";
    internalWorkerLabel.textContent = label || "Selecciona trabajador...";
    internalWorkerList.classList.add("hidden");
  }

  function renderInternalWorkers(trabajadores = []) {
    if (!trabajadores.length) {
      internalWorkerList.innerHTML = '<div class="px-4 py-5 text-center text-xs font-bold text-cafe/35">No hay trabajadores creados</div>';
      setInternalWorker("", "Sin trabajadores creados");
      return;
    }

    internalWorkerList.innerHTML = trabajadores.map((trabajador) => {
      const label = `${trabajador.nombre} ${trabajador.apellido}`;
      return `
        <button type="button" class="internal-worker-option w-full text-left px-4 py-3 rounded-xl hover:bg-papel text-sm font-black text-cafe uppercase tracking-widest transition-colors" data-id="${trabajador.id}" data-label="${escapeHtml(label)}">
          ${escapeHtml(label)}
        </button>
      `;
    }).join("");

    internalWorkerList.querySelectorAll(".internal-worker-option").forEach((option) => {
      option.addEventListener("click", () => {
        setInternalWorker(option.dataset.id, option.dataset.label);
      });
    });

    setInternalWorker("", "Selecciona trabajador...");
  }

  async function openInternalConsumptionModal() {
    if (cart.length === 0) return;
    if (!currentShift) {
      showNotification("NO SE PUEDE REGISTRAR CONSUMO SIN TURNO ABIERTO", "error");
      return;
    }
    if (!validateCartStock()) return;

    internalConsumptionMessage?.classList.add("hidden");
    internalConsumptionTotal.textContent = formatCurrency(getCartTotal());
    setInternalWorker("", "Cargando trabajadores...");
    internalWorkerList.innerHTML = "";
    internalConsumptionModal.classList.remove("hidden");

    try {
      const response = await getTrabajadores();
      renderInternalWorkers(response.data || []);
    } catch (error) {
      setInternalWorker("", "Error al cargar trabajadores");
      showNotification(error.message, "error");
    }
  }

  function closeInternalConsumptionModal() {
    internalConsumptionModal?.classList.add("hidden");
    internalConsumptionForm?.reset();
    setInternalWorker("", "Selecciona trabajador...");
    internalConsumptionMessage?.classList.add("hidden");
  }

  async function processInternalConsumption(idTrabajador) {
    if (isProcessingSale) return;
    if (!idTrabajador) {
      internalConsumptionMessage.textContent = "Selecciona un trabajador.";
      internalConsumptionMessage.className = "p-3 rounded-xl text-xs text-center font-bold bg-rojoaviso/10 text-rojoaviso";
      internalConsumptionMessage.classList.remove("hidden");
      return;
    }
    if (!validateCartStock()) return;

    isProcessingSale = true;
    confirmInternalConsumptionBtn.disabled = true;
    internalConsumptionBtn.disabled = true;
    payButton.disabled = true;

    try {
      await registrarConsumoPersonal({
        id_trabajador: Number(idTrabajador),
        id_turno: currentShift?.id,
        detalle_productos: cart.map((item) => ({
          id_producto: item.id,
          cantidad: item.quantity,
          precio_unitario: item.precio_venta || 0
        }))
      });

      cart.forEach((item) => {
        const product = allProducts.find((p) => p.id === item.id);
        if (product) {
          product.stock_actual = Math.max(0, getStock(product) - item.quantity);
        }
      });

      cart = [];
      updateCartUI();
      closeInternalConsumptionModal();
      showNotification("CONSUMO INTERNO REGISTRADO", "success");
    } catch (error) {
      internalConsumptionMessage.textContent = error.message;
      internalConsumptionMessage.className = "p-3 rounded-xl text-xs text-center font-bold bg-rojoaviso/10 text-rojoaviso";
      internalConsumptionMessage.classList.remove("hidden");
    } finally {
      isProcessingSale = false;
      confirmInternalConsumptionBtn.disabled = false;
      updateCartUI();
    }
  }

  async function printSaleTicket(printData) {
    if (!window.electronAPI?.printTicket) {
      showNotification(
        "VENTA REGISTRADA, PERO LA IMPRESORA NO ESTA DISPONIBLE",
        "warning",
      );
      return;
    }

    try {
      const printerName = localStorage.getItem('selected_printer') || '';
      const paperWidth = localStorage.getItem('paper_width') || '80';
      const result = await window.electronAPI.printTicket({ 
        ...printData, 
        printer_name: printerName,
        paper_width: paperWidth
      });
      if (!result?.success) {
        const printError = result?.error || result?.message || result?.failureReason || "REVISA LA IMPRESORA";
        showNotification(
          `VENTA REGISTRADA, PERO NO SE IMPRIMIO EL TICKET: ${printError}`,
          "warning",
        );
      }
    } catch (error) {
      console.error("Print Error:", error);
      showNotification(
        "VENTA REGISTRADA, PERO FALLO LA IMPRESION DEL TICKET",
        "warning",
      );
    }
  }

  async function processSale(total, method, mixedData = null, vuelto = 0) {
    if (isProcessingSale) return;
    if (cart.length === 0) return;
    if (!currentShift) {
      showNotification("NO SE PUEDE COBRAR SIN UN TURNO ABIERTO", "error");
      return;
    }
    if (!Number.isFinite(total) || total <= 0) {
      showNotification("EL TOTAL DE LA VENTA NO ES VALIDO", "error");
      return;
    }
    if (!validateCartStock()) return;

    isProcessingSale = true;
    payButton.disabled = true;
    confirmMixedBtn.disabled = true;
    payButtonText.textContent = "PROCESANDO...";

    let payloadPagos = [];
    if (mixedData) {
      const efectivoMethodId = getPaymentMethodId("Efectivo");
      const tarjetaMethodId = getPaymentMethodId("Tarjeta");
      if (!efectivoMethodId || !tarjetaMethodId) {
        showNotification(
          "FALTAN METODOS DE PAGO PARA REGISTRAR PAGO MIXTO",
          "error",
        );
        isProcessingSale = false;
        payButton.disabled = false;
        confirmMixedBtn.disabled = false;
        payButtonText.textContent = `COBRAR ${formatCurrency(total)}`;
        return;
      }

      payloadPagos = [
        { id_metodo_pago: efectivoMethodId, monto_pagado: mixedData.efectivo },
        { id_metodo_pago: tarjetaMethodId, monto_pagado: mixedData.tarjeta },
      ];
    } else {
      const methodId = getPaymentMethodId(method);
      if (!methodId) {
        showNotification(`NO EXISTE EL METODO DE PAGO ${method}`, "error");
        isProcessingSale = false;
        payButton.disabled = false;
        confirmMixedBtn.disabled = false;
        payButtonText.textContent = `COBRAR ${formatCurrency(total)}`;
        return;
      }

      payloadPagos = [{ id_metodo_pago: methodId, monto_pagado: total }];
    }

    const session = getSession();
    const sucursalId = session?.usuario?.id_sucursal || 1;
    const payload = {
      id_turno: currentShift.id,
      id_sucursal: sucursalId,
      total_venta: total,
      detalle_productos: cart.map((item) => ({
        id_producto: item.id,
        cantidad: item.quantity,
        precio_unitario: item.precio_venta || 0,
        subtotal: (item.precio_venta || 0) * item.quantity,
      })),
      pagos_mixtos: payloadPagos,
    };

    try {
      console.log("Enviando Venta:", payload);

      const res = await registrarVenta(payload);
      console.log("Respuesta:", res);

      const folio = res.venta?.folio || res.data?.folio_interno || "N/A";
      document.querySelector("#modal-folio").textContent = folio;
      modalTotal.textContent = formatCurrency(total);

      const changeContainer = document.querySelector("#modal-change-container");
      const changeDisplay = document.querySelector("#modal-payment-change");
      if (vuelto > 0) {
        changeDisplay.textContent = formatCurrency(vuelto);
        changeContainer.classList.remove("hidden");
      } else {
        changeContainer.classList.add("hidden");
      }

      paymentModal.classList.remove("hidden");

      const paperWidth = parseInt(localStorage.getItem('paper_width') || '80', 10);
      const skipPrint = localStorage.getItem('print_ticket') === 'false';

      const printPayload = {
        folio: folio,
        total: total,
        metodo: method,
        paper_width: paperWidth,
        skip_print: skipPrint,
        items: cart.map((i) => ({
          nombre: i.nombre,
          cantidad: i.quantity,
          precio_unitario: i.precio_venta || 0,
        }))
      };

      cart.forEach((item) => {
        const product = allProducts.find((p) => p.id === item.id);
        if (product) {
          product.stock_actual = Math.max(0, getStock(product) - item.quantity);
        }
      });

      cart = [];
      updateCartUI();
      isProcessingSale = false;
      confirmMixedBtn.disabled = false;

      printSaleTicket(printPayload).catch(() => {});
    } catch (error) {
      console.error("Error Venta:", error);
      showNotification(
        `ERROR AL COBRAR: ${error.error || error.message || "Falla de red"}`,
        "error",
      );
      isProcessingSale = false;
      payButton.disabled = false;
      confirmMixedBtn.disabled = false;
      payButtonText.textContent = `COBRAR ${formatCurrency(total)}`;
    }
  }

  clearCartBtn?.addEventListener("click", () => {
    if (cart.length > 0) {
      showConfirm(
        "VACIAR CARRITO",
        "Se eliminarán todos los items cargados del carrito actual",
        () => {
          cart = [];
          updateCartUI();
        },
      );
    }
  });

  internalConsumptionBtn?.addEventListener("click", openInternalConsumptionModal);

  internalWorkerButton?.addEventListener("click", () => {
    internalWorkerList?.classList.toggle("hidden");
  });

  cancelInternalConsumptionBtn?.addEventListener("click", closeInternalConsumptionModal);

  internalConsumptionForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await processInternalConsumption(internalWorkerId.value);
  });

  closePaymentModalBtn.addEventListener("click", () => {
    paymentModal.classList.add("hidden");
    searchInput.focus();
  });

  // Atajos de teclado
  window.addEventListener("keydown", (e) => {
    // F2: Enfocar búsqueda
    if (e.key === "F2") {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
    // ESC: Limpiar ticket
    if (e.key === "Escape") {
      if (cart.length > 0) {
        showConfirm(
          "VACIAR CARRITO",
          "¿Estás seguro de que deseas eliminar todos los productos del carrito?",
          () => {
            cart = [];
            updateCartUI();
          },
        );
      }
    }
    // F1: Cobrar
    if (e.key === "F1") {
      e.preventDefault();
      if (cart.length > 0 && !payButton.disabled) {
        payButton.click();
      }
    }
  });

  // Botón rápido de impresión
  let printTicketEnabled = localStorage.getItem('print_ticket') !== 'false';
  const updateQuickPrintToggle = () => {
    if (!quickPrintToggle) return;
    quickPrintToggle.textContent = `Ticket: ${printTicketEnabled ? 'ON' : 'OFF'}`;
    quickPrintToggle.style.background = printTicketEnabled ? '#c47a2a' : '';
    quickPrintToggle.style.color = printTicketEnabled ? '#fff' : '';
  };
  quickPrintToggle?.addEventListener('click', () => {
    printTicketEnabled = !printTicketEnabled;
    localStorage.setItem('print_ticket', String(printTicketEnabled));
    updateQuickPrintToggle();
  });
  updateQuickPrintToggle();

  await loadData();

  // Limpiar intervalo previo si existe y configurar nuevo polling (cada 30 seg)
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(refreshProducts, 30000);
}


