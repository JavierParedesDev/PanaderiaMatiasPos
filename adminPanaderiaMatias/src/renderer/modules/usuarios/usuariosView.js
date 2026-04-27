import { getUsuarios } from '../../services/userService.js';
import { checkUpdates } from '../../services/updaterService.js';
import { escapeHtml } from '../../utils/formatters.js';

export function renderUsuariosSkeleton() {
  return `
    <div class="space-y-8 pb-10">
      <header class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-black text-[#2d221b] tracking-tighter">Configuración y Sistema</h1>
          <p class="text-sm font-medium text-[#705f52] mt-1">Gestión de personal y actualizaciones del software.</p>
        </div>
      </header>

      <div class="grid gap-8 xl:grid-cols-[1fr_350px]">
        <div id="usuarios-content" class="space-y-6">
          <div class="panel h-96 animate-pulse bg-white/50"></div>
        </div>

        <aside class="space-y-6">
          <!-- Card de Actualizaciones -->
          <div class="panel p-6 bg-white border-t-4 border-t-azulaviso shadow-sm">
            <h3 class="text-sm font-black text-cafe/40 uppercase tracking-widest mb-4">Sistema</h3>
            <div id="updater-status">
              <div class="flex items-center gap-3 mb-4">
                <div class="w-10 h-10 rounded-xl bg-crema flex items-center justify-center text-xl">🚀</div>
                <div>
                  <p class="text-xs font-black text-[#2d221b]">Versión 1.0.0</p>
                  <p class="text-[10px] text-verdeok font-bold uppercase">Software al día</p>
                </div>
              </div>
              <button id="btn-check-updates" class="w-full py-3 bg-papel/50 hover:bg-papel rounded-xl text-[10px] font-black uppercase tracking-widest text-cafe transition-all border border-borde/30">
                Buscar Actualizaciones
              </button>
            </div>
          </div>

          <div class="panel p-6 bg-white shadow-sm">
             <h3 class="text-sm font-black text-cafe/40 uppercase tracking-widest mb-4">Soporte Tecnológico</h3>
             <p class="text-xs text-cafe/60 leading-relaxed">Para soporte técnico o errores críticos, contacte al desarrollador mediante el repositorio oficial.</p>
             <div class="mt-4 p-3 bg-papel/20 rounded-lg text-[10px] font-mono text-cafe/40 break-all border border-borde/20">
               github.com/JavierParedesDev
             </div>
          </div>
        </aside>
      </div>
    </div>
  `;
}

export async function hydrateUsuariosView() {
  const container = document.querySelector('#usuarios-content');
  if (!container) return;

  // Cargar lista de usuarios
  try {
    const response = await getUsuarios();
    const data = response.data || [];

    container.innerHTML = `
      <div class="panel bg-white shadow-sm overflow-hidden min-h-[400px]">
        <div class="p-6 border-b border-borde/30 flex items-center justify-between">
           <h2 class="text-xl font-bold text-[#2d221b]">Personal de Panadería</h2>
           <button id="add-user-btn" class="px-4 py-2 bg-cafe text-white rounded-xl text-[10px] font-bold shadow-sm hover:scale-105 transition-all">NUEVO USUARIO</button>
        </div>
        <table class="w-full text-left">
          <thead class="bg-crema/20 text-[10px] font-black uppercase tracking-widest text-cafe/60">
            <tr>
              <th class="px-6 py-4">Usuario</th>
              <th class="px-6 py-4">Rol</th>
              <th class="px-6 py-4">Sucursal</th>
              <th class="px-6 py-4 text-center">Estado</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-borde/20 text-sm">
            ${data.map(u => `
              <tr class="hover:bg-papel/10">
                <td class="px-6 py-4 flex items-center gap-3">
                  <div class="w-8 h-8 rounded-lg bg-cafe/10 text-cafe flex items-center justify-center font-black text-xs">
                    ${u.username.charAt(0).toUpperCase()}
                  </div>
                  <span class="font-black text-[#2d221b]">${escapeHtml(u.username)}</span>
                </td>
                <td class="px-6 py-4">
                  <span class="px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter ${u.rol === 'Admin' ? 'bg-rojoaviso/10 text-rojoaviso' : 'bg-azulaviso/10 text-azulaviso'}">
                    ${u.rol}
                  </span>
                </td>
                <td class="px-6 py-4 font-bold text-cafe/60">${escapeHtml(u.sucursal)}</td>
                <td class="px-6 py-4 text-center">
                  <span class="badge ${u.activo ? 'bg-verdeok/10 text-verdeok' : 'bg-cafe/10 text-cafe/40'}">
                    ${u.activo ? 'ACTIVO' : 'INACTIVO'}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (error) {
    container.innerHTML = `<div class="panel p-10 text-center text-rojoaviso font-bold bg-white italic">${error.message}</div>`;
  }

  // Lógica de actualizaciones
  const btnCheck = document.querySelector('#btn-check-updates');
  const statusEl = document.querySelector('#updater-status');

  btnCheck?.addEventListener('click', async () => {
    btnCheck.disabled = true;
    btnCheck.innerText = 'Buscando...';

    try {
      const update = await checkUpdates();
      if (update.hasUpdate) {
        statusEl.innerHTML = `
          <div class="p-4 bg-azulaviso/10 border border-azulaviso/20 rounded-2xl mb-4">
            <p class="text-xs font-black text-azulaviso">¡Nueva versión disponible!</p>
            <p class="text-[10px] text-cafe/60 font-bold mt-1">Versión detectada: v${update.latest}</p>
            <a href="${update.url}" target="_blank" class="block mt-3 py-2 bg-azulaviso text-white text-center rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md">Descargar Actualización</a>
          </div>
        `;
      } else {
        alert('El sistema ya cuenta con la última versión disponible (v1.0.0).');
        btnCheck.disabled = false;
        btnCheck.innerText = 'Buscar Actualizaciones';
      }
    } catch (err) {
      alert('Error: ' + err.message);
      btnCheck.disabled = false;
      btnCheck.innerText = 'Buscar Actualizaciones';
    }
  });
}
