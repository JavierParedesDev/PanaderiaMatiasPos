import { renderLoginView, attachLoginEvents } from './modules/auth/authView.js';
import { renderDashboardSkeleton, hydrateDashboardView } from './modules/dashboard/dashboardView.js';
import { renderVendedorSkeleton, hydrateVendedorView } from './modules/vendedor/vendedorView.js';
import { renderProductosSkeleton, hydrateProductosView } from './modules/productos/productosView.js';
import { renderVentasSkeleton, hydrateVentasView } from './modules/ventas/ventasView.js';
import { renderCajaSkeleton, hydrateCajaView } from './modules/caja/cajaView.js';
import { renderKardexSkeleton, hydrateKardexView } from './modules/kardex/kardexView.js';
import { renderReportesSkeleton, hydrateReportesView } from './modules/reportes/reportesView.js';
import { renderMaestrosSkeleton, hydrateMaestrosView } from './modules/maestros/maestrosView.js';
import { renderUsuariosSkeleton, hydrateUsuariosView } from './modules/usuarios/usuariosView.js';
import { clearSession, getSession, isAuthenticated } from './state/sessionStore.js';
import { escapeHtml } from './utils/formatters.js';

window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());

const app = document.querySelector('#app');

const SECTIONS = [
  { key: 'nav-main', label: 'GESTIÓN', separator: true, roles: ['Admin', 'Vendedor'] },
  { key: 'dashboard', label: 'Resumen', icon: '🏠', roles: ['Admin', 'Vendedor'] },
  { key: 'productos', label: 'Productos', icon: '🥖', roles: ['Admin', 'Vendedor'] },
  { key: 'ventas', label: 'Historial Ventas', icon: '🧾', roles: ['Admin', 'Vendedor'] },
  { key: 'nav-ops', label: 'OPERACIONES', separator: true, roles: ['Admin', 'Vendedor'] },
  { key: 'caja', label: 'Caja y Turnos', icon: '💰', roles: ['Admin', 'Vendedor'] },
  { key: 'kardex', label: 'Inventario/Kardex', icon: '📦', roles: ['Admin'] },
  { key: 'nav-bi', label: 'ANÁLISIS', separator: true, roles: ['Admin'] },
  { key: 'reportes', label: 'Reportes', icon: '📊', roles: ['Admin'] },
  { key: 'nav-sys', label: 'SISTEMA', separator: true, roles: ['Admin'] },
  { key: 'maestros', label: 'Tablas Maestras', icon: '📂', roles: ['Admin'] },
  { key: 'usuarios', label: 'Configuración', icon: '⚙️', roles: ['Admin'] },
];

const routes = {
  dashboard: {
    Admin: { render: renderDashboardSkeleton, hydrate: hydrateDashboardView },
    Vendedor: { render: renderVendedorSkeleton, hydrate: hydrateVendedorView }
  },
  productos: { render: renderProductosSkeleton, hydrate: hydrateProductosView },
  ventas: { render: renderVentasSkeleton, hydrate: hydrateVentasView },
  caja: { render: renderCajaSkeleton, hydrate: hydrateCajaView },
  kardex: { render: renderKardexSkeleton, hydrate: hydrateKardexView },
  reportes: { render: renderReportesSkeleton, hydrate: hydrateReportesView },
  maestros: { render: renderMaestrosSkeleton, hydrate: hydrateMaestrosView },
  usuarios: { render: renderUsuariosSkeleton, hydrate: hydrateUsuariosView },
};

let currentRoute = 'dashboard';

function getRouteConfig(routeKey) {
  const config = routes[routeKey];
  if (!config) return null;

  // Si la ruta tiene versiones por rol
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
    .filter(s => s.roles.includes(userRole))
    .map(s => {
      if (s.separator) {
        return `<p class="px-4 pt-4 pb-1 text-[9px] font-black text-cafe/25 uppercase tracking-[0.25em]">${s.label}</p>`;
      }
      const active = currentRoute === s.key;
      return `
        <button class="nav-item ${active ? 'nav-item-active' : ''} flex items-center gap-3 w-full text-left" data-route="${s.key}">
          <span class="text-base">${s.icon}</span>
          <span class="font-semibold text-sm">${s.label}</span>
          ${active ? '<span class="ml-auto w-1.5 h-1.5 rounded-full bg-cafe animate-pulse"></span>' : ''}
        </button>`;
    }).join('');
}

function buildShell() {
  const session = getSession();
  const config = getRouteConfig(currentRoute);

  return `
    <div class="grid min-h-screen grid-cols-[260px_1fr]">
      <aside class="flex flex-col border-r border-borde bg-[#fdfaf5] shadow-inner">
        <div class="p-6 border-b border-borde/30 text-center">
          <img src="./assets/logo.png" alt="Logo Panadería Matias" class="w-16 mx-auto mb-3 hover:scale-105 transition-transform duration-300">
          <h1 class="text-lg font-black tracking-tighter text-[#2d221b]">Matías Admin</h1>
          <p class="text-[9px] font-bold text-cafe/30 uppercase tracking-[0.3em] mt-0.5">Panel de Control</p>
        </div>

        <nav class="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
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
            <button id="logout-button" class="mt-3 w-full h-8 flex items-center justify-center text-[10px] font-bold uppercase tracking-widest bg-rojoaviso/10 text-rojoaviso rounded-lg hover:bg-rojoaviso hover:text-white transition-all">Cerrar sesión &nbsp; 🚪</button>
          </div>
        </div>
      </aside>

      <main class="h-screen overflow-auto bg-crema/20 p-8 lg:p-12">
        <div class="max-w-7xl mx-auto">
          <div id="route-container">
            ${config ? config.render() : '<p>Ruta no encontrada</p>'}
          </div>
        </div>
      </main>
    </div>
  `;
}

async function renderProtectedApp() {
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
