/**
 * router.js – Einfacher SPA-Router
 * Verwaltet welche View aktuell angezeigt wird.
 * Kein URL-basiertes Routing (PWA läuft offline),
 * stattdessen ein State-basiertes View-System.
 */

const Router = (() => {
  // Registry: Name → Render-Funktion
  const _views = {};

  // Aktuell angezeigte View
  let _currentView = null;

  // DOM-Container
  const getApp = () => document.getElementById('app');

  /**
   * View registrieren
   * @param {string} name – eindeutiger Name
   * @param {Function} renderFn – gibt HTML-String zurück oder füllt den Container
   */
  function register(name, renderFn) {
    _views[name] = renderFn;
  }

  /**
   * Zu einer View navigieren
   * @param {string} name – View-Name
   * @param {object} params – optionale Parameter für die View
   */
  async function navigate(name, params = {}) {
    const renderFn = _views[name];
    if (!renderFn) {
      console.error(`[Router] View nicht gefunden: ${name}`);
      return;
    }

    console.log(`[Router] Navigiere zu: ${name}`, params);

    // App-Container leeren
    const app = getApp();
    app.innerHTML = '';

    _currentView = name;

    // View rendern
    try {
      await renderFn(app, params);
    } catch (err) {
      console.error(`[Router] Fehler beim Rendern von ${name}:`, err);
      app.innerHTML = `
        <div class="empty-state" style="padding: 60px 24px">
          <div class="empty-icon">⚠️</div>
          <h3>Fehler beim Laden</h3>
          <p>${err.message}</p>
          <button class="btn btn-secondary" onclick="Router.navigate('login')">Zurück zum Login</button>
        </div>
      `;
    }
  }

  /** Aktuelle View abfragen */
  function current() {
    return _currentView;
  }

  return { register, navigate, current };
})();
