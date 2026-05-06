/**
 * views/setup.js – Einrichtungs-Assistent
 * Helles Design, zentriert, max-width
 */

Router.register('setup', async (app, params = {}) => {
  Navbar.unmount();
  if (params.step === 'accounts') { renderAccountSetup(app, params.userId); return; }
  renderStep(app, 1, {});
});

function renderStep(app, step, data) {
  const total = 3;
  const dots  = Array.from({length:total},(_,i)=>`
    <div class="setup-step-dot ${i<step-1?'done':i===step-1?'active':''}"></div>`).join('');

  const content = { 1:renderMembersStep(data), 2:renderAccountsStep(data), 3:renderCategoriesStep(data) }[step];

  app.innerHTML = `
    <div class="setup-page animate-fade">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px">
        ${step>1?`<button class="btn btn-ghost btn-icon" id="setup-back" style="color:var(--navy)">←</button>`:''}
        <div class="setup-progress" style="flex:1;margin-bottom:0">${dots}</div>
      </div>
      <p class="text-muted text-sm" style="margin-bottom:var(--space-xl)">Schritt ${step} von ${total}</p>
      <div class="setup-content">${content}</div>
    </div>`;

  if (step===1) bindMembersStep(app, data);
  if (step===2) bindAccountsStep(app, data);
  if (step===3) bindCategoriesStep(app, data);
  document.getElementById('setup-back')?.addEventListener('click', () => renderStep(app, step-1, data));
}

// ── Schritt 1: Mitglieder ──
function renderMembersStep(data) {
  const members = data.members || [
    { name:'Admin', isAdmin:true, canLogin:true, color:'#B0DCF5' },
    { name:'',      isAdmin:false,canLogin:true, color:'#F5D7B0' },
  ];
  return `
    <h2>Dein Haushalt</h2>
    <p>Wer lebt bei dir? Lege alle Mitglieder an.</p>
    <div id="members-list" class="member-list">${members.map((m,i)=>renderMemberRow(m,i)).join('')}</div>
    <button class="btn btn-ghost w-full" id="add-member-btn"
      style="border:1.5px dashed var(--border-strong);margin-top:8px;color:var(--text-secondary)">
      + Mitglied hinzufügen
    </button>
    <div class="card card-sm" style="background:var(--blue-soft);border-color:var(--blue-border);margin-top:4px">
      <p class="text-xs" style="color:var(--navy-mid)">
        💡 Kinder können in die Analyse einbezogen werden, ohne eigenen Login.
      </p>
    </div>
    <button class="btn btn-primary btn-full btn-lg" id="step1-next" style="margin-top:8px">
      Weiter →
    </button>`;
}

function renderMemberRow(member, index) {
  const color = member.color || Utils.CATEGORY_COLORS[index % Utils.CATEGORY_COLORS.length];
  return `
    <div class="member-row" data-member-idx="${index}">
      <div class="avatar avatar-sm" style="background:${color};width:40px;height:40px;font-size:0.95rem;cursor:pointer"
           data-color-pick="${index}">
        ${member.name ? Utils.initials(member.name) : '?'}
      </div>
      <input type="text" class="member-name-input" placeholder="${member.isAdmin?'Dein Name':'Name'}"
             value="${member.name}" data-idx="${index}" />
      <label style="display:flex;align-items:center;gap:6px;font-size:0.78rem;color:var(--text-muted);cursor:pointer;white-space:nowrap">
        <input type="checkbox" data-login="${index}" ${member.canLogin?'checked':''} ${member.isAdmin?'disabled':''} style="width:auto">
        Login
      </label>
      ${!member.isAdmin
        ? `<button class="btn btn-ghost btn-icon" data-remove="${index}" style="color:var(--color-expense)">×</button>`
        : '<div style="width:44px"></div>'}
    </div>`;
}

function bindMembersStep(app, data) {
  let members = data.members || [
    { name:'Admin', isAdmin:true, canLogin:true, color:'#B0DCF5' },
    { name:'',      isAdmin:false,canLogin:true, color:'#F5D7B0' },
  ];
  const list = document.getElementById('members-list');

  function refresh() { list.innerHTML = members.map((m,i)=>renderMemberRow(m,i)).join(''); bindRows(); }

  function bindRows() {
    list.querySelectorAll('.member-name-input').forEach(inp => inp.addEventListener('input', () => {
      members[+inp.dataset.idx].name = inp.value;
      const av = list.querySelector(`[data-color-pick="${inp.dataset.idx}"]`);
      if (av) av.textContent = inp.value ? Utils.initials(inp.value) : '?';
    }));
    list.querySelectorAll('[data-login]').forEach(cb => cb.addEventListener('change', () => {
      members[+cb.dataset.login].canLogin = cb.checked;
    }));
    list.querySelectorAll('[data-remove]').forEach(btn => btn.addEventListener('click', () => {
      members.splice(+btn.dataset.remove, 1); refresh();
    }));
    list.querySelectorAll('[data-color-pick]').forEach(av => av.addEventListener('click', () => {
      const idx = +av.dataset.colorPick;
      const c   = Utils.CATEGORY_COLORS;
      members[idx].color = c[(c.indexOf(members[idx].color)+1) % c.length];
      av.style.background = members[idx].color;
    }));
  }

  bindRows();

  document.getElementById('add-member-btn').addEventListener('click', () => {
    members.push({ name:'', isAdmin:false, canLogin:true, color:Utils.CATEGORY_COLORS[members.length % Utils.CATEGORY_COLORS.length] });
    refresh();
  });

  document.getElementById('step1-next').addEventListener('click', () => {
    if (!members[0].name.trim()) { Toast.error('Bitte gib deinen Namen ein.'); return; }
    const cleaned = members.filter(m => m.name.trim());
    renderStep(app, 2, { members: cleaned });
  });
}

