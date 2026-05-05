import { renderLoginView, attachLoginEvents } from './modules/auth/authView.js';
import { renderDashboardSkeleton, hydrateDashboardView } from './modules/dashboard/dashboardView.js';
import { renderProductosSkeleton, hydrateProductosView } from './modules/productos/productosView.js';
import { renderBalanzaSkeleton, hydrateBalanzaView } from './modules/balanza/balanzaView.js';
import { renderVentasSkeleton, hydrateVentasView } from './modules/ventas/ventasView.js';
import { renderCajaSkeleton, hydrateCajaView } from './modules/caja/cajaView.js';
import { renderInventarioSkeleton, hydrateInventarioView } from './modules/inventario/inventarioView.js';
import { renderKardexSkeleton, hydrateKardexView } from './modules/kardex/kardexView.js';
import { renderReportesSkeleton, hydrateReportesView } from './modules/reportes/reportesView.js';
import { renderMaestrosSkeleton, hydrateMaestrosView } from './modules/maestros/maestrosView.js';
import { renderUsuariosSkeleton, hydrateUsuariosView } from './modules/usuarios/usuariosView.js';
import { renderConsumoSkeleton, hydrateConsumoView } from './modules/consumo/consumoView.js';
import { clearSession, getSession, isAuthenticated } from './state/sessionStore.js';
import { escapeHtml } from './utils/formatters.js';

window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());

const app = document.querySelector('#app');

const ICONS = {
  dashboard: `
    <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 10.5 12 3l9 7.5"></path>
      <path d="M5 9.5V21h14V9.5"></path>
      <path d="M9.5 21v-6h5v6"></path>
    </svg>`,
  productos: `
    <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 7.5 12 4l8 3.5-8 3.5L4 7.5Z"></path>
      <path d="M4 7.5V16l8 4 8-4V7.5"></path>
      <path d="M12 11v9"></path>
    </svg>`,
  balanza: `
    <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
      <path d="M6 20h12"></path>
      <path d="M8 20 5 9h14l-3 11"></path>
      <path d="M9 9a3 3 0 0 1 6 0"></path>
      <path d="M12 13v3"></path>
      <path d="M10.5 14.5h3"></path>
    </svg>`,
  ventas: `
    <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
      <path d="M5 5h14"></path>
      <path d="M5 12h14"></path>
      <path d="M5 19h14"></path>
      <path d="M17 3v18"></path>
    </svg>`,
  caja: `
    <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="6" width="18" height="12" rx="2"></rect>
      <path d="M3 10h18"></path>
      <path d="M8 15h2"></path>
    </svg>`,
  inventario: `
    <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 8v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8"></path>
      <path d="M1 8h22"></path>
      <path d="M7 8V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3"></path>
    </svg>`,
  kardex: `
    <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8 6h13"></path>
      <path d="M8 12h13"></path>
      <path d="M8 18h13"></path>
      <path d="M3 6h.01"></path>
      <path d="M3 12h.01"></path>
      <path d="M3 18h.01"></path>
    </svg>`,
  reportes: `
    <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 20V10"></path>
      <path d="M10 20V4"></path>
      <path d="M16 20v-7"></path>
      <path d="M22 20v-3"></path>
    </svg>`,
  maestros: `
    <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 5h16"></path>
      <path d="M4 12h16"></path>
      <path d="M4 19h16"></path>
      <path d="M8 3v4"></path>
      <path d="M16 10v4"></path>
      <path d="M12 17v4"></path>
    </svg>`,
  usuarios: `
    <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"></path>
      <circle cx="9.5" cy="7" r="3.5"></circle>
      <path d="M20 8v6"></path>
      <path d="M17 11h6"></path>
    </svg>`
};

const SECTIONS = [
  { key: 'nav-main', label: 'GESTION', separator: true, roles: ['Admin', 'Vendedor'] },
  { key: 'dashboard', label: 'Resumen', icon: 'dashboard', roles: ['Admin', 'Vendedor'] },
  { key: 'productos', label: 'Productos', icon: 'productos', roles: ['Admin', 'Vendedor'] },
  { key: 'balanza', label: 'Balanza', icon: 'balanza', roles: ['Admin'] },
  { key: 'ventas', label: 'Historial Ventas', icon: 'ventas', roles: ['Admin', 'Vendedor'] },
  { key: 'nav-ops', label: 'OPERACIONES', separator: true, roles: ['Admin', 'Vendedor'] },
  { key: 'caja', label: 'Caja y Turnos', icon: 'caja', roles: ['Admin', 'Vendedor'] },
  { key: 'consumo', label: 'Consumo Trabajadores', icon: 'usuarios', roles: ['Admin'] },
  { key: 'inventario', label: 'Inventario', icon: 'inventario', roles: ['Admin'] },
  { key: 'kardex', label: 'Kardex', icon: 'kardex', roles: ['Admin'] },
  { key: 'nav-bi', label: 'ANALISIS', separator: true, roles: ['Admin'] },
  { key: 'reportes', label: 'Reportes', icon: 'reportes', roles: ['Admin'] },
  { key: 'nav-sys', label: 'SISTEMA', separator: true, roles: ['Admin'] },
  { key: 'maestros', label: 'Tablas Maestras', icon: 'maestros', roles: ['Admin'] },
  { key: 'usuarios', label: 'Configuracion', icon: 'usuarios', roles: ['Admin'] },
];

