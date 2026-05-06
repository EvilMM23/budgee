/**
 * views/settings.js – Einstellungen
 * Landscape: Links Profil + Navigation, Rechts Inhalt
 */

Router.register('settings', async (app) => {
  const user       = State.get('currentUser');
  const users      = State.get('users');
  const categories = State.get('categories');
  const accounts   = State.get('accounts');
  const tags       = State.get('tags');

  if (!user) { Router.navigate('login'); return; }
  Navbar.setActive('settings');

  const isAdmin = user.isAdmin;

  app.innerHTML = `
    <div class="page">
      <div class="page-header">
        <h2>Einstellungen</h2>
      </div>

      <div class="page-content landscape-grid" style="padding-top:var(--space-md)">

        <!-- LINKS: Profil + Mitglieder -->
        <div style="display:flex;flex-direction:column;gap:var(--space-md)">

          <!-- Aktueller Nutzer -->
          <div class="card" style="display:flex;align-items:center;gap:var(--space-md)">
            <div class="avatar avatar-lg" style="background:${user.color||'var(--bg-elevated)'}">
              ${user.avatar
                ? `<img src="${user.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
                : Utils.initials(user.name)}
            </div>
            <div style="flex:1">
              <p style="font-weight:600;font-size:1.05rem">${user.name}</p>
              <p class="text-sm text-muted">${isAdmin ? '👑 Administrator' : '👤 Mitglied'}</p>
            </div>
            <button class="btn btn-secondary btn-sm" id="logout-btn">Abmelden</button>
          </div>

          <!-- Nutzer wechseln -->
          <div class="card">
            <p class="settings-section-title" style="padding:0 0 var(--space-sm)">Haushaltsmitglieder</p>
            <div style="display:flex;flex-wrap:wrap;gap:var(--space-md)" id="member-switcher">
              ${users.filter(u => u.canLogin).map(u => `
                <div class="profile-card" data-switch-user="${u.id}"
                  style="${u.id===user.id ? 'border-color:var(--steel);background:var(--blue-soft)' : ''}">
                  <div class="avatar avatar-md" style="background:${u.color||'var(--bg-elevated)'}">
                    ${u.avatar
                      ? `<img src="${u.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
                      : Utils.initials(u.name)}
                  </div>
                  <span class="profile-name">${u.name}</span>
                  ${u.id===user.id ? '<span class="tag tag-teal" style="font-size:0.62rem">Aktiv</span>' : ''}
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Tags -->
          <div class="card">
            <p class="settings-section-title" style="padding:0 0 var(--space-sm)">Tags</p>
            <div style="display:flex;flex-wrap:wrap;gap:8px" id="tags-list">
              ${tags.map(tag => `
                <span class="tag tag-amber" style="cursor:pointer" data-tag-id="${tag.id}">${tag.name} ×</span>
              `).join('')}
              ${tags.length===0 ? '<p class="text-muted text-sm">Noch keine Tags.</p>' : ''}
            </div>
          </div>

          <!-- App-Info -->
          <div class="card" style="text-align:center;background:var(--bg-elevated)">
            <p class="text-muted text-sm">HaushaltsFinanz v1.0</p>
            <p class="text-muted text-xs" style="margin-top:4px">Alle Daten lokal gespeichert · Offline-fähig</p>
          </div>

        </div>

        <!-- RECHTS: Konten + Kategorien + Admin -->
        <div style="display:flex;flex-direction:column;gap:var(--space-md)">

          <!-- Konten -->
          <div class="card">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-md)">
              <p class="settings-section-title" style="padding:0">Meine Konten</p>
              <div style="display:flex;gap:8px">
                <button class="btn btn-ghost btn-sm" data-goto-accounts>Alle anzeigen →</button>
                <button class="btn btn-secondary btn-sm" id="add-account-btn">+ Konto</button>
              </div>
            </div>
            ${accounts.filter(a => a.userId===user.id).map(acc => renderAccountItem(acc)).join('')
              || '<p class="text-muted text-sm">Keine Konten vorhanden.</p>'}
          </div>

          <!-- Kategorien (nur Admin) -->
          ${isAdmin ? `
          <div class="card">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-md)">
              <p class="settings-section-title" style="padding:0">Kategorien & Budgets</p>
              <button class="btn btn-secondary btn-sm" id="add-category-btn">+ Kategorie</button>
            </div>
            <div style="display:flex;flex-direction:column;gap:2px">
              ${categories.map(cat => renderCategoryItem(cat)).join('')}
            </div>
          </div>
          ` : ''}

          <!-- Admin-Bereich -->
          ${isAdmin ? `
          <div class="card">
            <p class="settings-section-title" style="padding:0 0 var(--space-sm)">Administration</p>
            <div class="settings-item" id="manage-members-btn">
              <div class="settings-icon" style="background:var(--blue-dim)">👥</div>
              <div class="settings-info">
                <p class="settings-label">Haushaltsmitglieder</p>
                <p class="settings-desc">${users.length} Mitglieder</p>
              </div>
              <span class="settings-chevron">›</span>
            </div>
            <div class="settings-item" id="export-data-btn">
              <div class="settings-icon" style="background:var(--warmgray-dim)">💾</div>
              <div class="settings-info">
                <p class="settings-label">Daten exportieren</p>
                <p class="settings-desc">JSON-Datei herunterladen</p>
              </div>
              <span class="settings-chevron">›</span>
            </div>
          </div>
          ` : ''}

        </div>
      </div>
    </div>
  `;

  // ── Events ──
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    State.set({ currentUser: null, activeTab: 'dashboard', viewScope: 'personal' });
    Navbar.unmount();
    Router.navigate('login');
  });

  document.getElementById('member-switcher')?.addEventListener('click', e => {
    const card = e.target.closest('[data-switch-user]');
    if (!card) return;
    const newUser = State.get('users').find(u => u.id === +card.dataset.switchUser);
    if (newUser && newUser.id !== user.id) {
      State.set({ currentUser: newUser, activeTab: 'dashboard' });
      Toast.info(`Angemeldet als ${newUser.name}`);
      Navbar.setActive('dashboard');
      Router.navigate('dashboard');
    }
  });

  document.getElementById('add-account-btn')?.addEventListener('click', () =>
    openAddAccountModal(user.id, () => Router.navigate('settings'))
  );

  app.querySelectorAll('[data-goto-accounts]').forEach(el =>
    el.addEventListener('click', () => {
      State.set({ activeTab: 'accounts' }); Navbar.setActive('accounts'); Router.navigate('accounts');
    })
  );

  app.querySelectorAll('[data-edit-account]').forEach(btn =>
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const acc = accounts.find(a => a.id === +btn.dataset.editAccount);
      if (acc) openEditAccountModal(acc, () => Router.navigate('settings'));
    })
  );

  document.getElementById('add-category-btn')?.addEventListener('click', () => openCategoryModal(null));

  app.querySelectorAll('[data-edit-cat]').forEach(btn =>
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const cat = categories.find(c => c.id === +btn.dataset.editCat);
      if (cat) openCategoryModal(cat);
    })
  );

  document.getElementById('tags-list')?.addEventListener('click', async e => {
    const tag = e.target.closest('[data-tag-id]');
    if (!tag) return;
    if (!confirm(`Tag "${tag.textContent.trim().slice(0,-2)}" löschen?`)) return;
    await DB.remove('tags', +tag.dataset.tagId);
    const updatedTags = await DB.getAll('tags');
    State.set({ tags: updatedTags });
    tag.remove();
    Toast.success('Tag gelöscht.');
  });

  document.getElementById('manage-members-btn')?.addEventListener('click', openManageMembersModal);
  document.getElementById('export-data-btn')?.addEventListener('click', exportData);
});

// ── Render-Helfer ──

function renderAccountItem(acc) {
  const type       = Utils.getAccountType(acc.type);
  const allTxs     = State.get('transactions');
  const currentBal = computeBalance(acc, allTxs);
  return `
    <div class="settings-item">
      <div class="settings-icon" style="background:${type.color}18;font-size:1.2rem">${type.icon}</div>
      <div class="settings-info">
        <p class="settings-label">${acc.name}</p>
        <p class="settings-desc">${type.name} ·
          <span style="color:${currentBal<0?'var(--color-expense)':'var(--color-income)'}">
            ${Utils.formatCurrency(currentBal)}
          </span>
        </p>
      </div>
      <button class="btn btn-ghost btn-sm" data-edit-account="${acc.id}">✎</button>
    </div>`;
}

function renderCategoryItem(cat) {
  return `
    <div class="settings-item">
      <div class="settings-icon" style="background:${cat.color}18;font-size:1.1rem">${cat.icon}</div>
      <div class="settings-info">
        <p class="settings-label">${cat.name} ${cat.isIncome?'<span class="tag tag-teal" style="font-size:0.65rem;margin-left:4px">Einnahmen</span>':''}</p>
        <p class="settings-desc">${cat.budget?'Budget: '+Utils.formatCurrency(cat.budget)+'/Mo.':'Kein Budget'}</p>
      </div>
      <button class="btn btn-ghost btn-sm" data-edit-cat="${cat.id}">✎</button>
    </div>`;
}

// ── Kategorie Modal ──
function openCategoryModal(cat) {
  const isEdit  = !!cat;
  const colors  = Utils.CATEGORY_COLORS;
  let selColor  = cat?.color || colors[0];
  let selIcon   = cat?.icon  || Utils.CATEGORY_ICONS[0];

  Modal.open({
    title: isEdit ? 'Kategorie bearbeiten' : 'Kategorie erstellen',
    body: `
      <div class="form-group" style="margin-bottom:14px">
        <label class="form-label">Name</label>
        <input type="text" id="cat-name" value="${cat?.name||''}" placeholder="Kategorie-Name" />
      </div>
      <div class="form-group" style="margin-bottom:14px">
        <label class="form-label">Icon</label>
        <div style="display:flex;flex-wrap:wrap;gap:6px" id="icon-grid">
          ${Utils.CATEGORY_ICONS.map(icon => `
            <button class="btn btn-sm ${icon===selIcon?'btn-primary':'btn-secondary'}"
                    data-icon="${icon}" style="min-width:40px">${icon}</button>
          `).join('')}
        </div>
      </div>
      <div class="form-group" style="margin-bottom:14px">
        <label class="form-label">Farbe</label>
        <div class="color-swatch-grid">
          ${colors.map(c => `
            <div class="color-swatch ${c===selColor?'selected':''}" style="background:${c}" data-color="${c}"></div>
          `).join('')}
        </div>
      </div>
      <div class="form-group" style="margin-bottom:14px">
        <label class="form-label">Monatsbudget (€)</label>
        <div class="input-group">
          <span class="input-prefix">€</span>
          <input type="number" id="cat-budget" value="${cat?.budget||0}" min="0" step="10" />
        </div>
      </div>
      <label style="display:flex;align-items:center;gap:8px;font-size:0.9rem;cursor:pointer">
        <input type="checkbox" id="cat-is-income" ${cat?.isIncome?'checked':''} style="width:auto" />
        Diese Kategorie ist für Einnahmen
      </label>`,
    actions: [
      ...(isEdit ? [{
        label:'Löschen', class:'btn-danger', onClick: async () => {
          if (!confirm('Kategorie löschen?')) return;
          await DB.remove('categories', cat.id);
          await State.reloadCategories();
          Modal.close(); Toast.success('Kategorie gelöscht.');
          Router.navigate('settings');
        }
      }] : []),
      {
        label: isEdit?'Speichern':'Erstellen', class:'btn-primary', onClick: async () => {
          const name     = document.getElementById('cat-name').value.trim();
          const budget   = parseFloat(document.getElementById('cat-budget').value) || 0;
          const isIncome = document.getElementById('cat-is-income').checked;
          if (!name) { Toast.error('Bitte gib einen Namen ein.'); return; }
          const data = { name, icon:selIcon, color:selColor, budget, isIncome };
          if (isEdit) {
            await DB.update('categories', { ...cat, ...data });
            Toast.success('Kategorie aktualisiert.');
          } else {
            await DB.add('categories', data);
            Toast.success('Kategorie erstellt.');
          }
          await State.reloadCategories();
          Modal.close(); Router.navigate('settings');
        }
      }
    ],
  });

  document.getElementById('icon-grid')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-icon]');
    if (!btn) return;
    selIcon = btn.dataset.icon;
    document.querySelectorAll('[data-icon]').forEach(b => {
      b.classList.toggle('btn-primary',  b.dataset.icon===selIcon);
      b.classList.toggle('btn-secondary',b.dataset.icon!==selIcon);
    });
  });

  document.querySelectorAll('[data-color]').forEach(swatch =>
    swatch.addEventListener('click', () => {
      selColor = swatch.dataset.color;
      document.querySelectorAll('.color-swatch').forEach(s =>
        s.classList.toggle('selected', s.dataset.color===selColor));
    })
  );
}

// ── Mitglieder-Modal ──
function openManageMembersModal() {
  const users = State.get('users');
  Modal.open({
    title: 'Haushaltsmitglieder',
    body: `
      <div style="display:flex;flex-direction:column;gap:10px">
        ${users.map(u => `
          <div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--bg-elevated);border-radius:12px">
            <div class="avatar avatar-sm" style="background:${u.color||'var(--bg-elevated)'}">
              ${Utils.initials(u.name)}
            </div>
            <div style="flex:1">
              <p style="font-weight:500">${u.name}</p>
              <p class="text-xs text-muted">
                ${u.isAdmin?'Admin · ':''}${u.canLogin?'Login aktiv':'Kein Login'}
              </p>
            </div>
            ${!u.isAdmin ? `
              <button class="btn btn-ghost btn-sm" data-del-user="${u.id}"
                      style="color:var(--color-expense)">Entfernen</button>
            ` : ''}
          </div>
        `).join('')}
      </div>`,
  });

  document.querySelectorAll('[data-del-user]').forEach(btn =>
    btn.addEventListener('click', async () => {
      const uid  = +btn.dataset.delUser;
      const name = State.get('users').find(u => u.id===uid)?.name;
      if (!confirm(`${name} wirklich entfernen?`)) return;
      await DB.remove('users', uid);
      await State.reload();
      Modal.close(); Toast.success('Mitglied entfernt.');
      Router.navigate('settings');
    })
  );
}

// ── Daten-Export ──
async function exportData() {
  const [users, accounts, transactions, categories, tags] = await Promise.all([
    DB.getAll('users'), DB.getAll('accounts'), DB.getAll('transactions'),
    DB.getAll('categories'), DB.getAll('tags'),
  ]);
  const blob = new Blob([JSON.stringify({ exportedAt:new Date().toISOString(), version:'1.0',
    users, accounts, transactions, categories, tags }, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a   = Object.assign(document.createElement('a'), { href:url, download:`haushaltsfinanz-${Utils.today()}.json` });
  a.click(); URL.revokeObjectURL(url);
  Toast.success('Daten exportiert.');
}

// openAddAccountModal und openEditAccountModal kommen aus accounts.js
