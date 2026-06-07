/**
 * views/budget.js – Budget-Übersicht
 * Landscape: Links Gesamt-Stats + Donut, Rechts Kategorie-Liste
 */

Router.register('budget', async (app) => {
  const user       = State.get('currentUser');
  const categories = State.get('categories').filter(c => !c.isIncome);
  const month      = State.get('selectedMonth');

  if (!user) { Router.navigate('login'); return; }
  Navbar.setActive('budget');

  const txs           = State.getFilteredTransactions({ month, type: 'expense' });
  const period        = State.getBudgetPeriod(State.get('paycheckAnchor'));
  const txs           = State.getFilteredTransactions({ period });
  const totalExpense  = txs.reduce((s, t) => s + t.amount, 0);
  const totalBudget   = categories.reduce((s, c) => s + (c.budget || 0), 0);
  const remaining     = Math.max(0, totalBudget - totalExpense);
  const totalPct      = Utils.percent(totalExpense, totalBudget);

  const catData = categories.map(cat => {
    const spent = txs.filter(t => t.categoryId === cat.id).reduce((s, t) => s + t.amount, 0);
    return { ...cat, spent, pct: Utils.percent(spent, cat.budget || 0) };
  }).sort((a, b) => b.spent - a.spent);

  // Donut-Daten für Budget-Aufteilung
  const donutData = catData
    .filter(c => c.budget > 0)
    .map(c => ({ label: c.name, value: c.budget, color: c.color }));

  app.innerHTML = `
    <div class="page">
      <div class="page-header">
        <div>
          <h2>Budget</h2>
          <p class="text-muted text-sm" style="margin-top:3px">${Utils.formatMonth(month)}</p>
        </div>
        <div style="display:flex;align-items:center;gap:12px">
          <div class="month-navigator" style="padding:0">
            <button class="month-nav-btn" id="prev-month" style="margin-right:8px">←</button>
            <button class="month-nav-btn" id="next-month"
              ${month >= Utils.currentMonth() ? 'disabled style="opacity:0.3;pointer-events:none"' : ''}>→</button>
          </div>
        </div>
      </div>

      <div class="page-content landscape-grid" style="padding-top:var(--space-md)">

        <!-- LINKS: Gesamt + Donut -->
        <div style="display:flex;flex-direction:column;gap:var(--space-md)">

          <!-- Gesamt-Karte (Navy) -->
          <div class="balance-card animate-slide">
            <p class="balance-label">Gesamtbudget ${Utils.formatMonth(month)}</p>
            <p class="balance-amount" style="color:#FFF">
              ${Utils.formatCurrency(totalExpense)}
              <span style="font-size:1rem;opacity:0.5;font-family:var(--font-body)"> / ${Utils.formatCurrency(totalBudget)}</span>
            </p>
            <div class="balance-stats">
              <div>
                <p class="balance-stat-label">Verbleibend</p>
                <p class="balance-stat-value" style="color:var(--blue-light)">${Utils.formatCurrency(remaining)}</p>
              </div>
              <div>
                <p class="balance-stat-label">Auslastung</p>
                <p class="balance-stat-value" style="color:${totalPct >= 100 ? 'var(--sand)' : 'rgba(247,245,242,0.9)'}">${totalPct}%</p>
              </div>
            </div>
          </div>

          <!-- Gesamtfortschritt -->
          <div class="card animate-slide" style="animation-delay:40ms">
            <div style="display:flex;justify-content:space-between;margin-bottom:10px">
              <span class="text-sm" style="font-weight:500">Gesamtbudget</span>
              <span class="text-sm text-muted">${totalPct}% genutzt</span>
            </div>
            <div class="progress-bar" style="height:10px">
              <div class="progress-fill ${Utils.progressColor(totalPct)}"
                   style="width:${Math.min(100,totalPct)}%"></div>
            </div>
          </div>

          <!-- Budget-Donut -->
          ${donutData.length ? `
          <div class="chart-card animate-slide" style="animation-delay:80ms">
            <h3 class="section-title" style="margin-bottom:var(--space-md)">Budget-Verteilung</h3>
            <div style="display:flex;flex-direction:column;align-items:center;gap:var(--space-md)">
              <div style="width:150px;height:150px">
                <canvas id="budget-donut" style="width:150px;height:150px"></canvas>
              </div>
              <div style="width:100%">
                ${Chart.renderLegend(donutData, totalBudget)}
              </div>
            </div>
          </div>
          ` : ''}

        </div>

        <!-- RECHTS: Kategorie-Karten -->
        <div style="display:flex;flex-direction:column;gap:var(--space-sm)">
          <h3 class="section-title" style="padding:0 2px var(--space-sm)">Kategorien</h3>

          <div class="budget-cats-grid stagger">
            ${catData.map((cat, i) => renderBudgetCard(cat, i)).join('')}
          </div>

          ${categories.every(c => !c.budget) ? `
            <div class="card" style="border-style:dashed;text-align:center;padding:var(--space-xl)">
              <p class="text-muted text-sm">Noch kein Budget definiert.</p>
              <button class="btn btn-secondary btn-sm" style="margin-top:12px" id="goto-settings">
                ⚙ Einstellungen
              </button>
            </div>
          ` : ''}
        </div>

      </div>
    </div>

    <button class="fab" id="add-tx-btn">+</button>
  `;

  // Donut zeichnen
  requestAnimationFrame(() => {
    const dc = document.getElementById('budget-donut');
    if (dc && donutData.length) {
      Chart.drawDonut(dc, donutData, Utils.formatCompact(totalBudget), 'Budget');
    }
  });

  // Events
  document.getElementById('prev-month')?.addEventListener('click', () => {
    State.set({ selectedMonth: Utils.addMonths(month, -1) }); Router.navigate('budget');
  });
  document.getElementById('next-month')?.addEventListener('click', () => {
    State.set({ selectedMonth: Utils.addMonths(month, 1) }); Router.navigate('budget');
  });
  document.getElementById('add-tx-btn')?.addEventListener('click', () => openTransactionForm());
  document.getElementById('goto-settings')?.addEventListener('click', () => {
    State.set({ activeTab: 'settings' }); Navbar.setActive('settings'); Router.navigate('settings');
  });

  app.querySelectorAll('[data-cat-id]').forEach(card =>
    card.addEventListener('click', () => {
      const cat = catData.find(c => c.id === +card.dataset.catId);
      if (cat) openBudgetDetail(cat, txs.filter(t => t.categoryId === cat.id));
    })
  );
});

