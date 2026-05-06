/**
 * views/analytics.js – Analyse
 * Landscape: Links Filter + Transaktionen, Rechts Charts
 */

Router.register('analytics', async (app) => {
  const user = State.get('currentUser');
  if (!user) { Router.navigate('login'); return; }
  Navbar.setActive('analytics');

  let filters = {
    search:     '',
    type:       'all',
    categoryId: null,
    tagId:      null,
    month:      State.get('selectedMonth'),
  };

  function render() {
    const categories = State.get('categories');
    const scope      = State.get('viewScope');
    const txs        = getFilteredTxs();
    const income     = State.sumTransactions(txs, 'income');
    const expense    = State.sumTransactions(txs, 'expense');
    const lineData   = buildMonthlyLineData(scope === 'household' ? null : user.id);
    const barData    = buildCategoryBarData(txs, categories);

    app.innerHTML = `
      <div class="page">
        <div class="page-header">
          <div>
            <h2>Analyse</h2>
            <p class="text-muted text-sm" style="margin-top:3px">${Utils.formatMonth(filters.month)}</p>
          </div>
          <div style="display:flex;align-items:center;gap:12px">
            <div class="toggle-wrap">
              <div class="toggle-opt ${scope==='personal'  ?'active':''}" data-scope="personal">Ich</div>
              <div class="toggle-opt ${scope==='household' ?'active':''}" data-scope="household">Haushalt</div>
            </div>
            <div class="month-navigator" style="padding:0;gap:8px;display:flex">
              <button class="month-nav-btn" id="prev-month">←</button>
              <button class="month-nav-btn" id="next-month"
                ${filters.month>=Utils.currentMonth()?'disabled style="opacity:0.3;pointer-events:none"':''}>→</button>
            </div>
          </div>
        </div>

        <div class="page-content landscape-grid" style="padding-top:var(--space-md)">

          <!-- LINKS: Filter + Transaktionen -->
          <div style="display:flex;flex-direction:column;gap:var(--space-md)">

            <!-- Suche -->
            <div class="analytics-search">
              <span class="search-icon">🔍</span>
              <input type="search" id="search-input" placeholder="Notiz, Kategorie, Tag…" value="${filters.search}" />
            </div>

            <!-- Typ-Filter -->
            <div class="analytics-filters">
              ${[['all','● Alle'],['expense','↓ Ausgaben'],['income','↑ Einnahmen'],['transfer','⇄ Überträge']]
                .map(([val,label]) => `
                  <div class="filter-chip ${filters.type===val?'active':''}" data-type-filter="${val}">${label}</div>
                `).join('')}
            </div>

            <!-- Kategorie-Filter -->
            <div class="analytics-filters">
              <div class="filter-chip ${!filters.categoryId?'active':''}" data-cat-filter="">Alle</div>
              ${categories.map(cat => `
                <div class="filter-chip ${filters.categoryId===cat.id?'active':''}" data-cat-filter="${cat.id}">
                  ${cat.icon} ${cat.name}
                </div>`).join('')}
            </div>

            <!-- Zusammenfassung -->
            <div class="landscape-grid-3">
              ${[
                ['↑ Einnahmen', income,          'var(--color-income)'],
                ['↓ Ausgaben',  expense,         'var(--color-expense)'],
                ['= Bilanz',    income-expense,  income-expense>=0?'var(--color-income)':'var(--color-expense)'],
              ].map(([label,val,col]) => `
                <div class="card card-sm" style="text-align:center">
                  <p class="text-xs text-muted">${label}</p>
                  <p style="font-size:0.92rem;font-weight:600;color:${col};margin-top:4px">${Utils.formatCompact(val)}</p>
                </div>`).join('')}
            </div>

            <!-- Transaktionen -->
            <div class="card" style="flex:1;overflow:hidden">
              <div class="section-header">
                <h3 class="section-title">Transaktionen (${txs.length})</h3>
              </div>
              <div id="analytics-tx-list" style="max-height:400px;overflow-y:auto">
                ${renderAnalyticsList(txs, categories)}
              </div>
            </div>

          </div>

          <!-- RECHTS: Charts -->
          <div style="display:flex;flex-direction:column;gap:var(--space-md)">

            <!-- Verlaufs-Chart -->
            <div class="chart-card">
              <h3 class="section-title" style="margin-bottom:var(--space-md)">Ausgaben – 6 Monate</h3>
              <div style="height:130px">
                <canvas id="line-chart" style="width:100%;height:130px"></canvas>
              </div>
            </div>

            <!-- Balken-Chart -->
            ${expense > 0 ? `
            <div class="chart-card">
              <h3 class="section-title" style="margin-bottom:var(--space-md)">Nach Kategorie</h3>
              <div style="height:${Math.min(260, barData.length * 34 + 20)}px">
                <canvas id="bar-chart" style="width:100%;height:100%"></canvas>
              </div>
            </div>
            ` : ''}

            <!-- Top-Ausgabe -->
            ${txs.filter(t=>t.type==='expense').length ? (() => {
              const top = [...txs].filter(t=>t.type==='expense').sort((a,b)=>b.amount-a.amount)[0];
              const cat = State.get('categories').find(c=>c.id===top?.categoryId);
              return `
              <div class="card" style="background:var(--sand-dim);border-color:var(--sand-border)">
                <p class="text-xs text-muted" style="margin-bottom:6px">Größte Ausgabe</p>
                <div style="display:flex;align-items:center;justify-content:space-between">
                  <div style="display:flex;align-items:center;gap:10px">
                    <span style="font-size:1.4rem">${cat?.icon || '•'}</span>
                    <div>
                      <p style="font-weight:500;font-size:0.9rem">${top.note || cat?.name || '–'}</p>
                      <p class="text-xs text-muted">${Utils.formatDate(top.date,'short')}</p>
                    </div>
                  </div>
                  <p style="font-weight:700;font-size:1.1rem;color:var(--color-expense)">
                    ${Utils.formatCurrency(top.amount)}
                  </p>
                </div>
              </div>`;
            })() : ''}

          </div>
        </div>
      </div>

      <button class="fab" id="add-tx-btn">+</button>
    `;

    // Charts
    requestAnimationFrame(() => {
      const lc = document.getElementById('line-chart');
      if (lc) Chart.drawLine(lc, lineData, '#7791A0');
      const bc = document.getElementById('bar-chart');
      if (bc && barData.length) Chart.drawBars(bc, barData);
    });

    bindEvents();
  }

  function bindEvents() {
    // Suche
    document.getElementById('search-input')?.addEventListener('input',
      Utils.debounce(e => { filters.search = e.target.value.trim().toLowerCase(); updateList(); }, 250)
    );

    // Typ
    document.querySelectorAll('[data-type-filter]').forEach(chip =>
      chip.addEventListener('click', () => {
        filters.type = chip.dataset.typeFilter;
        document.querySelectorAll('[data-type-filter]').forEach(c =>
          c.classList.toggle('active', c.dataset.typeFilter === filters.type));
        updateList();
      })
    );

    // Kategorie
    document.querySelectorAll('[data-cat-filter]').forEach(chip =>
      chip.addEventListener('click', () => {
        filters.categoryId = chip.dataset.catFilter ? +chip.dataset.catFilter : null;
        document.querySelectorAll('[data-cat-filter]').forEach(c =>
          c.classList.toggle('active',
            c.dataset.catFilter === '' ? !filters.categoryId : +c.dataset.catFilter === filters.categoryId));
        updateList();
      })
    );

    // Scope
    document.querySelectorAll('[data-scope]').forEach(opt =>
      opt.addEventListener('click', () => { State.set({ viewScope: opt.dataset.scope }); render(); })
    );

    // Monat
    document.getElementById('prev-month')?.addEventListener('click', () => {
      filters.month = Utils.addMonths(filters.month, -1);
      State.set({ selectedMonth: filters.month }); render();
    });
    document.getElementById('next-month')?.addEventListener('click', () => {
      filters.month = Utils.addMonths(filters.month, 1);
      State.set({ selectedMonth: filters.month }); render();
    });

    // FAB
    document.getElementById('add-tx-btn')?.addEventListener('click', () => openTransactionForm());

    // TX klicken
    bindTxList();
  }

  function bindTxList() {
    document.getElementById('analytics-tx-list')?.addEventListener('click', e => {
      const item = e.target.closest('[data-tx-id]');
      if (!item) return;
      const tx = State.get('transactions').find(t => t.id === +item.dataset.txId);
      if (tx) openTransactionForm(tx);
    });
  }

  function updateList() {
    const cats = State.get('categories');
    const txs  = getFilteredTxs();
    const list = document.getElementById('analytics-tx-list');
    if (list) list.innerHTML = renderAnalyticsList(txs, cats);
    bindTxList();
  }

  function getFilteredTxs() {
    const currentScope = State.get('viewScope');
    const scopeUserId  = currentScope === 'personal' ? user.id : null;
    let txs = State.getFilteredTransactions({ month: filters.month, userId: scopeUserId });

    if (filters.type !== 'all')  txs = txs.filter(t => t.type === filters.type);
    if (filters.categoryId)      txs = txs.filter(t => t.categoryId === filters.categoryId);
    if (filters.search) {
      const q    = filters.search;
      const cats = State.get('categories');
      const tags = State.get('tags');
      txs = txs.filter(t => {
        const cat = cats.find(c => c.id === t.categoryId);
        return (
          t.note?.toLowerCase().includes(q) ||
          cat?.name.toLowerCase().includes(q) ||
          tags.filter(tag => t.tagIds?.includes(tag.id)).some(tag => tag.name.toLowerCase().includes(q))
        );
      });
    }
    return txs.sort((a, b) => b.date.localeCompare(a.date));
  }

  render();
});

