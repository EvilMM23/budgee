/**
 * PATCH: settings.js – Budget-Modus Abschnitt
 * Diesen Code-Block in den bestehenden settings.js einbauen,
 * direkt nach dem "Tags"-Abschnitt und vor "Administration".
 *
 * Außerdem im Event-Handler-Block hinzufügen:
 *   bindBudgetModeSection();
 */

function renderBudgetModeSection(budgetMode) {
  return `
    <div class="card">
      <p class="settings-section-title" style="padding:0 0 var(--space-sm)">
        Budgetierung
      </p>

      <!-- Modus-Auswahl -->
      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:var(--space-md)">

        <!-- Klassisch -->
        <label style="display:flex;align-items:flex-start;gap:12px;cursor:pointer;
                      padding:12px 14px;border-radius:var(--radius-md);
                      border:2px solid ${budgetMode==='monthly'?'var(--steel)':'var(--border)'};
                      background:${budgetMode==='monthly'?'var(--blue-soft)':'var(--bg-surface)'};
                      transition:all 0.15s">
          <input type="radio" name="budget-mode" value="monthly"
                 ${budgetMode==='monthly'?'checked':''}
                 style="width:18px;height:18px;margin-top:2px;accent-color:var(--navy);flex-shrink:0" />
          <div>
            <p style="font-weight:600;font-size:0.92rem">📅 Klassisch</p>
            <p class="text-xs text-muted" style="margin-top:2px">
              Budget vom 1. bis zum letzten Tag des Monats
            </p>
          </div>
        </label>

        <!-- Gehaltseingang -->
        <label style="display:flex;align-items:flex-start;gap:12px;cursor:pointer;
                      padding:12px 14px;border-radius:var(--radius-md);
                      border:2px solid ${budgetMode==='paycheck'?'var(--steel)':'var(--border)'};
                      background:${budgetMode==='paycheck'?'var(--blue-soft)':'var(--bg-surface)'};
                      transition:all 0.15s">
          <input type="radio" name="budget-mode" value="paycheck"
                 ${budgetMode==='paycheck'?'checked':''}
                 style="width:18px;height:18px;margin-top:2px;accent-color:var(--navy);flex-shrink:0" />
          <div>
            <p style="font-weight:600;font-size:0.92rem">💰 Ab Gehaltseingang</p>
            <p class="text-xs text-muted" style="margin-top:2px">
              Budget läuft zwischen zwei Gehaltseingängen
            </p>
          </div>
        </label>

      </div>

      <!-- Hinweis je nach Modus -->
      ${budgetMode === 'paycheck' ? renderPaycheckStatus() : ''}

    </div>`;
}

function renderPaycheckStatus() {
  const paychecks = State.get('transactions')
    .filter(t => t.isPaycheck === true && t.type === 'income')
    .sort((a,b) => b.date.localeCompare(a.date));

  if (paychecks.length === 0) {
    return `
      <div style="padding:12px 14px;background:var(--sand-dim);border:1px solid var(--sand-border);
                  border-radius:var(--radius-md)">
        <p style="font-weight:500;font-size:0.88rem;color:var(--brown)">⚠ Noch kein Gehaltseingang markiert</p>
        <p class="text-xs text-muted" style="margin-top:4px">
          Öffne eine Einnahme-Transaktion und aktiviere
          „Als Gehaltseingang markieren".
        </p>
      </div>`;
  }

  const last = paychecks[0];
  const period = State.getBudgetPeriod();
  return `
    <div style="padding:12px 14px;background:var(--color-income-bg);border:1px solid rgba(61,122,92,0.2);
                border-radius:var(--radius-md)">
      <p style="font-weight:500;font-size:0.88rem;color:var(--color-income)">
        ✓ ${paychecks.length} Gehaltseingang${paychecks.length>1?'seingänge':''} markiert
      </p>
      <p class="text-xs text-muted" style="margin-top:4px">
        Aktuelle Periode: <strong>${period.label}</strong>
      </p>
      <p class="text-xs text-muted" style="margin-top:2px">
        Letzter Eingang: ${Utils.formatDate(last.date, 'long')} · ${Utils.formatCurrency(last.amount)}
      </p>
    </div>
    <div style="margin-top:var(--space-sm)">
      <p class="text-xs text-muted" style="margin-bottom:6px">Alle Gehaltseingänge:</p>
      <div style="display:flex;flex-direction:column;gap:4px;max-height:160px;overflow-y:auto">
        ${paychecks.map(tx => `
          <div style="display:flex;justify-content:space-between;align-items:center;
                      padding:8px 10px;background:var(--bg-elevated);border-radius:8px;
                      cursor:pointer" data-paycheck-tx="${tx.id}">
            <div>
              <p style="font-size:0.84rem;font-weight:500">${Utils.formatDate(tx.date,'long')}</p>
              <p class="text-xs text-muted">${tx.note||'Gehaltseingang'}</p>
            </div>
            <div style="text-align:right">
              <p style="font-weight:600;color:var(--color-income)">${Utils.formatCurrency(tx.amount)}</p>
              <p class="text-xs" style="color:var(--color-expense);cursor:pointer"
                 data-unmark-paycheck="${tx.id}">Markierung entfernen</p>
            </div>
          </div>`).join('')}
      </div>
    </div>`;
}

async function bindBudgetModeSection() {
  document.querySelectorAll('input[name="budget-mode"]').forEach(radio =>
    radio.addEventListener('change', async () => {
      const newMode = radio.value;
      await DB.setSetting('budgetMode', newMode);
      State.set({ budgetMode: newMode });
      Toast.success(newMode === 'paycheck'
        ? 'Gehaltseingang-Modus aktiviert'
        : 'Klassischer Monatsmodus aktiviert');
      Router.navigate('settings');
    })
  );

  // Gehaltseingang-Markierung entfernen
  document.querySelectorAll('[data-unmark-paycheck]').forEach(btn =>
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const txId = +btn.dataset.unmarkPaycheck;
      const tx   = State.get('transactions').find(t => t.id === txId);
      if (!tx) return;
      if (!confirm('Gehaltseingang-Markierung entfernen?')) return;
      await DB.update('transactions', { ...tx, isPaycheck: false });
      await State.reloadTransactions();
      Toast.success('Markierung entfernt.');
      Router.navigate('settings');
    })
  );

  // Klick auf Transaktion → Formular öffnen
  document.querySelectorAll('[data-paycheck-tx]').forEach(row =>
    row.addEventListener('click', e => {
      if (e.target.closest('[data-unmark-paycheck]')) return;
      const tx = State.get('transactions').find(t => t.id === +row.dataset.paycheckTx);
      if (tx) openTransactionForm(tx);
    })
  );
}