function renderBudgetCard(cat, index) {
  const hasBudget = cat.budget > 0;
  const barClass  = Utils.progressColor(cat.pct);

  return `
    <div class="budget-category-card animate-slide" style="animation-delay:${index*35}ms" data-cat-id="${cat.id}">
      <div class="budget-cat-header">
        <div class="budget-cat-info">
          <div class="budget-cat-icon" style="background:${cat.color}18;color:${cat.color}">${cat.icon}</div>
          <div>
            <p style="font-weight:500;font-size:0.9rem">${cat.name}</p>
            <p class="budget-cat-limit">${hasBudget ? Utils.formatCurrency(cat.budget)+'/Mo.' : 'Kein Budget'}</p>
          </div>
        </div>
        <div class="budget-cat-amounts">
          <p class="budget-cat-spent" style="color:${cat.spent > 0 ? 'var(--text-primary)' : 'var(--text-muted)'}">${Utils.formatCurrency(cat.spent)}</p>
          ${hasBudget ? `<p class="budget-percentage">${cat.pct}%</p>` : ''}
        </div>
      </div>
      ${hasBudget ? `
        <div class="progress-bar">
          <div class="progress-fill ${barClass}" style="width:${Math.min(100,cat.pct)}%;${!barClass?'background:'+cat.color:''}"></div>
        </div>
      ` : ''}
    </div>`;
}

function openBudgetDetail(cat, catTxs) {
  const sorted = [...catTxs].sort((a, b) => b.date.localeCompare(a.date));
  Modal.open({
    title: `${cat.icon} ${cat.name}`,
    body: `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding:14px;background:var(--bg-elevated);border-radius:12px">
        <div style="width:48px;height:48px;border-radius:12px;background:${cat.color}18;display:flex;align-items:center;justify-content:center;font-size:1.4rem">${cat.icon}</div>
        <div>
          <h3>${cat.name}</h3>
          ${cat.budget ? `<p class="text-sm text-muted">Budget: ${Utils.formatCurrency(cat.budget)}/Monat</p>` : ''}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
        <div class="card card-sm" style="text-align:center">
          <p class="text-xs text-muted">Ausgegeben</p>
          <p style="font-weight:600;color:var(--color-expense);margin-top:4px">${Utils.formatCurrency(cat.spent)}</p>
        </div>
        <div class="card card-sm" style="text-align:center">
          <p class="text-xs text-muted">Verbleibend</p>
          <p style="font-weight:600;color:var(--color-income);margin-top:4px">${cat.budget ? Utils.formatCurrency(Math.max(0,cat.budget-cat.spent)) : '–'}</p>
        </div>
      </div>
      <p style="font-size:0.82rem;font-weight:600;color:var(--text-muted);margin-bottom:8px">Umsätze (${sorted.length})</p>
      <div style="display:flex;flex-direction:column;gap:4px;max-height:280px;overflow-y:auto">
        ${sorted.length === 0 ? '<p class="text-muted text-sm">Keine Transaktionen</p>'
          : sorted.map(tx => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:10px;background:var(--bg-elevated);border-radius:10px">
              <div>
                <p style="font-size:0.88rem">${tx.note || cat.name}</p>
                <p style="font-size:0.73rem;color:var(--text-muted)">${Utils.formatDate(tx.date,'short')}</p>
              </div>
              <p style="font-weight:600;color:var(--color-expense)">−${Utils.formatCurrency(tx.amount)}</p>
            </div>`).join('')}
      </div>`,
  });
}