// ── Schritt 2: Konten ──
function renderAccountsStep(data) {
  const existing = data.accounts || [];
  return `
    <h2>Deine Konten</h2>
    <p>Welche Konten möchtest du verwalten?</p>
    <div class="account-type-grid" id="account-type-grid">
      ${Utils.ACCOUNT_TYPES.map(t=>`
        <div class="account-type-card ${existing.find(a=>a.type===t.id)?'selected':''}" data-account-type="${t.id}">
          <span class="account-type-icon">${t.icon}</span>
          <span class="account-type-name">${t.name}</span>
        </div>`).join('')}
    </div>
    <div id="account-forms" style="margin-top:16px;display:flex;flex-direction:column;gap:10px">
      ${existing.map(a=>renderAccountForm(a)).join('')}
    </div>
    <button class="btn btn-primary btn-full btn-lg" id="step2-next" style="margin-top:16px">Weiter →</button>`;
}

function renderAccountForm(account) {
  const type = Utils.getAccountType(account.type);
  return `
    <div class="card card-sm" data-account-form="${account.type}" style="border-left:3px solid ${type.color}">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <span>${type.icon}</span>
        <strong style="flex:1;font-size:0.92rem">${type.name}</strong>
        <button class="btn btn-ghost btn-icon btn-sm" data-remove-account="${account.type}"
                style="color:var(--color-expense)">×</button>
      </div>
      <div class="form-group">
        <label class="form-label">Name</label>
        <input type="text" data-field="name" value="${account.name||type.name}" />
      </div>
      <div class="form-group" style="margin-top:8px">
        <label class="form-label">${account.type==='credit'?'Schuldenstand (€)':'Startguthaben (€)'}</label>
        <div class="input-group">
          <span class="input-prefix">€</span>
          <input type="number" data-field="balance" value="${account.balance||''}" placeholder="0,00" step="0.01" />
        </div>
      </div>
    </div>`;
}

function bindAccountsStep(app, data) {
  let accounts = [...(data.accounts||[])];
  const typeGrid  = document.getElementById('account-type-grid');
  const formsWrap = document.getElementById('account-forms');

  function refreshForms() {
    formsWrap.innerHTML = accounts.map(a=>renderAccountForm(a)).join('');
    formsWrap.querySelectorAll('[data-remove-account]').forEach(btn => btn.addEventListener('click', () => {
      accounts = accounts.filter(a=>a.type!==btn.dataset.removeAccount);
      typeGrid.querySelector(`[data-account-type="${btn.dataset.removeAccount}"]`)?.classList.remove('selected');
      refreshForms();
    }));
  }

  typeGrid.addEventListener('click', e => {
    const card = e.target.closest('[data-account-type]');
    if (!card) return;
    const type = card.dataset.accountType;
    if (accounts.find(a=>a.type===type)) {
      accounts = accounts.filter(a=>a.type!==type); card.classList.remove('selected');
    } else {
      accounts.push({ type, name:Utils.getAccountType(type).name, balance:0 }); card.classList.add('selected');
    }
    refreshForms();
  });

  document.getElementById('step2-next').addEventListener('click', () => {
    if (!accounts.length) { Toast.error('Bitte wähle mindestens ein Konto.'); return; }
    formsWrap.querySelectorAll('[data-account-form]').forEach(form => {
      const acc = accounts.find(a=>a.type===form.dataset.accountForm);
      if (!acc) return;
      acc.name    = form.querySelector('[data-field="name"]')?.value.trim() || acc.name;
      acc.balance = parseFloat(form.querySelector('[data-field="balance"]')?.value)||0;
    });
    renderStep(app, 3, { ...data, accounts });
  });
}

