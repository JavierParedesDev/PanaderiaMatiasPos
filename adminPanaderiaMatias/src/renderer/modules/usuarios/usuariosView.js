import { getUsuarios, crearUsuario, actualizarUsuario, eliminarUsuario } from '../../services/userService.js';
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
  async function loadUsers() {
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
                <th class="px-6 py-4 text-right">Acciones</th>
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
                  <td class="px-6 py-4 text-right space-x-2">
                    <button data-action="edit" data-id="${u.id}" data-user='${JSON.stringify(u).replace(/'/g, "&#39;")}' class="p-2 bg-azulaviso/10 hover:bg-azulaviso/20 rounded-lg text-azulaviso transition-colors" title="Editar">
                      <svg class="w-4 h-4 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                    </button>
                    <button data-action="delete" data-id="${u.id}" class="p-2 bg-rojoaviso/10 hover:bg-rojoaviso/20 rounded-lg text-rojoaviso transition-colors" title="Eliminar">
                      <svg class="w-4 h-4 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      document.querySelector('#add-user-btn')?.addEventListener('click', () => openUserModal());

      container.querySelectorAll('button[data-action="edit"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const userData = JSON.parse(e.currentTarget.dataset.user);
          openUserModal(userData);
        });
      });

      container.querySelectorAll('button[data-action="delete"]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = e.currentTarget.dataset.id;
          if (confirm('¿Está seguro de eliminar este usuario?')) {
            try {
              await eliminarUsuario(id);
              await loadUsers();
            } catch (err) {
              alert('Error al eliminar: ' + err.message);
            }
          }
        });
      });

    } catch (error) {
      container.innerHTML = `<div class="panel p-10 text-center text-rojoaviso font-bold bg-white italic">${error.message}</div>`;
    }
  }

  function openUserModal(user = null) {
    const isEdit = !!user;
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm';
    modal.innerHTML = `
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div class="p-6 border-b border-borde/30 flex justify-between items-center">
          <h3 class="text-xl font-bold text-[#2d221b]">${isEdit ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
          <button type="button" class="text-cafe/50 hover:text-cafe" onclick="this.closest('.fixed').remove()">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        <form id="user-form" class="p-6 space-y-4">
          <div>
            <label class="block text-xs font-bold text-cafe/60 uppercase mb-1">Nombre de Usuario</label>
            <input type="text" name="username" class="w-full p-3 rounded-xl border border-borde/50 focus:border-cafe focus:ring-1 focus:ring-cafe outline-none" value="${user?.username || ''}" required>
          </div>
          <div>
            <label class="block text-xs font-bold text-cafe/60 uppercase mb-1">Contraseña ${isEdit ? '(Dejar en blanco para no cambiar)' : ''}</label>
            <input type="password" name="password" class="w-full p-3 rounded-xl border border-borde/50 focus:border-cafe focus:ring-1 focus:ring-cafe outline-none" ${isEdit ? '' : 'required'}>
          </div>
          <div>
            <label class="block text-xs font-bold text-cafe/60 uppercase mb-1">Rol</label>
            <select name="id_rol" class="w-full p-3 rounded-xl border border-borde/50 focus:border-cafe focus:ring-1 focus:ring-cafe outline-none" required>
              <option value="1" ${user?.rol === 'Admin' ? 'selected' : ''}>Admin</option>
              <option value="2" ${user?.rol === 'Vendedor' ? 'selected' : ''}>Vendedor</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold text-cafe/60 uppercase mb-1">Sucursal</label>
            <select name="id_sucursal" class="w-full p-3 rounded-xl border border-borde/50 focus:border-cafe focus:ring-1 focus:ring-cafe outline-none" required>
              <option value="1" selected>Principal</option>
            </select>
          </div>
          <div class="flex items-center gap-2">
            <input type="checkbox" name="activo" id="user-activo" class="w-4 h-4 text-cafe focus:ring-cafe border-borde/50 rounded" ${!user || user.activo ? 'checked' : ''}>
            <label for="user-activo" class="text-sm font-bold text-[#2d221b]">Usuario Activo</label>
          </div>
          <div class="pt-4 flex justify-end gap-3">
            <button type="button" class="px-6 py-3 rounded-xl text-sm font-bold text-cafe/60 hover:bg-cafe/5 transition-colors" onclick="this.closest('.fixed').remove()">Cancelar</button>
            <button type="submit" class="px-6 py-3 rounded-xl text-sm font-bold bg-cafe text-white hover:bg-[#2d221b] transition-colors">Guardar</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('#user-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const datos = {
        username: formData.get('username'),
        id_rol: parseInt(formData.get('id_rol')),
        id_sucursal: parseInt(formData.get('id_sucursal')),
        activo: formData.get('activo') === 'on'
      };
      if (formData.get('password')) {
        datos.password = formData.get('password');
      }

      try {
        if (isEdit) {
          await actualizarUsuario(user.id, datos);
        } else {
          await crearUsuario(datos);
        }
        modal.remove();
        await loadUsers();
      } catch (err) {
        alert('Error al guardar: ' + err.message);
      }
    });
  }

  await loadUsers();

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
