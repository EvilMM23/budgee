/**
 * views/dashboard.js – Haupt-Dashboard
 * iPad-Landscape-Layout: Links Saldo + Transaktionen, Rechts Charts
 */

Router.register('dashboard', async (app) => {
  const user       = State.get('currentUser');
  const categories = State.get('categories');
  const scope      = State.get('viewScope');
  const month      = State.get('selectedMonth');

  if (!user) { Router.navigate('login'); return; }

  Navbar.setActive('dashboard');

  const txs     = State.getFilteredTransactions({ month });
  const period  = State.getBudgetPeriod(State.get('paycheckAnchor'));
  const txs     = State.getFilteredTransactions({ period });
  const income  = State.sumTransactions(txs, 'income');
  const expense = State.sumTransactions(txs, 'expense');
  const balance = income - expense;

  // Ausgaben nach Kategorie
  const catMap = {};
  txs.filter(t => t.type === 'expense').forEach(t => {
    catMap[t.categoryId] = (catMap[t.categoryId] || 0) + t.amount;
  });

  const chartData = Object.entries(catMap)
    .map(([id, value]) => {
      const cat = categories.find(c => c.id === +id);
      return { label: cat?.name || '?', value, color: cat?.color || '#B5A896', icon: cat?.icon || '•' };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 7);

  const isPositive = balance >= 0;

  app.innerHTML = `
    <div class="page">

      <!-- Header -->
      <div class="page-header" style="position:sticky;top:0;z-index:10;background:var(--bg-base)">
        <div>
          <p class="dashboard-greeting">${getGreeting()}</p>
          <h2 class="dashboard-name">${scope === 'household' ? 'Haushalt' : user.name}</h2>
        </div>
        <div style="display:flex;align-items:center;gap:12px">
          <!-- Scope Toggle -->
          <div class="toggle-wrap">
            <div class="toggle-opt ${scope === 'personal'   ? 'active' : ''}" data-scope="personal">Persönlich</div>
            <div class="toggle-opt ${scope === 'household'  ? 'active' : ''}" data-scope="household">Haushalt</div>
          </div>
          <!-- Avatar -->
          <div class="avatar avatar-md" style="background:${user.color || 'var(--bg-elevated)'}">
            ${user.avatar
              ? `<img src="${user.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
              : Utils.initials(user.name)}
          </div>
        </div>
      </div>

      <!-- Monat-Navigator -->
      <div class="month-navigator" style="padding:var(--space-sm) var(--space-lg)">
        <button class="month-nav-btn" id="prev-month">←</button>
        <span class="month-label">${Utils.formatMonth(month)}</span>
        <button class="month-nav-btn" id="next-month"
          ${month >= Utils.currentMonth() ? 'disabled style="opacity:0.3;pointer-events:none"' : ''}>→</button>
      </div>

      <!-- Landscape 2-Spalten Grid -->
      <div class="page-content landscape-grid" style="padding-top:0">

        <!-- LINKE SPALTE: Saldo + Transaktionen -->
        <div style="display:flex;flex-direction:column;gap:var(--space-md)">

          <!-- Saldo-Karte -->
          <div class="balance-card animate-slide">
            <p class="balance-label">Saldo ${scope === 'household' ? '· Haushalt' : ''}</p>
            <p class="balance-amount ${isPositive ? 'positive' : 'negative'}">
              ${Utils.formatCurrency(balance, true)}
            </p>
            <div class="balance-stats">
              <div>
                <p class="balance-stat-label">↑ Einnahmen</p>
                <p class="balance-stat-value" style="color:var(--blue-light)">${Utils.formatCurrency(income)}</p>
              </div>
              <div>
                <p class="balance-stat-label">↓ Ausgaben</p>
                <p class="balance-stat-value" style="color:var(--sand)">${Utils.formatCurrency(expense)}</p>
              </div>
            </div>
          </div>

          <!-- Letzte Transaktionen -->
          <div class="card animate-slide" style="animation-delay:80ms;flex:1">
            <div class="section-header">
              <h3 class="section-title">Umsätze</h3>
              <button class="btn btn-ghost btn-sm" id="goto-analytics">Alle →</button>
            </div>
            <div class="transactions-section" id="tx-list">
              ${renderTransactionList(txs.slice(0, 20), categories)}
            </div>
          </div>

          <!-- Budget-Hinweis -->
          <div class="budget-nav-hint" id="goto-budget">
            Budget-Übersicht <span>→</span>
          </div>
        </div>

        <!-- RECHTE SPALTE: Charts -->
        <div style="display:flex;flex-direction:column;gap:var(--space-md)">

          <!-- Donut Chart -->
          <div class="chart-card animate-slide" style="animation-delay:40ms">
            <div class="section-header">
              <h3 class="section-title">Ausgaben nach Kategorie</h3>
            </div>
            ${chartData.length === 0 ? `
              <div class="empty-state" style="padding:var(--space-xl) 0">
                <div class="empty-icon">📊</div>
                <p>Noch keine Ausgaben</p>
              </div>
            ` : `
              <div style="display:flex;flex-direction:column;align-items:center;gap:var(--space-md)">
                <div style="width:160px;height:160px">
                  <canvas id="donut-chart" style="width:160px;height:160px"></canvas>
                </div>
                <div style="width:100%" id="donut-legend">
                  ${Chart.renderLegend(chartData, expense)}
                </div>
              </div>
            `}
          </div>

          <!-- Monatsverlauf (Linien) -->
          <div class="chart-card animate-slide" style="animation-delay:120ms">
            <h3 class="section-title" style="margin-bottom:var(--space-md)">Ausgaben – letzte 6 Monate</h3>
            <div style="height:110px">
              <canvas id="line-chart" style="width:100%;height:110px"></canvas>
            </div>
          </div>

          <!-- Schnell-Statistiken -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-sm)">
            ${[
              ['Ø pro Tag',   Utils.formatCompact(expense / new Date().getDate()), 'var(--color-expense)'],
              ['Konten',      State.get('accounts').filter(a => a.userId === user.id).length + ' aktiv', 'var(--steel)'],
            ].map(([label, val, col]) => `
              <div class="card card-sm animate-slide" style="text-align:center">
                <p class="text-xs text-muted">${label}</p>
                <p style="font-size:1rem;font-weight:600;color:${col};margin-top:4px">${val}</p>
              </div>
            `).join('')}
          </div>

        </div>
      </div>
    </div>

    <!-- FAB -->
    <button class="fab" id="add-tx-btn" title="Transaktion hinzufügen">+</button>
  `;

  // Charts zeichnen
  requestAnimationFrame(() => {
    // Donut
    const dc = document.getElementById('donut-chart');
    if (dc && chartData.length) {
      Chart.drawDonut(dc, chartData, Utils.formatCompact(expense), 'Ausgaben');
    }
    // Linie
    const lc = document.getElementById('line-chart');
    if (lc) {
      const lineData = buildMonthlyLineData(scope === 'household' ? null : user.id);
      Chart.drawLine(lc, lineData, '#7791A0');
    }
  });

  // Events
  document.querySelectorAll('[data-scope]').forEach(opt =>
    opt.addEventListener('click', () => { State.set({ viewScope: opt.dataset.scope }); Router.navigate('dashboard'); })
  );
  document.getElementById('prev-month')?.addEventListener('click', () => {
    State.set({ selectedMonth: Utils.addMonths(month, -1) }); Router.navigate('dashboard');
  });
  document.getElementById('next-month')?.addEventListener('click', () => {
    State.set({ selectedMonth: Utils.addMonths(month, 1) }); Router.navigate('dashboard');
  });
  document.getElementById('add-tx-btn')?.addEventListener('click', () => openTransactionForm());
  document.getElementById('goto-budget')?.addEventListener('click', () => {
    State.set({ activeTab: 'budget' }); Navbar.setActive('budget'); Router.navigate('budget');
  });
  document.getElementById('goto-analytics')?.addEventListener('click', () => {
    State.set({ activeTab: 'analytics' }); Navbar.setActive('analytics'); Router.navigate('analytics');
  });
  document.getElementById('tx-list')?.addEventListener('click', (e) => {
    const item = e.target.closest('[data-tx-id]');
    if (!item) return;
    const tx = State.get('transactions').find(t => t.id === +item.dataset.txId);
    if (tx) openTransactionForm(tx);
  });
});

function renderTransactionList(txs, categories) {
  if (!txs.length) return `
    <div class="empty-state" style="padding:var(--space-xl) 0">
      <div class="empty-icon">💳</div>
      <p>Noch keine Transaktionen</p>
      <p class="text-xs text-muted" style="margin-top:4px">Tippe auf + zum Hinzufügen</p>
    </div>`;

  const sorted = [...txs].sort((a, b) => b.date.localeCompare(a.date));
  const groups = {};
  sorted.forEach(tx => { (groups[tx.date] = groups[tx.date] || []).push(tx); });

  return Object.entries(groups).map(([date, dayTxs]) => `
    <div class="day-separator">${Utils.formatDate(date, 'relative')}</div>
    ${dayTxs.map(tx => renderTxItem(tx, categories)).join('')}
  `).join('');
}

function renderTxItem(tx, categories) {
  const cat   = categories.find(c => c.id === tx.categoryId);
  const color = cat?.color || '#B5A896';
  const isIncoming = tx.type === 'transfer' && tx._transferDirection === 'incoming';
  const displayType = isIncoming ? 'income' : tx.type;

  let label = tx.note || cat?.name || 'Transaktion';
  if (tx.type === 'transfer') {
    const allUsers    = State.get('users');
    const allAccounts = State.get('accounts');
    if (isIncoming) {
      const sender = allUsers.find(u => u.id === tx.userId);
      label = tx.note || `⇄ Eingang von ${sender?.name || 'Mitglied'}`;
    } else {
      const toAcc  = allAccounts.find(a => a.id === tx.toAccountId);
      const toUser = toAcc ? allUsers.find(u => u.id === toAcc.userId) : null;
      label = tx.note || (toUser && toUser.id !== State.get('currentUser')?.id
        ? `⇄ an ${toUser.name}` : '⇄ Übertrag');
    }
  }

  return `
    <div class="transaction-item" data-tx-id="${tx.id}">
      <div class="transaction-icon" style="background:${color}18;color:${color}">
        ${tx.type === 'transfer' ? '⇄' : (cat?.icon || '•')}
      </div>
      <div class="transaction-info">
        <p class="transaction-name">${label}</p>
        <p class="transaction-meta">${cat?.name || (tx.type === 'transfer' ? 'Übertrag' : '–')}</p>
      </div>
      <div class="transaction-amount" style="color:${Utils.typeColor(displayType)}">
        ${Utils.typeSign(displayType, tx.amount)}
      </div>
    </div>`;
}

function buildMonthlyLineData(userId) {
  return Array.from({ length: 6 }, (_, i) => Utils.addMonths(Utils.currentMonth(), i - 5))
    .map(m => {
      const txs   = State.getFilteredTransactions({ month: m, userId, type: 'expense' });
      const total = txs.reduce((s, t) => s + t.amount, 0);
      return { label: Utils.formatMonth(m).split(' ')[0].slice(0, 3), value: total };
    });
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Guten Morgen,';
  if (h < 18) return 'Guten Tag,';
  return 'Guten Abend,';
}
