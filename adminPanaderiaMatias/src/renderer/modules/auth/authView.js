import { apiClient } from '../../services/apiClient.js';
import { login } from '../../services/authService.js';
import { saveSession } from '../../state/sessionStore.js';
import { escapeHtml } from '../../utils/formatters.js';

export function renderLoginView() {
  return `
    <div class="flex min-h-screen items-center justify-center bg-crema p-4">
      <div class="w-full max-w-sm overflow-hidden panel shadow-2xl">
        <section class="bg-papel p-8 lg:p-10">
          <div class="mb-10 text-center">
            <img src="./assets/logo.png" alt="Logo Panaderia Matias" class="w-32 mx-auto mb-6">
            <h1 class="text-3xl font-bold text-cafe">Panadería Matias</h1>
            <p class="mt-2 text-sm text-[#6a584b]">Admin - Gestión Interna</p>
          </div>
          <form id="login-form" class="space-y-6">
            <div>
              <label class="mb-2 block text-xs font-bold uppercase tracking-widest text-cafe/60">Usuario</label>
              <input id="username" class="field h-12" autocomplete="username" placeholder="Tu usuario">
            </div>
            <div>
              <label class="mb-2 block text-xs font-bold uppercase tracking-widest text-cafe/60">Contraseña</label>
              <input id="password" type="password" class="field h-12" autocomplete="current-password" placeholder="••••••••">
            </div>
            <div id="login-error" class="hidden rounded-xl border border-rojoaviso/30 bg-rojoaviso/5 px-4 py-3 text-sm text-center text-rojoaviso"></div>
            <button id="login-submit" type="submit" class="btn-primary w-full h-12 font-bold text-lg shadow-lg">Entrar al Admin</button>
          </form>
          <div class="mt-8 text-center">
            <p class="text-[10px] uppercase font-bold tracking-[0.2em] text-cafe/20">&copy; ${new Date().getFullYear()} Panadería Matias. Privado.</p>
          </div>
        </section>
      </div>
    </div>
  `;
}

export function attachLoginEvents({ onLoggedIn = () => {} } = {}) {
  const form = document.querySelector('#login-form');
  const submitButton = document.querySelector('#login-submit');
  const errorBox = document.querySelector('#login-error');

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();

    // Ahora usamos el DEFAULT_API_URL directamente
    const baseUrl = apiClient.defaultBaseUrl;
    const username = document.querySelector('#username')?.value?.trim();
    const password = document.querySelector('#password')?.value || '';

    errorBox?.classList.add('hidden');
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.innerHTML = `
        <span class="flex items-center justify-center gap-2">
          <span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
          Conectando...
        </span>
      `;
    }

    try {
      if (!username || !password) {
        throw new Error('Por favor, ingresa usuario y contraseña.');
      }

      const response = await login({ baseUrl, username, password });
      saveSession({
        token: response.token,
        usuario: response.usuario,
        baseUrl: apiClient.normalizeBaseUrl(baseUrl)
      });
      onLoggedIn();
    } catch (error) {
      if (errorBox) {
        errorBox.textContent = error.message;
        errorBox.classList.remove('hidden');
      }
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Entrar al Admin';
      }
    }
  });
}