const routes = {
  dashboard: {
    Admin: { render: renderDashboardSkeleton, hydrate: hydrateDashboardView },
    Vendedor: { render: renderDashboardSkeleton, hydrate: hydrateDashboardView }
  },
  productos: { render: renderProductosSkeleton, hydrate: hydrateProductosView },
  balanza: { render: renderBalanzaSkeleton, hydrate: hydrateBalanzaView },
  ventas: { render: renderVentasSkeleton, hydrate: hydrateVentasView },
  caja: { render: renderCajaSkeleton, hydrate: hydrateCajaView },
  consumo: { render: renderConsumoSkeleton, hydrate: hydrateConsumoView },
  inventario: { render: renderInventarioSkeleton, hydrate: hydrateInventarioView },
  kardex: { render: renderKardexSkeleton, hydrate: hydrateKardexView },
  reportes: { render: renderReportesSkeleton, hydrate: hydrateReportesView },
  maestros: { render: renderMaestrosSkeleton, hydrate: hydrateMaestrosView },
  usuarios: { render: renderUsuariosSkeleton, hydrate: hydrateUsuariosView },
};

let currentRoute = 'dashboard';

window.addEventListener('session-expired', () => {
  currentRoute = 'dashboard';
  renderApp();
});

function getRouteConfig(routeKey) {
  const config = routes[routeKey];
  if (!config) return null;

  if (config.Admin || config.Vendedor) {
    const role = getSession()?.usuario?.rol || 'Vendedor';
    return config[role] || config.Vendedor;
  }

  return config;
}

function buildNav() {
  const session = getSession();
  const userRole = session?.usuario?.rol || 'Vendedor';

  return SECTIONS
    .filter((section) => section.roles.includes(userRole))
    .map((section) => {
      if (section.separator) {
        return `<p class="px-4 pt-4 pb-1 text-[9px] font-black text-cafe/25 uppercase tracking-[0.25em]">${section.label}</p>`;
      }

      const active = currentRoute === section.key;
      return `
        <button class="nav-item ${active ? 'nav-item-active' : ''} flex items-center gap-3 w-full text-left" data-route="${section.key}">
          <span class="inline-flex h-8 w-8 items-center justify-center rounded-xl ${active ? 'bg-cafe text-white shadow-sm' : 'bg-white/75 text-cafe/70'}">
            ${ICONS[section.icon] || ''}
          </span>
          <span class="font-semibold text-sm">${section.label}</span>
          ${active ? '<span class="ml-auto w-1.5 h-1.5 rounded-full bg-cafe animate-pulse"></span>' : ''}
        </button>`;
    })
    .join('');
}

function buildShell() {
  const session = getSession();
  const config = getRouteConfig(currentRoute);

  return `
    <div class="grid h-screen overflow-hidden grid-cols-[260px_1fr]">
      <aside class="flex h-screen min-h-0 flex-col overflow-hidden border-r border-borde bg-[#fdfaf5] shadow-inner">
        <div class="p-6 border-b border-borde/30 text-center">
          <img src="./assets/logo.png" alt="Logo Panaderia Matias" class="w-16 mx-auto mb-3 hover:scale-105 transition-transform duration-300">
          <h1 class="text-lg font-black tracking-tighter text-[#2d221b]">Matias Admin</h1>
          <p class="text-[9px] font-bold text-cafe/30 uppercase tracking-[0.3em] mt-0.5">Panel de Control</p>
        </div>

        <nav class="min-h-0 flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          ${buildNav()}
        </nav>

        <div class="p-4 border-t border-borde/40 bg-crema/20">
          <div class="panel p-3 bg-white/80 backdrop-blur-sm shadow-sm border-white">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl bg-cafe text-white flex items-center justify-center font-bold text-sm shadow-md">
                ${(session?.usuario?.username || 'U').charAt(0).toUpperCase()}
              </div>
              <div class="overflow-hidden">
                <p class="text-sm font-black text-[#2d221b] truncate">${escapeHtml(session?.usuario?.username || 'Usuario')}</p>
                <p class="text-[10px] font-bold text-verdeok uppercase tracking-tighter">${escapeHtml(session?.usuario?.rol || 'Personal')}</p>
              </div>
            </div>
            <button id="logout-button" class="mt-3 w-full h-8 flex items-center justify-center text-[10px] font-bold uppercase tracking-widest bg-rojoaviso/10 text-rojoaviso rounded-lg hover:bg-rojoaviso hover:text-white transition-all">Cerrar sesion</button>
          </div>
        </div>
      </aside>

      <main class="h-screen overflow-hidden bg-crema/20">
        <div class="h-full overflow-y-auto p-8 lg:p-12">
          <div class="max-w-7xl mx-auto">
          <div id="route-container">
            ${config ? config.render() : '<p>Ruta no encontrada</p>'}
          </div>
          </div>
        </div>
      </main>
    </div>
  `;
}

async function renderProtectedApp() {
  if (!isAuthenticated()) {
    renderApp();
    return;
  }
  app.innerHTML = buildShell();

  document.querySelectorAll('[data-route]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const target = btn.dataset.route;
      if (currentRoute === target) return;
      currentRoute = target;
      await renderProtectedApp();
    });
  });

  document.querySelector('#logout-button')?.addEventListener('click', () => {
    clearSession();
    currentRoute = 'dashboard';
    renderApp();
  });

  const config = getRouteConfig(currentRoute);
  if (config) await config.hydrate();
}

function renderApp() {
  if (!isAuthenticated()) {
    app.innerHTML = renderLoginView();
    attachLoginEvents({
      onLoggedIn: () => {
        currentRoute = 'dashboard';
        renderApp();
      }
    });
    return;
  }

  renderProtectedApp();
}

renderApp();
