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
let scannerBuffer = '';
let scannerTimer = null;
let suppressHeaderSearch = false;

window.addEventListener('session-expired', () => {
  currentRoute = 'dashboard';
  renderApp();
});

const routes = {
  dashboard: { render: renderPosSkeleton, hydrate: hydratePosView },
  productos: { render: renderProductosSkeleton, hydrate: hydrateProductosView },
  ventas: { render: renderVentasSkeleton, hydrate: hydrateVentasView },
  caja: { render: renderCajaSkeleton, hydrate: hydrateCajaView },
};

function buildShell() {
  const session = getSession();
  const config = routes[currentRoute];
  const showHeaderSearch = currentRoute === 'dashboard';

  return `
    <div class="flex flex-col h-screen bg-crema/20 overflow-hidden font-sans">
      <!-- HEADER PRINCIPAL (BASADO EN REFERENCIA) -->
      <header class="h-16 md:h-20 bg-white border-b border-borde/40 px-4 md:px-10 flex items-center justify-between shrink-0">
        <!-- Logo y Sección -->
        <div class="flex items-center gap-6 min-w-[200px] cursor-pointer hover:opacity-80 transition-all group" data-route="dashboard">
          <div class="flex items-center gap-4">
             <img src="./assets/logo.png" alt="Logo Panadería Matías" class="h-10 md:h-14 w-auto drop-shadow-md group-hover:scale-105 transition-transform">
             <div class="h-8 w-px bg-borde/60 mx-1 hidden md:block"></div>
             <span class="text-lg md:text-2xl font-black text-caramelo uppercase tracking-tighter italic group-hover:text-cafe transition-colors">Venta</span>
          </div>
        </div>

        <!-- Buscador Central -->
        <div class="flex-1 max-w-4xl px-4">
           ${showHeaderSearch ? `
           <div class="relative group">
             <span class="absolute left-5 top-1/2 -translate-y-1/2 text-lg text-cafe/30 group-focus-within:text-cafe transition-colors">🔍</span>
             <input id="header-search" type="text" 
                    class="w-full h-10 md:h-12 bg-papel border border-borde/60 rounded-2xl pl-14 pr-6 text-sm md:text-base font-medium outline-none focus:ring-4 focus:ring-cafe/5 focus:border-cafe/30 transition-all shadow-sm"
                    placeholder="Buscar producto...">
             <div id="header-search-results" class="search-results-dropdown hidden"></div>
           </div>
           ` : ''}
        </div>

        <!-- Acciones Rápidas -->
        <div class="flex items-center gap-2 md:gap-3 min-w-[200px] justify-end">
           <button class="header-action-btn group !w-10 !h-10 md:!w-16 md:!h-16" data-route="ventas" title="Historial">
             <span class="text-base md:text-xl">🕒</span>
             <span class="text-[8px] md:text-[9px] font-black uppercase text-cafe/40 group-hover:text-cafe transition-colors hidden sm:block">Historial</span>
           </button>
           <button class="header-action-btn group !w-10 !h-10 md:!w-16 md:!h-16" data-route="caja" title="Configuración / Caja">
             <span class="text-base md:text-xl">⚙️</span>
             <span class="text-[8px] md:text-[9px] font-black uppercase text-cafe/40 group-hover:text-cafe transition-colors hidden sm:block">Turno</span>
           </button>
           <button id="btn-fullscreen" class="header-action-btn group !w-10 !h-10 md:!w-16 md:!h-16" title="Pantalla Completa">
             <span class="text-base md:text-xl">⛶</span>
             <span class="text-[8px] md:text-[9px] font-black uppercase text-cafe/40 group-hover:text-cafe transition-colors hidden sm:block">Pantalla</span>
           </button>
           <button id="logout-button" class="header-action-btn group !w-10 !h-10 md:!w-16 md:!h-16 text-rojoaviso hover:bg-rojoaviso/5" title="Cerrar Sistema">
             <span class="text-base md:text-xl">🚪</span>
             <span class="text-[8px] md:text-[9px] font-black uppercase opacity-40 hidden sm:block">Salir</span>
           </button>
        </div>
      </header>

      <!-- ÁREA DE CONTENIDO -->
      <main id="route-container" class="flex-1 overflow-hidden">
        ${config ? config.render() : '<p>Ruta no encontrada</p>'}
      </main>

      <!-- FOOTER DE ESTADO -->
      <footer class="h-8 bg-white border-t border-borde/30 px-10 flex items-center justify-between text-[10px] font-bold text-cafe/40 shrink-0">
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
  if (!isAuthenticated()) {
    renderApp();
    return;
  }
  app.innerHTML = buildShell();

  // Escuchar búsqueda global
  const headerSearch = document.querySelector('#header-search');
  headerSearch?.addEventListener('input', (e) => {
    if (suppressHeaderSearch) {
      suppressHeaderSearch = false;
      return;
    }
    window.dispatchEvent(new CustomEvent('pos-search', { detail: e.target.value }));
  });

  // Captura de escáner (buffer de teclado)
  if (window._scannerListener) {
    document.removeEventListener('keydown', window._scannerListener);
  }
  window._scannerListener = (e) => {
    if (currentRoute !== 'dashboard') return;
    const target = e.target;
    const isEditable = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
    
    // Si estamos en cualquier campo de texto que NO sea el buscador, ignoramos completamente
    if (isEditable && target.id !== 'header-search') return;

    if (e.key === 'Enter') {
      if (scannerTimer) clearTimeout(scannerTimer);
      
      // Caso 1: Se detectó un escaneo global (fuera del input)
      if (scannerBuffer.length > 1) {
        if (headerSearch) {
          suppressHeaderSearch = true;
          headerSearch.value = scannerBuffer;
        }
        window.dispatchEvent(new CustomEvent('pos-search', { detail: scannerBuffer }));
        scannerBuffer = '';
      } 
      // Caso 2: El scanner escribió directamente en el buscador o el usuario pulsó Enter
      else if (target && target.id === 'header-search' && target.value.length > 0) {
        window.dispatchEvent(new CustomEvent('pos-search', { detail: target.value }));
      }
      return;
    }

    // Solo buffereamos globalmente si NO estamos en un campo de texto
    // Esto evita que al escribir manual "rápido" el buffer compita y borre el texto
    if (!isEditable) {
      if (scannerTimer) clearTimeout(scannerTimer);

      if (e.key && e.key.length === 1) {
        scannerBuffer += e.key;
        scannerTimer = setTimeout(() => {
          if (scannerBuffer.length > 1) {
            if (headerSearch) {
              suppressHeaderSearch = true;
              headerSearch.value = scannerBuffer;
            }
            window.dispatchEvent(new CustomEvent('pos-search', { detail: scannerBuffer }));
          }
          scannerBuffer = '';
        }, 150); // Aumentamos levemente el margen para scanners más lentos
      }
    }
  };
  document.addEventListener('keydown', window._scannerListener);

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
