/**
 * toast.js – Toast-Benachrichtigungen
 * Kurze Statusmeldungen die automatisch verschwinden.
 */

const Toast = (() => {
  const getContainer = () => document.getElementById('toast-container');

  /**
   * Toast anzeigen
   * @param {string} message
   * @param {'success'|'error'|'info'} type
   * @param {number} duration – ms
   */
  function show(message, type = 'info', duration = 3000) {
    const container = getContainer();
    const icons = { success: '✓', error: '✕', info: 'ℹ' };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span style="font-weight:600">${icons[type]}</span> ${message}`;

    container.appendChild(toast);

    // Automatisch entfernen
    setTimeout(() => {
      toast.style.animation = 'slideDown 0.25s var(--ease-out) reverse forwards';
      setTimeout(() => toast.remove(), 250);
    }, duration);
  }

  const success = (msg) => show(msg, 'success');
  const error   = (msg) => show(msg, 'error', 4000);
  const info    = (msg) => show(msg, 'info');

  return { show, success, error, info };
})();
