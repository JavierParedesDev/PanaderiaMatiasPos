/**
 * Unified notification system for Matías POS.
 * Replaces standard browser alert() with branded industrial toasts.
 */

export function showNotification(message, type = 'error') {
    let container = document.querySelector('#notification-container');

    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `notification-toast ${type}`;

    const iconMap = {
        error: '⚠️',
        success: '✅',
        warning: '⚠️',
        info: '💡'
    };

    const titleMap = {
        error: 'Aviso del Sistema',
        success: 'Notificación',
        warning: 'Atención',
        info: 'Notificación'
    };

    toast.innerHTML = `
    <div class="text-3xl shrink-0">${iconMap[type] || '🔔'}</div>
    <div class="flex-1">
      <p class="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-1">${titleMap[type] || titleMap.info}</p>
      <p class="text-xs font-black text-cafe uppercase leading-tight tracking-tighter">${message}</p>
    </div>
  `;

    container.appendChild(toast);

    // Auto-remove
    setTimeout(() => {
        toast.classList.add('animate-fadeOut');
        setTimeout(() => toast.remove(), 500);
    }, 5000);

    // Close on click
    toast.addEventListener('click', () => {
        toast.classList.add('animate-fadeOut');
        setTimeout(() => toast.remove(), 200);
    });
}
