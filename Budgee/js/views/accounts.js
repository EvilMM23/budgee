/**
 * views/accounts.js – Konten-Übersicht
 * Landscape: Links Netto-Karte + Konto-Liste, Rechts Detail-Panel
 */

/**
 * Berechneten Kontostand ermitteln (global – wird auch von anderen Views genutzt).
 * Kredit-Konten starten im Minus.
 */
function computeBalance(account, transactions) {
  let balance = account.type === 'credit'
    ? -Math.abs(account.balance)
    : account.balance;

  transactions.forEach(tx => {
    if (tx.accountId === account.id) {
      if (tx.type === 'income')   balance += tx.amount;
      if (tx.type === 'expense')  balance -= tx.amount;
      if (tx.type === 'transfer') balance -= tx.amount;
    }
    if (tx.toAccountId === account.id && tx.type === 'transfer') {
      balance += tx.amount;
    }
  });
  return balance;
}

Router.register('accounts', async (app) => {
  const user = State.get('currentUser');
  if (!user) { Router.navigate('login'); return; }
  Navbar.setActive('accounts');
  render();

  function render() {
    const accounts     = State.get('accounts').filter(a => a.userId === user.id);
    const transactions = State.get('transactions');

    const withBal = accounts.map(acc => ({
      ...acc, computedBalance: computeBalance(acc, transactions),
    }));

    const totalAssets = withBal.filter(a => a.type !== 'credit')
      .reduce((s, a) => s + Math.max(0, a.computedBalance), 0);
    const totalLiab   = withBal.filter(a => a.type === 'credit')
      .reduce((s, a) => s + Math.abs(a.computedBalance), 0);
    const netWorth    = totalAssets - totalLiab;

    app.innerHTML = `
      <div class="page">
        <div class="page-header">
          <h2>Konten</h2>
          <button class="btn btn-secondary btn-sm" id="add-account-btn">+ Konto hinzufügen</button>
        </div>

        <div class="page-content landscape-grid" style="padding-top:var(--space-md)">

          <!-- LINKS: Nettovermögen + Kontoliste -->
          <div style="display:flex;flex-direction:column;gap:var(--space-md)">

            <!-- Netto-Karte -->
            <div class="balance-card animate-slide">
              <p class="balance-label">Nettovermögen</p>
              <p class="balance-amount ${netWorth>=0?'positive':'negative'}">
                ${Utils.formatCurrency(netWorth)}
              </p>
              <div class="balance-stats">
                <div>
                  <p class="balance-stat-label">Vermögen</p>
                  <p class="balance-stat-value" style="color:var(--blue-light)">${Utils.formatCurrency(totalAssets)}</p>
                </div>
                <div>
                  <p class="balance-stat-label">Verbindlichkeiten</p>
                  <p class="balance-stat-value" style="color:var(--sand)">${Utils.formatCurrency(totalLiab)}</p>
                </div>
              </div>
            </div>

            <!-- Kontoliste -->
            ${withBal.length === 0 ? `
              <div class="empty-state">
                <div class="empty-icon">🏦</div>
                <p>Noch keine Konten</p>
                <button class="btn btn-primary" id="add-account-empty">Konto hinzufügen</button>
              </div>
            ` : `
              <div class="stagger" style="display:flex;flex-direction:column;gap:var(--space-sm)">
                ${withBal.map((acc, i) => renderAccountCard(acc, transactions, i)).join('')}
              </div>
            `}

            <div class="card card-sm" style="border-style:dashed;text-align:center">
              <p class="text-xs text-muted">
                💡 Konten per ✎ aus der Analyse ausschließen (z.B. gesperrte Depots)
              </p>
            </div>

          </div>

          <!-- RECHTS: Vermögens-Chart + Aufschlüsselung -->
          <div style="display:flex;flex-direction:column;gap:var(--space-md)">

            <!-- Donut Vermögensverteilung -->
            ${withBal.length > 0 ? (() => {
              const donutData = withBal
                .filter(a => a.computedBalance !== 0)
                .map(a => ({
                  label: a.name,
                  value: Math.abs(a.computedBalance),
                  color: Utils.getAccountType(a.type).color,
                }));
              return `
                <div class="chart-card animate-slide">
                  <h3 class="section-title" style="margin-bottom:var(--space-md)">Verteilung</h3>
                  <div style="display:flex;flex-direction:column;align-items:center;gap:var(--space-md)">
                    <div style="width:150px;height:150px">
                      <canvas id="accounts-donut" style="width:150px;height:150px"></canvas>
                    </div>
                    <div style="width:100%">${Chart.renderLegend(donutData, totalAssets+totalLiab)}</div>
                  </div>
                </div>`;
            })() : ''}

            <!-- Konto-Typ Zusammenfassung -->
            <div class="card animate-slide" style="animation-delay:60ms">
              <h3 class="section-title" style="margin-bottom:var(--space-md)">Nach Typ</h3>
              <div style="display:flex;flex-direction:column;gap:var(--space-sm)">
                ${groupByType(withBal).map(group => `
                  <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
                    <div style="display:flex;align-items:center;gap:10px">
                      <span>${group.icon}</span>
                      <span style="font-size:0.88rem;color:var(--text-secondary)">${group.name}</span>
                    </div>
                    <span style="font-weight:600;font-size:0.92rem;color:${group.total<0?'var(--color-expense)':'var(--text-primary)'}">
                      ${Utils.formatCurrency(group.total)}
                    </span>
                  </div>`).join('')}
              </div>
            </div>

          </div>
        </div>
      </div>

      <button class="fab" id="add-tx-btn">+</button>
    `;

    // Donut zeichnen
    requestAnimationFrame(() => {
      const dc = document.getElementById('accounts-donut');
      if (dc && withBal.length > 0) {
        const donutData = withBal
          .filter(a => a.computedBalance !== 0)
          .map(a => ({ label: a.name, value: Math.abs(a.computedBalance), color: Utils.getAccountType(a.type).color }));
        Chart.drawDonut(dc, donutData, Utils.formatCompact(netWorth), 'Netto');
      }
    });

    // Events
    document.getElementById('add-account-btn')?.addEventListener('click',   () => openAddAccountModal(user.id, render));
    document.getElementById('add-account-empty')?.addEventListener('click', () => openAddAccountModal(user.id, render));
    document.getElementById('add-tx-btn')?.addEventListener('click', () => openTransactionForm());

    app.querySelectorAll('[data-account-detail]').forEach(card =>
      card.addEventListener('click', e => {
        if (e.target.closest('[data-edit-acc]')) return;
        const acc = withBal.find(a => a.id === +card.dataset.accountDetail);
        if (acc) openAccountDetail(acc, transactions);
      })
    );

    app.querySelectorAll('[data-edit-acc]').forEach(btn =>
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const acc = withBal.find(a => a.id === +btn.dataset.editAcc);
        if (acc) openEditAccountModal(acc, render);
      })
    );
  }
});

