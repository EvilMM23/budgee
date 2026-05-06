/**
 * views/login.js – Login-Screen
 * Zentrierte Karte, passt sich Landscape an.
 */

Router.register('login', async (app) => {
  const users     = State.get('users');
  const setupDone = State.get('setupDone');

  Navbar.unmount();

  app.innerHTML = `
    <div class="login-page animate-fade">
      <div class="login-card">

        <!-- Logo -->
        <div style="text-align:center">
          <div class="login-logo-mark" style="margin:0 auto var(--space-md)">⬡</div>
          <h1 style="font-size:1.8rem">HaushaltsFinanz</h1>
          <p class="login-subtitle">Wer bist du?</p>
        </div>

        <!-- Profile -->
        <div class="profile-grid stagger" id="profile-grid">
          ${renderProfiles(users, setupDone)}
        </div>

        <!-- Offline-Status -->
        <div id="offline-status" style="width:100%;text-align:center">
          ${await renderOfflineStatus()}
        </div>

        <p class="text-muted text-xs" style="text-align:center">
          Kein Passwort erforderlich
        </p>

      </div>
    </div>
  `;

  // Profilkarten
  document.getElementById('profile-grid').addEventListener('click', e => {
    const card = e.target.closest('[data-user-id]');
    if (!card) return;
    card.style.transform = 'scale(0.92)';
    setTimeout(() => handleProfileSelect(
      +card.dataset.userId,
      card.dataset.isAdmin === 'true',
      setupDone
    ), 150);
  });

  // Offline speichern Button
  document.getElementById('cache-now-btn')?.addEventListener('click', e => cacheNow(e.currentTarget));
});

// ── Profile rendern ──
function renderProfiles(users, setupDone) {
  if (!setupDone || users.length === 0) {
    return `
      <div class="profile-card animate-slide" data-user-id="0" data-is-admin="true">
        <div class="avatar avatar-xl" style="background:var(--sand-dim);border-color:var(--sand-border)">
          <span style="color:var(--navy);font-size:2rem">A</span>
        </div>
        <span class="profile-name">Admin</span>
        <span class="tag tag-amber" style="font-size:0.65rem">Ersteinrichtung</span>
      </div>`;
  }
  return users.filter(u => u.canLogin).map(u => `
    <div class="profile-card animate-slide" data-user-id="${u.id}" data-is-admin="${u.isAdmin||false}">
      <div class="avatar avatar-xl" style="background:${u.color||'var(--bg-elevated)'}">
        ${u.avatar
          ? `<img src="${u.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
          : Utils.initials(u.name)}
      </div>
      <span class="profile-name">${u.name}</span>
      ${u.isAdmin ? '<span class="tag tag-amber" style="font-size:0.65rem">Admin</span>' : ''}
    </div>`).join('');
}

// ── Offline-Status ──
async function renderOfflineStatus() {
  if (!('caches' in window)) return '';
  try {
    const keys     = await caches.keys();
    const appCache = keys.find(k => k.startsWith('haushaltsfinanz-'));
    if (!appCache) {
      return `
        <button id="cache-now-btn" style="
          background:var(--sand-dim); border:1px solid var(--sand-border);
          color:var(--brown); border-radius:var(--radius-md);
          padding:10px 20px; font-size:0.85rem; font-weight:500;
          cursor:pointer; font-family:inherit; margin-bottom:4px;
        ">📥 Für Offline-Nutzung speichern</button>
        <p class="text-xs text-muted">Einmalig nötig – danach ohne Internet nutzbar</p>`;
    }
    const cache   = await caches.open(appCache);
    const entries = await cache.keys();
    return `<p style="font-size:0.78rem;color:var(--color-income)">✓ Offline verfügbar (${entries.length} Dateien)</p>`;
  } catch { return ''; }
}

// ── Manuelles Cachen ──
async function cacheNow(btn) {
  if (!navigator.serviceWorker?.controller) {
    Toast.info('Bitte warte kurz…'); setTimeout(() => location.reload(), 1500); return;
  }
  btn.disabled = true; btn.textContent = '⏳ Wird gespeichert…';
  const FILES = [
    '/','index.html','manifest.json',
    'css/main.css','css/components.css','css/views.css',
    'js/core/db.js','js/core/state.js','js/core/router.js','js/core/utils.js',
    'js/components/toast.js','js/components/modal.js','js/components/chart.js','js/components/navbar.js',
    'js/views/login.js','js/views/setup.js','js/views/dashboard.js','js/views/accounts.js',
    'js/views/budget.js','js/views/analytics.js','js/views/settings.js','js/views/transaction-form.js',
    'js/app.js',
  ];
  try {
    const cache = await caches.open('haushaltsfinanz-v4');
    let ok = 0;
    for (const url of FILES) {
      try { const r = await fetch(url,{cache:'no-cache'}); if(r.ok){await cache.put(url,r);ok++;} } catch{}
      btn.textContent = `⏳ ${ok}/${FILES.length}…`;
    }
    if (ok === FILES.length) {
      btn.textContent = '✓ Offline gespeichert!';
      btn.style.cssText += 'background:var(--color-income-bg);border-color:rgba(61,122,92,0.3);color:var(--color-income)';
      Toast.success('App ist jetzt offline verfügbar!');
    } else {
      btn.textContent = `⚠ ${ok}/${FILES.length} – nochmal versuchen`; btn.disabled = false;
    }
  } catch(err) { btn.textContent = '✗ Fehler'; btn.disabled = false; Toast.error(err.message); }
}

// ── Profil-Auswahl ──
async function handleProfileSelect(userId, isAdmin, setupDone) {
  if (!setupDone && isAdmin) { Router.navigate('setup'); return; }

  let user;
  if (userId === 0) {
    const users = await DB.getAll('users');
    user = users.find(u => u.isAdmin) || users[0];
  } else {
    user = await DB.getById('users', userId);
  }

  if (!user) { Toast.error('Benutzer nicht gefunden'); return; }

  State.set({ currentUser: user, activeTab: 'dashboard' });

  const accounts = State.get('accounts').filter(a => a.userId === user.id);
  if (accounts.length === 0 && !user.isAdmin) {
    Router.navigate('setup', { step: 'accounts', userId: user.id }); return;
  }

  Navbar.mount(); Navbar.setActive('dashboard');
  Router.navigate('dashboard');
}
