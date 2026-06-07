/**
 * period-navigator.js – Wiederverwendbare Perioden-Navigation
 * Unterstützt Monats- UND Paycheck-Modus.
 */

const PeriodNavigator = (() => {

  /**
   * Aktuelles Anker-Datum für Paycheck-Navigation aus dem State lesen.
   * Null = heutiges Datum verwenden (= aktuelle Periode)
   */
  function getAnchor() {
    return State.get('paycheckAnchor') || null;
  }

  /**
   * HTML für die Navigationsleiste
   * @param {object} period – von State.getBudgetPeriod()
   */
  function renderHTML(period) {
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:var(--space-sm) 0">
        <button class="month-nav-btn" id="period-prev"
          ${!period.canPrev?'disabled style="opacity:0.3;pointer-events:none"':''}>←</button>

        <div style="text-align:center">
          <p style="font-family:var(--font-display);font-size:1.05rem;color:var(--text-primary)">
            ${period.label}
          </p>
          ${period.mode==='paycheck'&&!period.noPaycheck ? `
            <p class="text-xs" style="color:var(--steel);margin-top:2px">💰 Gehalts-Periode</p>
          ` : ''}
          ${period.noPaycheck ? `
            <p class="text-xs" style="color:var(--color-expense);margin-top:2px">
              ⚠ Kein Gehaltseingang –
              <span style="cursor:pointer;text-decoration:underline" id="goto-settings-paycheck">
                Einstellungen öffnen
              </span>
            </p>
          ` : ''}
        </div>

        <button class="month-nav-btn" id="period-next"
          ${!period.canNext?'disabled style="opacity:0.3;pointer-events:none"':''}>→</button>
      </div>`;
  }

  /**
   * Events binden
   * @param {object} period   – aktuelles Perioden-Objekt
   * @param {string} viewName – Router-Ziel beim Reload
   */
  function bindEvents(period, viewName) {
    document.getElementById('period-prev')?.addEventListener('click', () => {
      if (period.mode === 'monthly') {
        State.set({ selectedMonth: Utils.addMonths(State.get('selectedMonth'), -1) });
      } else {
        State.set({ paycheckAnchor: period.prevAnchor });
      }
      Router.navigate(viewName);
    });

    document.getElementById('period-next')?.addEventListener('click', () => {
      if (period.mode === 'monthly') {
        State.set({ selectedMonth: Utils.addMonths(State.get('selectedMonth'), 1) });
      } else {
        State.set({ paycheckAnchor: period.nextAnchor });
      }
      Router.navigate(viewName);
    });

    document.getElementById('goto-settings-paycheck')?.addEventListener('click', () => {
      State.set({ activeTab: 'settings' }); Navbar.setActive('settings'); Router.navigate('settings');
    });
  }

  return { getAnchor, renderHTML, bindEvents };
})();
