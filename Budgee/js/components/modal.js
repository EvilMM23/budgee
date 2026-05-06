/**
 * modal.js – Bottom Sheet Modal System
 * Öffnet und schließt modale Dialoge als Bottom Sheet.
 */

const Modal = (() => {
  const getOverlay   = () => document.getElementById('modal-overlay');
  const getContainer = () => document.getElementById('modal-container');

  let _onClose = null;

  /**
   * Modal öffnen
   * @param {object} options
   * @param {string} options.title
   * @param {string} options.body      – HTML-String für den Body
   * @param {Array}  options.actions   – [{ label, class, onClick }]
   * @param {Function} options.onClose
   */
  function open({ title = '', body = '', actions = [], onClose = null } = {}) {
    const overlay   = getOverlay();
    const container = getContainer();
    _onClose = onClose;

    container.innerHTML = `
      <div class="modal-drag-handle"></div>
      <div class="modal-header">
        <h3 style="font-family:var(--font-display)">${title}</h3>
        <button class="btn btn-ghost btn-icon" id="modal-close-btn" aria-label="Schließen">✕</button>
      </div>
      <div class="modal-body">${body}</div>
      ${actions.length ? `
        <div class="modal-footer">
          ${actions.map((a, i) => `
            <button class="btn ${a.class || 'btn-secondary'} flex-1" data-action-idx="${i}">
              ${a.label}
            </button>
          `).join('')}
        </div>
      ` : ''}
    `;

    // Action-Buttons verknüpfen
    container.querySelectorAll('[data-action-idx]').forEach(btn => {
      const idx = +btn.dataset.actionIdx;
      btn.addEventListener('click', () => actions[idx]?.onClick?.());
    });

    // Schließen-Button
    document.getElementById('modal-close-btn')?.addEventListener('click', close);

    overlay.classList.remove('hidden');
    container.classList.remove('hidden');

    // Overlay-Klick schließt Modal
    overlay.onclick = close;
  }

  /** Modal schließen */
  function close() {
    const overlay   = getOverlay();
    const container = getContainer();

    overlay.classList.add('hidden');
    container.classList.add('hidden');
    container.innerHTML = '';

    _onClose?.();
    _onClose = null;
  }

  /**
   * Inhalt des Modals nach dem Öffnen aktualisieren
   * (z.B. bei Formularschritten)
   */
  function updateBody(html) {
    const body = getContainer().querySelector('.modal-body');
    if (body) body.innerHTML = html;
  }

  return { open, close, updateBody };
})();
