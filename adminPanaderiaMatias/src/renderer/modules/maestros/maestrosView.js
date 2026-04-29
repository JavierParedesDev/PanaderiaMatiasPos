import { crearCategoria, crearProveedor, getCategorias, getProveedores, getSucursales, getMetodosPago } from '../../services/masterService.js';
import { escapeHtml } from '../../utils/formatters.js';

function renderMessage(id) {
  return `<div id="${id}" class="hidden rounded-xl border px-4 py-3 text-sm font-bold"></div>`;
}

function showMessage(id, tone, message) {
  const box = document.querySelector(`#${id}`);
  if (!box) return;

  box.textContent = message;
  box.className = 'rounded-xl border px-4 py-3 text-sm font-bold';
  if (tone === 'success') {
    box.classList.add('border-[#c5dfcb]', 'bg-[#eef8f0]', 'text-verdeok');
  } else {
    box.classList.add('border-[#efc1bb]', 'bg-[#fff4f2]', 'text-rojoaviso');
  }
}

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
        </div>
        <form id="form-categoria" class="mb-4 grid gap-2 sm:grid-cols-[1fr_auto]">
          <input name="nombre" class="field h-10 text-sm" placeholder="Nueva categoria" required>
          <button type="submit" class="btn-secondary h-10 px-4 py-2 text-xs">Agregar</button>
        </form>
        ${renderMessage('categoria-message')}
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
        </div>
        <form id="form-proveedor" class="mb-4 space-y-3">
          <div class="grid gap-3 sm:grid-cols-2">
            <input name="nombre_empresa" class="field h-10 text-sm" placeholder="Nombre proveedor" required>
            <input name="rut_proveedor" class="field h-10 text-sm" placeholder="RUT proveedor">
            <input name="contacto_nombre" class="field h-10 text-sm" placeholder="Contacto">
            <input name="telefono" class="field h-10 text-sm" placeholder="Telefono">
          </div>
          <button type="submit" class="btn-secondary h-10 px-4 py-2 text-xs">Agregar proveedor</button>
        </form>
        ${renderMessage('proveedor-message')}
        <div class="space-y-2">
          ${provRes.data.map(p => `
            <div class="flex items-center justify-between p-2 rounded-lg hover:bg-papel/20">
              <span class="text-sm font-bold text-cafe">${escapeHtml(p.nombre_empresa || '')}</span>
              <span class="text-[10px] text-cafe/30">RUT: ${escapeHtml(p.rut_proveedor || 'N/A')}</span>
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

        document.querySelector('#form-categoria')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const button = form.querySelector('button[type="submit"]');
            const nombre = new FormData(form).get('nombre')?.trim();

            if (!nombre) {
                showMessage('categoria-message', 'error', 'Ingresa un nombre de categoria.');
                return;
            }

            try {
                button.disabled = true;
                button.textContent = 'Guardando...';
                await crearCategoria({ nombre });
                showMessage('categoria-message', 'success', 'Categoria agregada.');
                await hydrateMaestrosView();
            } catch (error) {
                showMessage('categoria-message', 'error', error.message);
            } finally {
                button.disabled = false;
                button.textContent = 'Agregar';
            }
        });

        document.querySelector('#form-proveedor')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const button = form.querySelector('button[type="submit"]');
            const data = Object.fromEntries(new FormData(form).entries());
            const payload = {
                nombre_empresa: data.nombre_empresa?.trim(),
                rut_proveedor: data.rut_proveedor?.trim() || null,
                contacto_nombre: data.contacto_nombre?.trim() || null,
                telefono: data.telefono?.trim() || null
            };

            if (!payload.nombre_empresa) {
                showMessage('proveedor-message', 'error', 'Ingresa el nombre del proveedor.');
                return;
            }

            try {
                button.disabled = true;
                button.textContent = 'Guardando...';
                await crearProveedor(payload);
                showMessage('proveedor-message', 'success', 'Proveedor agregado.');
                await hydrateMaestrosView();
            } catch (error) {
                showMessage('proveedor-message', 'error', error.message);
            } finally {
                button.disabled = false;
                button.textContent = 'Agregar proveedor';
            }
        });
    } catch (error) {
        container.innerHTML = `<div class="col-span-2 panel p-8 text-center text-rojoaviso font-bold bg-white">${error.message}</div>`;
    }
}