function groupByType(accounts) {
  const map = {};
  accounts.forEach(acc => {
    const type = Utils.getAccountType(acc.type);
    if (!map[acc.type]) map[acc.type] = { name: type.name, icon: type.icon, total: 0 };
    map[acc.type].total += acc.computedBalance;
  });
  return Object.values(map);
}

function renderAccountCard(acc, transactions, index) {
  const type     = Utils.getAccountType(acc.type);
  const bal      = acc.computedBalance;
  const excluded = acc.includeInAnalysis === false;

  const recentTxs = transactions
    .filter(t => t.accountId === acc.id || t.toAccountId === acc.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);

  return `
    <div class="card animate-slide" style="animation-delay:${index*40}ms;cursor:pointer;${excluded?'opacity:0.55':''}"
         data-account-detail="${acc.id}">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:${recentTxs.length?'12px':'0'}">
        <div style="width:46px;height:46px;border-radius:14px;background:${type.color}18;
                    display:flex;align-items:center;justify-content:center;font-size:1.35rem;flex-shrink:0">
          ${type.icon}
        </div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:6px">
            <p style="font-weight:600;font-size:0.93rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${acc.name}</p>
            ${excluded?'<span class="tag" style="font-size:0.62rem">Analyse aus</span>':''}
          </div>
          <p class="text-xs text-muted">${type.name}</p>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <p style="font-weight:700;font-size:1.05rem;color:${bal<0?'var(--color-expense)':'var(--text-primary)'}">
            ${Utils.formatCurrency(bal)}
          </p>
          ${acc.type==='credit'?'<p class="text-xs" style="color:var(--color-expense)">Schuld</p>':''}
        </div>
        <button class="btn btn-ghost btn-icon btn-sm" data-edit-acc="${acc.id}" style="flex-shrink:0">✎</button>
      </div>

      ${recentTxs.length ? `
        <div style="border-top:1px solid var(--border);padding-top:10px;display:flex;flex-direction:column;gap:3px">
          ${recentTxs.map(tx => {
            const isIncoming = tx.toAccountId === acc.id;
            const col = (tx.type==='income'||isIncoming) ? 'var(--color-income)' : 'var(--color-expense)';
            const cats = State.get('categories');
            const cat  = cats.find(c => c.id === tx.categoryId);
            return `
              <div style="display:flex;justify-content:space-between;align-items:center">
                <span style="font-size:0.79rem;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:65%">
                  ${tx.note||cat?.name||(tx.type==='transfer'?'Übertrag':'–')}
                </span>
                <span style="font-size:0.81rem;font-weight:600;color:${col};flex-shrink:0">
                  ${(tx.type==='income'||isIncoming)?'+':'−'}${Utils.formatCurrency(tx.amount)}
                </span>
              </div>`;
          }).join('')}
        </div>
      ` : ''}
    </div>`;
}

