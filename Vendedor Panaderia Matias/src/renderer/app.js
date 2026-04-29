import { renderLoginView, attachLoginEvents } from './modules/auth/authView.js';
import { renderPosSkeleton, hydratePosView } from './modules/pos/posView.js';
import { renderVentasSkeleton, hydrateVentasView } from './modules/ventas/ventasView.js';
import { renderCajaSkeleton, hydrateCajaView } from './modules/caja/cajaView.js';
import { renderProductosSkeleton, hydrateProductosView } from './modules/productos/productosView.js';
import { clearSession, getSession, isAuthenticated } from './state/sessionStore.js';
import { escapeHtml } from './utils/formatters.js';

window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());

const app = document.querySelector('#app');
let currentRoute = 'dashboard';

const routes = {
  dashboard: { render: renderPosSkeleton, hydrate: hydratePosView },
  productos: { render: renderProductosSkeleton, hydrate: hydrateProductosView },
  ventas: { render: renderVentasSkeleton, hydrate: hydrateVentasView },
  caja: { render: renderCajaSkeleton, hydrate: hydrateCajaView },
};

function buildShell() {
  const session = getSession();
  const config = routes[currentRoute];

  return `
    <div class="flex flex-col h-screen bg-crema/20 overflow-hidden font-sans">
      <!-- HEADER PRINCIPAL (BASADO EN REFERENCIA) -->
      <header class="h-24 bg-white border-b border-borde/40 px-10 flex items-center justify-between shrink-0">
        <!-- Logo y Sección -->
        <div class="flex items-center gap-6 min-w-[280px] cursor-pointer hover:opacity-80 transition-all group" data-route="dashboard">
          <div class="flex items-center gap-4">
             <img src="./assets/logo.png" alt="Logo Panadería Matías" class="h-16 w-auto drop-shadow-md group-hover:scale-105 transition-transform">
             <div class="h-10 w-px bg-borde/60 mx-1"></div>
             <span class="text-2xl font-black text-caramelo uppercase tracking-tighter italic group-hover:text-cafe transition-colors">Venta</span>
          </div>
        </div>

        <!-- Buscador Central -->
        <div class="flex-1 max-w-2xl px-8">
           <div class="relative group">
             <span class="absolute left-5 top-1/2 -translate-y-1/2 text-xl text-cafe/30 group-focus-within:text-cafe transition-colors">🔍</span>
             <input id="header-search" type="text" 
                    class="w-full h-14 bg-papel border border-borde/60 rounded-2xl pl-14 pr-6 text-base font-medium outline-none focus:ring-4 focus:ring-cafe/5 focus:border-cafe/30 transition-all shadow-sm"
                    placeholder="Buscar producto por nombre o código...">
             <div id="header-search-results" class="search-results-dropdown hidden"></div>
           </div>
        </div>

        <!-- Acciones Rápidas -->
        <div class="flex items-center gap-3 min-w-[280px] justify-end">
           <button class="header-action-btn group" data-route="ventas" title="Historial">
             <span class="text-xl">🕒</span>
             <span class="text-[9px] font-black uppercase text-cafe/40 group-hover:text-cafe transition-colors">Historial</span>
           </button>
           <button class="header-action-btn group" data-route="caja" title="Configuración / Caja">
             <span class="text-xl">⚙️</span>
             <span class="text-[9px] font-black uppercase text-cafe/40 group-hover:text-cafe transition-colors">Turno</span>
           </button>
           <button id="btn-fullscreen" class="header-action-btn group" title="Pantalla Completa">
             <span class="text-xl">⛶</span>
             <span class="text-[9px] font-black uppercase text-cafe/40 group-hover:text-cafe transition-colors">Pantalla</span>
           </button>
           <button id="logout-button" class="header-action-btn group text-rojoaviso hover:bg-rojoaviso/5" title="Cerrar Sistema">
             <span class="text-xl">🚪</span>
             <span class="text-[9px] font-black uppercase opacity-40">Salir</span>
           </button>
        </div>
      </header>

      <!-- ÁREA DE CONTENIDO -->
      <main id="route-container" class="flex-1 overflow-hidden">
        ${config ? config.render() : '<p>Ruta no encontrada</p>'}
      </main>

      <!-- FOOTER DE ESTADO -->
      <footer class="h-10 bg-white border-t border-borde/30 px-10 flex items-center justify-between text-[10px] font-bold text-cafe/40 shrink-0">
        <div class="flex items-center gap-8 uppercase tracking-widest">
           <span>CAJA: <span class="text-cafe">CAJA 01</span></span>
           <span>APERTURA: <span class="text-cafe">${new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })} AM</span></span>
        </div>
        <div class="flex items-center gap-8 uppercase tracking-widest">
           <div class="flex items-center gap-2">
              <span class="text-cafe">CONEXIÓN</span>
              <span class="w-2 h-2 rounded-full bg-verdeok"></span>
           </div>
           <span>${new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</span>
           <span class="text-cafe">${new Date().toLocaleDateString('es-CL')}</span>
        </div>
      </footer>
    </div>
  `;
}

async function renderProtectedApp() {
  app.innerHTML = buildShell();

  // Escuchar búsqueda global
  document.querySelector('#header-search')?.addEventListener('input', (e) => {
    window.dispatchEvent(new CustomEvent('pos-search', { detail: e.target.value }));
  });

  document.querySelectorAll('[data-route]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const target = btn.dataset.route;
      if (currentRoute === target) return;
      currentRoute = target;
      await renderProtectedApp();
    });
  });

  document.querySelector('#btn-fullscreen')?.addEventListener('click', async () => {
    if (window.electronAPI && window.electronAPI.toggleFullScreen) {
      await window.electronAPI.toggleFullScreen();
    }
  });

  document.querySelector('#logout-button')?.addEventListener('click', () => {
    clearSession();
    currentRoute = 'dashboard';
    renderApp();
  });

  const config = routes[currentRoute];
  if (config) await config.hydrate();
}

async function checkTurnoAndRoute() {
  try {
    const { getTurnos } = await import('./services/shiftService.js');
    const { getSession } = await import('./state/sessionStore.js');
    const session = getSession();
    const userId = session?.usuario?.id;
    
    const sRes = await getTurnos({ estado: 'Abierto' });
    const miTurno = (sRes.data || []).find(t => t.id_usuario === userId);
    
    if (!miTurno) {
      currentRoute = 'caja';
    }
  } catch (e) {
    console.warn("Error al validar turno:", e);
  }
}

async function renderApp() {
  const { isAuthenticated } = await import('./state/sessionStore.js');
  const { renderLoginView, attachLoginEvents } = await import('./modules/auth/authView.js');

  if (!isAuthenticated()) {
    app.innerHTML = renderLoginView();
    attachLoginEvents({
      onLoggedIn: async () => {
        await checkTurnoAndRoute();
        await renderApp();
      }
    });
    return;
  }
  
  await checkTurnoAndRoute();
  await renderProtectedApp();
}

renderApp();
