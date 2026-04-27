import { getCategorias, getProveedores, getSucursales, getMetodosPago } from '../../services/masterService.js';
import { escapeHtml } from '../../utils/formatters.js';

export function renderMaestrosSkeleton() {
    return `
    <div class="space-y-8 pb-10">
      <header>
        <h1 class="text-3xl font-black text-[#2d221b] tracking-tighter">Tablas Maestras</h1>
        <p class="text-sm font-medium text-[#705f52] mt-1">Gestión central de entidades del negocio.</p>
      </header>

      <div id="maestros-content" class="grid gap-6 md:grid-cols-2">
        <div class="panel h-64 animate-pulse bg-white/50"></div>
        <div class="panel h-64 animate-pulse bg-white/50"></div>
        <div class="panel h-64 animate-pulse bg-white/50"></div>
        <div class="panel h-64 animate-pulse bg-white/50"></div>
      </div>
    </div>
  `;
}

export async function hydrateMaestrosView() {
    const container = document.querySelector('#maestros-content');
    if (!container) return;

    try {
        const [catRes, provRes, sucRes, pagRes] = await Promise.all([
            getCategorias(),
            getProveedores(),
            getSucursales(),
            getMetodosPago()
        ]);

        container.innerHTML = `
      <!-- Categorías -->
      <section class="panel bg-white p-6 shadow-sm">
        <div class="flex items-center justify-between mb-4 border-b border-borde/20 pb-3">
          <h2 class="text-lg font-black text-[#2d221b]">Categorías</h2>
          <button class="text-[10px] font-bold text-azulaviso">+ NUEVA</button>
        </div>
        <div class="space-y-2">
          ${catRes.data.map(c => `
            <div class="flex items-center justify-between p-2 rounded-lg hover:bg-papel/20">
              <span class="text-sm font-bold text-cafe">${escapeHtml(c.nombre)}</span>
              <span class="text-[10px] text-cafe/30">ID: ${c.id}</span>
            </div>
          `).join('')}
        </div>
      </section>

      <!-- Proveedores -->
      <section class="panel bg-white p-6 shadow-sm">
        <div class="flex items-center justify-between mb-4 border-b border-borde/20 pb-3">
          <h2 class="text-lg font-black text-[#2d221b]">Proveedores</h2>
          <button class="text-[10px] font-bold text-azulaviso">+ NUEVA</button>
        </div>
        <div class="space-y-2">
          ${provRes.data.map(p => `
            <div class="flex items-center justify-between p-2 rounded-lg hover:bg-papel/20">
              <span class="text-sm font-bold text-cafe">${escapeHtml(p.nombre)}</span>
              <span class="text-[10px] text-cafe/30">RUT: ${p.rut || 'N/A'}</span>
            </div>
          `).join('')}
        </div>
      </section>

      <!-- Sucursales -->
      <section class="panel bg-white p-6 shadow-sm">
        <div class="flex items-center justify-between mb-4 border-b border-borde/20 pb-3">
          <h2 class="text-lg font-black text-[#2d221b]">Sucursales</h2>
        </div>
        <div class="space-y-2">
          ${sucRes.data.map(s => `
            <div class="flex items-center justify-between p-2 rounded-lg hover:bg-papel/20">
              <span class="text-sm font-bold text-cafe">${escapeHtml(s.nombre)}</span>
              <span class="text-[10px] text-verdeok">OPERATIVA</span>
            </div>
          `).join('')}
        </div>
      </section>

      <!-- Métodos de Pago -->
      <section class="panel bg-white p-6 shadow-sm">
        <div class="flex items-center justify-between mb-4 border-b border-borde/20 pb-3">
          <h2 class="text-lg font-black text-[#2d221b]">Métodos de Pago</h2>
        </div>
        <div class="space-y-2">
          ${pagRes.data.map(m => `
            <div class="flex items-center justify-between p-2 rounded-lg hover:bg-papel/20">
              <span class="text-sm font-bold text-cafe">${escapeHtml(m.nombre)}</span>
              <div class="w-2 h-2 rounded-full bg-verdeok"></div>
            </div>
          `).join('')}
        </div>
      </section>
    `;
    } catch (error) {
        container.innerHTML = `<div class="col-span-2 panel p-8 text-center text-rojoaviso font-bold bg-white">${error.message}</div>`;
    }
}