function openAccountDetail(acc, transactions) {
  const type   = Utils.getAccountType(acc.type);
  const cats   = State.get('categories');
  const accTxs = transactions
    .filter(t => t.accountId===acc.id || t.toAccountId===acc.id)
    .sort((a,b) => b.date.localeCompare(a.date));

  const months = [0,1,2].map(i => Utils.addMonths(Utils.currentMonth(),-i)).reverse();
  const monthStats = months.map(m => {
    const mTxs = accTxs.filter(t => t.date?.startsWith(m));
    const in_  = mTxs.filter(t=>t.type==='income'||t.toAccountId===acc.id).reduce((s,t)=>s+t.amount,0);
    const out  = mTxs.filter(t=>(t.type==='expense')||(t.type==='transfer'&&t.accountId===acc.id)).reduce((s,t)=>s+t.amount,0);
    return { month:m, in:in_, out };
  });

  Modal.open({
    title: `${type.icon} ${acc.name}`,
    body: `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px;background:var(--bg-elevated);border-radius:12px;margin-bottom:16px">
        <div>
          <p style="font-weight:600">${acc.name}</p>
          <p class="text-sm text-muted">${type.name} · Start: ${Utils.formatCurrency(acc.balance)}</p>
        </div>
        <p style="font-size:1.3rem;font-weight:700;color:${acc.computedBalance<0?'var(--color-expense)':'var(--color-income)'}">
          ${Utils.formatCurrency(acc.computedBalance)}
        </p>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">
        ${monthStats.map(ms=>`
          <div class="card card-sm" style="text-align:center;padding:10px">
            <p class="text-xs text-muted">${Utils.formatMonth(ms.month).split(' ')[0].slice(0,3)}</p>
            <p style="font-size:0.79rem;color:var(--color-income)">+${Utils.formatCompact(ms.in)}</p>
            <p style="font-size:0.79rem;color:var(--color-expense)">−${Utils.formatCompact(ms.out)}</p>
          </div>`).join('')}
      </div>
      <p style="font-size:0.8rem;font-weight:600;color:var(--text-muted);margin-bottom:8px">
        Alle Umsätze (${accTxs.length})
      </p>
      <div style="display:flex;flex-direction:column;gap:4px;max-height:280px;overflow-y:auto">
        ${accTxs.length===0 ? '<p class="text-muted text-sm">Keine Transaktionen.</p>'
          : accTxs.map(tx => {
              const cat = cats.find(c=>c.id===tx.categoryId);
              const isIncoming = tx.toAccountId===acc.id;
              const col = (tx.type==='income'||isIncoming)?'var(--color-income)':'var(--color-expense)';
              const sign = (tx.type==='income'||isIncoming)?'+':'−';
              const label = tx.type==='transfer'?(isIncoming?'⇄ Eingang':'⇄ Ausgang'):(tx.note||cat?.name||'–');
              return `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:10px;background:var(--bg-elevated);border-radius:10px">
                  <div style="min-width:0">
                    <p style="font-size:0.87rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${label}</p>
                    <p style="font-size:0.73rem;color:var(--text-muted)">${Utils.formatDate(tx.date,'short')}</p>
                  </div>
                  <p style="font-weight:600;color:${col};flex-shrink:0;margin-left:8px">${sign}${Utils.formatCurrency(tx.amount)}</p>
                </div>`;
            }).join('')}
      </div>`,
    actions: [{
      label:'Bearbeiten', class:'btn-secondary', onClick: () => {
        Modal.close();
        openEditAccountModal(acc, () => Router.navigate('accounts'));
      }
    }],
  });
}