// ── Schritt 3: Kategorien ──
function renderCategoriesStep(data) {
  return `
    <h2>Kategorien & Budget</h2>
    <p>Standard-Kategorien wurden vorbereitet – du kannst sie jederzeit anpassen.</p>
    <div style="display:flex;flex-direction:column;gap:6px;margin:var(--space-md) 0">
      ${Utils.DEFAULT_CATEGORIES.filter(c=>!c.isIncome).map(cat=>`
        <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;
                    background:var(--bg-elevated);border-radius:var(--radius-md)">
          <span style="font-size:1.15rem">${cat.icon}</span>
          <span style="flex:1;font-size:0.88rem">${cat.name}</span>
          ${cat.budget?`<span class="tag tag-amber">${Utils.formatCurrency(cat.budget)}/Mo.</span>`:''}
        </div>`).join('')}
    </div>
    <button class="btn btn-primary btn-full btn-lg" id="step3-finish">
      Einrichtung abschließen ✓
    </button>`;
}

function bindCategoriesStep(app, data) {
  document.getElementById('step3-finish').addEventListener('click', async () => {
    const btn = document.getElementById('step3-finish');
    btn.disabled = true; btn.textContent = 'Wird gespeichert…';
    try {
      await finishSetup(data);
      Toast.success('Einrichtung abgeschlossen!');
      await State.loadAll();
      Router.navigate('login');
    } catch(err) {
      Toast.error('Fehler: '+err.message);
      btn.disabled = false; btn.textContent = 'Einrichtung abschließen ✓';
    }
  });
}

async function finishSetup(data) {
  const { members, accounts } = data;
  const savedUsers = [];
  for (const m of members) {
    const id = await DB.add('users',{ name:m.name, isAdmin:m.isAdmin, canLogin:m.canLogin, color:m.color, avatar:null });
    savedUsers.push({ ...m, id });
  }
  const admin = savedUsers.find(u=>u.isAdmin);
  for (const acc of accounts) {
    await DB.add('accounts',{
      userId:admin.id, type:acc.type, name:acc.name,
      balance:Math.abs(acc.balance), color:Utils.getAccountType(acc.type).color,
      includeInAnalysis:true,
    });
  }
  for (const cat of Utils.DEFAULT_CATEGORIES) {
    await DB.add('categories',{ name:cat.name, icon:cat.icon, color:cat.color, budget:cat.budget, isIncome:cat.isIncome||false });
  }
  await DB.setSetting('setupDone', true);
}

// ── Konto-Setup für nicht-Admin-User ──
async function renderAccountSetup(app, userId) {
  const user = await DB.getById('users', userId);
  app.innerHTML = `
    <div class="setup-page animate-fade">
      <h2>Hallo, ${user?.name||''}!</h2>
      <p style="margin-top:8px">Richte deine Konten ein um zu starten.</p>
      <div class="account-type-grid" id="account-type-grid" style="margin-top:var(--space-lg)">
        ${Utils.ACCOUNT_TYPES.map(t=>`
          <div class="account-type-card" data-account-type="${t.id}">
            <span class="account-type-icon">${t.icon}</span>
            <span class="account-type-name">${t.name}</span>
          </div>`).join('')}
      </div>
      <div id="account-forms" style="margin-top:16px;display:flex;flex-direction:column;gap:10px"></div>
      <button class="btn btn-primary btn-full btn-lg" id="user-accounts-finish" style="margin-top:16px">
        Zum Dashboard →
      </button>
    </div>`;

  let accounts = [];
  const typeGrid  = document.getElementById('account-type-grid');
  const formsWrap = document.getElementById('account-forms');

  function refreshForms() {
    formsWrap.innerHTML = accounts.map(a=>renderAccountForm(a)).join('');
    formsWrap.querySelectorAll('[data-remove-account]').forEach(btn => btn.addEventListener('click', () => {
      accounts = accounts.filter(a=>a.type!==btn.dataset.removeAccount);
      typeGrid.querySelector(`[data-account-type="${btn.dataset.removeAccount}"]`)?.classList.remove('selected');
      refreshForms();
    }));
  }

  typeGrid.addEventListener('click', e => {
    const card = e.target.closest('[data-account-type]');
    if (!card) return;
    const type = card.dataset.accountType;
    if (accounts.find(a=>a.type===type)) {
      accounts = accounts.filter(a=>a.type!==type); card.classList.remove('selected');
    } else {
      accounts.push({ type, name:Utils.getAccountType(type).name, balance:0 }); card.classList.add('selected');
    }
    refreshForms();
  });

  document.getElementById('user-accounts-finish').addEventListener('click', async () => {
    formsWrap.querySelectorAll('[data-account-form]').forEach(form => {
      const acc = accounts.find(a=>a.type===form.dataset.accountForm);
      if (!acc) return;
      acc.name    = form.querySelector('[data-field="name"]')?.value.trim() || acc.name;
      acc.balance = parseFloat(form.querySelector('[data-field="balance"]')?.value)||0;
    });
    for (const acc of accounts) {
      await DB.add('accounts',{ ...acc, userId, balance:Math.abs(acc.balance),
        color:Utils.getAccountType(acc.type).color, includeInAnalysis:true });
    }
    State.set({ currentUser: user });
    await State.loadAll();
    Navbar.mount(); Navbar.setActive('dashboard');
    Router.navigate('dashboard');
  });
}