function renderAnalyticsList(txs, categories) {
  if (!txs.length) return `
    <div class="empty-state" style="padding:var(--space-xl) 0">
      <div class="empty-icon">🔍</div><p>Keine Transaktionen gefunden</p>
    </div>`;

  const allAccounts = State.get('accounts');
  const allUsers    = State.get('users');
  const currentUser = State.get('currentUser');

  return txs.map(tx => {
    const cat   = categories.find(c => c.id === tx.categoryId);
    const color = cat?.color || '#B5A896';
    const isIncoming    = tx.type === 'transfer' && tx._transferDirection === 'incoming';
    const displayType   = isIncoming ? 'income' : tx.type;

    let label = tx.note || cat?.name || '–';
    if (tx.type === 'transfer') {
      if (isIncoming) {
        const sender = allUsers.find(u => u.id === tx.userId);
        label = tx.note || `⇄ Eingang von ${sender?.name || 'Mitglied'}`;
      } else {
        const toAcc  = allAccounts.find(a => a.id === tx.toAccountId);
        const toUser = toAcc ? allUsers.find(u => u.id === toAcc.userId) : null;
        label = tx.note || (toUser && toUser.id !== currentUser?.id ? `⇄ an ${toUser.name}` : '⇄ Übertrag');
      }
    }

    return `
      <div class="transaction-item" data-tx-id="${tx.id}">
        <div class="transaction-icon" style="background:${color}18;color:${color}">
          ${tx.type==='transfer'?'⇄':(cat?.icon||'•')}
        </div>
        <div class="transaction-info">
          <p class="transaction-name">${label}</p>
          <p class="transaction-meta">${Utils.formatDate(tx.date,'short')} · ${cat?.name||(tx.type==='transfer'?'Übertrag':'–')}</p>
        </div>
        <p class="transaction-amount" style="color:${Utils.typeColor(displayType)}">
          ${Utils.typeSign(displayType, tx.amount)}
        </p>
      </div>`;
  }).join('');
}

function buildMonthlyLineData(userId) {
  return Array.from({length:6},(_,i) => Utils.addMonths(Utils.currentMonth(), i-5))
    .map(m => {
      const txs   = State.getFilteredTransactions({ month:m, userId, type:'expense' });
      const total = txs.reduce((s,t) => s+t.amount, 0);
      return { label: Utils.formatMonth(m).split(' ')[0].slice(0,3), value: total };
    });
}

function buildCategoryBarData(txs, categories) {
  const map = {};
  txs.filter(t => t.type==='expense').forEach(t => { map[t.categoryId] = (map[t.categoryId]||0) + t.amount; });
  return Object.entries(map)
    .map(([id,value]) => {
      const cat = categories.find(c => c.id===+id);
      return { label: cat?.name||'?', value, color: cat?.color||'#B5A896' };
    })
    .sort((a,b) => b.value-a.value).slice(0,8);
}