function openAddAccountModal(userId, onDone) {
  let selectedType = 'checking';
  Modal.open({
    title:'Konto hinzufügen',
    body:`
      <div class="form-group" style="margin-bottom:14px">
        <label class="form-label">Kontotyp</label>
        <div class="account-type-grid" id="modal-acc-type-grid">
          ${Utils.ACCOUNT_TYPES.map(t=>`
            <div class="account-type-card ${t.id==='checking'?'selected':''}" data-modal-acc-type="${t.id}">
              <span class="account-type-icon">${t.icon}</span>
              <span class="account-type-name">${t.name}</span>
            </div>`).join('')}
        </div>
      </div>
      <div class="form-group" style="margin-bottom:14px">
        <label class="form-label">Name</label>
        <input type="text" id="modal-acc-name" placeholder="z.B. Girokonto DKB" />
      </div>
      <div class="form-group" style="margin-bottom:14px">
        <label class="form-label" id="balance-label">Aktueller Stand (€)</label>
        <div class="input-group">
          <span class="input-prefix">€</span>
          <input type="number" id="modal-acc-balance" placeholder="0,00" step="0.01" />
        </div>
        <p class="text-xs text-muted" id="credit-hint" style="display:none;margin-top:4px">
          💳 Kredit-Konten werden automatisch als negativer Wert geführt.
        </p>
      </div>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.9rem">
        <input type="checkbox" id="modal-acc-include" checked style="width:auto" />
        In Analyse einbeziehen
      </label>`,
    actions:[{
      label:'Hinzufügen', class:'btn-primary', onClick: async () => {
        const name    = document.getElementById('modal-acc-name').value.trim();
        const bal     = parseFloat(document.getElementById('modal-acc-balance').value)||0;
        const include = document.getElementById('modal-acc-include').checked;
        const typeObj = Utils.getAccountType(selectedType);
        await DB.add('accounts',{
          userId, type:selectedType, name:name||typeObj.name,
          balance:Math.abs(bal), color:typeObj.color, includeInAnalysis:include,
        });
        await State.reload(); Modal.close(); Toast.success('Konto hinzugefügt.'); onDone?.();
      }
    }],
  });

  document.getElementById('modal-acc-type-grid')?.addEventListener('click', e => {
    const card = e.target.closest('[data-modal-acc-type]');
    if (!card) return;
    selectedType = card.dataset.modalAccType;
    document.querySelectorAll('[data-modal-acc-type]').forEach(c =>
      c.classList.toggle('selected', c.dataset.modalAccType===selectedType));
    const hint  = document.getElementById('credit-hint');
    const label = document.getElementById('balance-label');
    const nameI = document.getElementById('modal-acc-name');
    if (selectedType==='credit') {
      hint?.style.setProperty('display','block');
      if(label) label.textContent='Kreditlimit / Schuldenstand (€)';
    } else {
      hint?.style.setProperty('display','none');
      if(label) label.textContent='Aktueller Stand (€)';
    }
    if(nameI && !nameI.value) nameI.value = Utils.getAccountType(selectedType).name;
  });
}

function openEditAccountModal(acc, onDone) {
  const type    = Utils.getAccountType(acc.type);
  const include = acc.includeInAnalysis !== false;
  Modal.open({
    title:'Konto bearbeiten',
    body:`
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding:12px;background:var(--bg-elevated);border-radius:12px">
        <span style="font-size:1.5rem">${type.icon}</span>
        <span style="font-weight:600">${type.name}</span>
      </div>
      <div class="form-group" style="margin-bottom:14px">
        <label class="form-label">Name</label>
        <input type="text" id="edit-acc-name" value="${acc.name}" />
      </div>
      <div class="form-group" style="margin-bottom:14px">
        <label class="form-label">${acc.type==='credit'?'Kreditlimit (€)':'Startguthaben korrigieren (€)'}</label>
        <div class="input-group">
          <span class="input-prefix">€</span>
          <input type="number" id="edit-acc-balance" value="${Math.abs(acc.balance)}" step="0.01" />
        </div>
        ${acc.type==='credit'?'<p class="text-xs text-muted" style="margin-top:4px">Wird automatisch als negativer Wert geführt.</p>':''}
      </div>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.9rem;margin-bottom:8px">
        <input type="checkbox" id="edit-acc-include" ${include?'checked':''} style="width:auto" />
        In Analyse &amp; Filterung einbeziehen
      </label>`,
    actions:[
      { label:'Löschen', class:'btn-danger', onClick: async () => {
        if(!confirm('Konto wirklich löschen?')) return;
        await DB.remove('accounts',acc.id); await State.reload();
        Modal.close(); Toast.success('Konto gelöscht.'); onDone?.();
      }},
      { label:'Speichern', class:'btn-primary', onClick: async () => {
        const name    = document.getElementById('edit-acc-name').value.trim();
        const bal     = parseFloat(document.getElementById('edit-acc-balance').value)||0;
        const include = document.getElementById('edit-acc-include').checked;
        await DB.update('accounts',{...acc, name:name||acc.name, balance:Math.abs(bal), includeInAnalysis:include});
        await State.reload(); Modal.close(); Toast.success('Konto aktualisiert.'); onDone?.();
      }},
    ],
  });
}
