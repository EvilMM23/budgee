/**
 * app.js – App-Einstiegspunkt
 * Initialisiert die Datenbank, lädt den State und
 * entscheidet welche View zuerst angezeigt wird.
 *
 * Reihenfolge:
 *  1. IndexedDB öffnen
 *  2. Stammdaten in den State laden
 *  3. Setup-Status prüfen
 *  4. Zur richtigen View navigieren
 */

(async () => {
  try {
    // ── 1. Datenbank öffnen ──
    await DB.open();
    console.log('[App] Datenbank bereit.');

    // ── 2. Stammdaten laden ──
    await State.loadAll();
    console.log('[App] State geladen.');

    // ── 3. Loading-Screen ausblenden ──
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      loadingScreen.style.opacity = '0';
      loadingScreen.style.transition = 'opacity 0.4s ease';
      setTimeout(() => loadingScreen.remove(), 400);
    }

    // ── 4. Zur Login-View navigieren ──
    Router.navigate('login');

    // ── 5. Service Worker & Offline-Status ──
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        console.log('[SW] Registriert:', reg.scope);

        // Auf Nachrichten vom SW hören (Cache-Status)
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data?.type === 'CACHE_STATUS') {
            const { cached, failed, total } = event.data;
            if (failed === 0) {
              showOfflineBanner('success',
                `✓ App ist jetzt offline verfügbar (${cached} Dateien gespeichert)`);
            } else if (cached > 0) {
              showOfflineBanner('warn',
                `⚠ Teilweise offline (${cached}/${total}). Bitte nochmal laden.`,
                true);
            }
          }
        });

        // Update gefunden → nur neu laden wenn die App bereits aktiv genutzt wird
        // (nicht beim ersten Install, da der SW sonst sofort einen Reload auslöst)
        let swAlreadyActive = !!navigator.serviceWorker.controller;
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated' && swAlreadyActive) {
              console.log('[SW] Update aktiviert – zeige Hinweis.');
              showOfflineBanner('info', '🔄 Update verfügbar – tippe zum Neu laden', true, 0);
            }
          });
        });

      } catch (err) {
        console.warn('[SW] Registrierung fehlgeschlagen:', err);
      }

      // ── Offline-Status überwachen ──
      window.addEventListener('online',  () => showOfflineBanner('info', '🌐 Wieder online'));
      window.addEventListener('offline', () => showOfflineBanner('warn', '📴 Offline – App läuft aus dem Cache', false, 0));

      // Kein automatischer Reload-Timer – der hat die Dauerreload-Schleife verursacht!
    }

  } catch (err) {
    console.error('[App] Kritischer Startfehler:', err);
    document.getElementById('app').innerHTML = `
      <div style="
        min-height:100dvh; display:flex; flex-direction:column;
        align-items:center; justify-content:center;
        padding:32px; text-align:center; gap:16px;
        background:#0f1117; color:#f0f2f8; font-family:system-ui,sans-serif;
      ">
        <div style="font-size:3rem">⚠️</div>
        <h2>App konnte nicht starten</h2>
        <p style="color:#8a90a8;max-width:280px">
          Stelle sicher dass du keinen privaten/Inkognito-Modus verwendest
          und der Browser IndexedDB unterstützt.
        </p>
        <p style="font-size:0.8rem;color:#555b72;font-family:monospace">${err.message}</p>
        <button onclick="location.reload()" style="
          margin-top:8px; padding:12px 24px; background:#f5a623; color:#000;
          border:none; border-radius:12px; font-size:1rem; font-weight:600; cursor:pointer;
        ">Neu laden</button>
      </div>
    `;
  }
})();

/**
 * Offline-Status-Banner anzeigen
 * @param {'success'|'warn'|'info'} type
 * @param {string} message
 * @param {boolean} showRetry  – Neu-laden Button anzeigen
 * @param {number}  duration   – ms bis auto-hide (0 = permanent)
 */
function showOfflineBanner(type, message, showRetry = false, duration = 4000) {
  // Vorherigen Banner entfernen
  document.getElementById('offline-banner')?.remove();

  const colors = {
    success: { bg: 'rgba(61,122,92,0.12)',  border: '#3D7A5C', text: '#3D7A5C' },
    warn:    { bg: 'rgba(139,74,53,0.10)',   border: '#8B4A35', text: '#8B4A35' },
    info:    { bg: 'rgba(119,145,160,0.12)', border: '#7791A0', text: '#1F3B4B' },
  };
  const c = colors[type] || colors.info;

  const banner = document.createElement('div');
  banner.id = 'offline-banner';
  banner.style.cssText = `
    position: fixed;
    top: env(safe-area-inset-top, 0px);
    left: 50%;
    transform: translateX(-50%);
    width: min(92vw, 420px);
    background: ${c.bg};
    border: 1px solid ${c.border};
    border-radius: 12px;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    z-index: 9999;
    font-family: system-ui, sans-serif;
    font-size: 0.85rem;
    color: ${c.text};
    backdrop-filter: blur(12px);
    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    animation: slideDown 0.3s ease both;
    margin-top: 8px;
  `;

  banner.innerHTML = `
    <span style="flex:1">${message}</span>
    ${showRetry ? `<button onclick="window.location.reload()" style="
      background:${c.border}; color:#000; border:none; border-radius:8px;
      padding:6px 12px; font-size:0.8rem; font-weight:600; cursor:pointer; white-space:nowrap;
    ">Neu laden</button>` : ''}
    <button onclick="this.parentElement.remove()" style="
      background:none; border:none; color:${c.text}; cursor:pointer;
      font-size:1.1rem; padding:0 4px; opacity:0.7;
    ">×</button>
  `;

  document.body.appendChild(banner);

  if (duration > 0) {
    setTimeout(() => {
      banner.style.opacity = '0';
      banner.style.transition = 'opacity 0.3s';
      setTimeout(() => banner.remove(), 300);
    }, duration);
  }
}

