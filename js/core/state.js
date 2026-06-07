/**
 * state.js – Globaler App-Zustand
 * Enthält auch die Budget-Perioden-Logik für Klassisch und Gehaltseingang.
 */

const State = (() => {
  let _state = {
    currentUser:   null,
    users:         [],
    accounts:      [],
    transactions:  [],
    categories:    [],
    tags:          [],
    setupDone:     false,
    viewScope:     'personal',
    activeTab:     'dashboard',
    selectedMonth: new Date().toISOString().slice(0, 7),
    // Budget-Modus: 'monthly' | 'paycheck'
    budgetMode:    'monthly',
  };

  const _listeners = {};

  function get(key = null) {
    if (key === null) return { ..._state };
    return _state[key];
  }

  function set(updates) {
    const changedKeys = Object.keys(updates);
    Object.assign(_state, updates);
    changedKeys.forEach(key => {
      if (_listeners[key]) _listeners[key].forEach(fn => fn(_state[key]));
    });
    if (_listeners['*']) _listeners['*'].forEach(fn => fn(_state));
  }

  function on(key, fn) {
    if (!_listeners[key]) _listeners[key] = [];
    _listeners[key].push(fn);
  }

  function off(key, fn) {
    if (!_listeners[key]) return;
    _listeners[key] = _listeners[key].filter(f => f !== fn);
  }

  async function loadAll() {
    const [users, accounts, transactions, categories, tags, setupDone, budgetMode] = await Promise.all([
      DB.getAll('users'),
      DB.getAll('accounts'),
      DB.getAll('transactions'),
      DB.getAll('categories'),
      DB.getAll('tags'),
      DB.getSetting('setupDone', false),
      DB.getSetting('budgetMode', 'monthly'),
    ]);
    set({ users, accounts, transactions, categories, tags, setupDone, budgetMode });
  }

  async function reloadTransactions() {
    const transactions = await DB.getAll('transactions');
    set({ transactions });
  }

  async function reloadCategories() {
    const categories = await DB.getAll('categories');
    set({ categories });
  }

  async function reload() { await loadAll(); }

  // ══════════════════════════════════════════════════════
  // BUDGET-PERIODE BERECHNUNG
  // ══════════════════════════════════════════════════════

  /**
   * Gibt die aktuelle Budget-Periode zurück: { start, end, label }
   *
   * Klassisch ('monthly'):
   *   start = erster Tag des selectedMonth
   *   end   = letzter Tag des selectedMonth
   *
   * Gehaltseingang ('paycheck'):
   *   Sucht den letzten als Gehaltseingang markierten Eingang (isPaycheck=true)
   *   vor oder am heutigen Tag. Die Periode läuft von diesem Datum bis zum
   *   Tag VOR dem nächsten Gehaltseingang (oder heute wenn kein nächster).
   *   Für vergangene Navigation: selectedPaycheckStart bestimmt den Anker.
   *
   * @param {string|null} anchorDate  ISO-Datum (YYYY-MM-DD) als Navigationspunkt
   */
  function getBudgetPeriod(anchorDate = null) {
    const mode = _state.budgetMode;

    if (mode === 'monthly') {
      const month = _state.selectedMonth;
      const [year, mon] = month.split('-').map(Number);
      const start = `${month}-01`;
      const end   = new Date(year, mon, 0).toISOString().slice(0, 10);
      return {
        start,
        end,
        label:    Utils.formatMonth(month),
        mode:     'monthly',
        canPrev:  true,
        canNext:  month < Utils.currentMonth(),
      };
    }

    // ── Paycheck-Modus ──
    // Alle Gehalts-Transaktionen chronologisch sortiert
    const paychecks = _state.transactions
      .filter(t => t.isPaycheck === true && t.type === 'income')
      .map(t => t.date)
      .sort();

    if (paychecks.length === 0) {
      // Noch kein Gehaltseingang markiert → Fallback auf aktuellen Monat
      const month = Utils.currentMonth();
      const [year, mon] = month.split('-').map(Number);
      return {
        start:   `${month}-01`,
        end:     new Date(year, mon, 0).toISOString().slice(0, 10),
        label:   'Kein Gehaltseingang markiert',
        mode:    'paycheck',
        noPaycheck: true,
        canPrev: false,
        canNext: false,
      };
    }

    const today  = Utils.today();
    const anchor = anchorDate || today;

    // Letzter Gehaltseingang <= anchor
    const prevDates = paychecks.filter(d => d <= anchor);
    const start     = prevDates.length > 0
      ? prevDates[prevDates.length - 1]
      : paychecks[0];

    // Nächster Gehaltseingang > start
    const nextDates = paychecks.filter(d => d > start);
    const nextDate  = nextDates.length > 0 ? nextDates[0] : null;

    // Ende = Tag vor nächstem Eingang, oder heute wenn kein nächster
    const end = nextDate
      ? subtractDay(nextDate)
      : today;

    // Navigation: Gehaltseingang vor start
    const prevPaycheck = paychecks.filter(d => d < start);
    const nextPaycheck = nextDates;

    const startD  = new Date(start + 'T12:00:00');
    const label   = `${startD.toLocaleDateString('de-DE', { day:'numeric', month:'short' })} – ${
      new Date(end + 'T12:00:00').toLocaleDateString('de-DE', { day:'numeric', month:'short', year:'numeric' })}`;

    return {
      start,
      end,
      label,
      mode:        'paycheck',
      anchorDate:  start,
      canPrev:     prevPaycheck.length > 0,
      canNext:     nextPaycheck.length > 0,
      prevAnchor:  prevPaycheck.length > 0 ? prevPaycheck[prevPaycheck.length - 1] : null,
      nextAnchor:  nextPaycheck.length > 0 ? nextPaycheck[0] : null,
    };
  }

  /** Einen Tag abziehen (YYYY-MM-DD) */
  function subtractDay(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  // ══════════════════════════════════════════════════════
  // TRANSAKTIONS-FILTERUNG
  // ══════════════════════════════════════════════════════

  /**
   * Gefilterte Transaktionen.
   * Wenn period { start, end } übergeben wird, wird dieser Zeitraum genutzt.
   * Andernfalls wird selectedMonth genutzt.
   * Konten mit includeInAnalysis===false werden ausgeschlossen.
   */
  function getFilteredTransactions({ userId, month, period, type, categoryId } = {}) {
    const excludedAccountIds = new Set(
      _state.accounts.filter(a => a.includeInAnalysis === false).map(a => a.id)
    );

    let txs = _state.transactions.filter(t =>
      !excludedAccountIds.has(t.accountId) &&
      !excludedAccountIds.has(t.toAccountId)
    );

    const scopeUser = userId || (_state.viewScope === 'personal' ? _state.currentUser?.id : null);

    if (scopeUser) {
      const myAccountIds = new Set(
        _state.accounts.filter(a => a.userId === scopeUser).map(a => a.id)
      );
      const allUserIds = new Set(_state.users.map(u => u.id));

      const ownTxs = txs.filter(t => t.userId === scopeUser);
      const incomingTransfers = txs
        .filter(t =>
          t.type === 'transfer' &&
          t.userId !== scopeUser &&
          allUserIds.has(t.userId) &&
          t.toAccountId != null &&
          myAccountIds.has(t.toAccountId)
        )
        .map(t => ({ ...t, _transferDirection: 'incoming' }));

      txs = [...ownTxs, ...incomingTransfers];
    } else {
      const allUserIds = new Set(_state.users.map(u => u.id));
      txs = txs.filter(t => {
        if (t.type !== 'transfer') return true;
        const toAccount = _state.accounts.find(a => a.id === t.toAccountId);
        if (!toAccount) return true;
        return !allUserIds.has(toAccount.userId);
      });
    }

    // Zeitraum-Filter: period hat Vorrang vor month
    if (period) {
      txs = txs.filter(t => t.date && t.date >= period.start && t.date <= period.end);
    } else {
      const m = month || _state.selectedMonth;
      if (m) txs = txs.filter(t => t.date && t.date.startsWith(m));
    }

    if (type)       txs = txs.filter(t => t.type === type);
    if (categoryId) txs = txs.filter(t => t.categoryId === categoryId);

    return txs;
  }

  /**
   * Summe nach Typ – berücksichtigt eingehende Überträge als Einnahme.
   */
  function sumTransactions(txs, type) {
    if (type === 'income') {
      return txs
        .filter(t => t.type === 'income' || (t.type === 'transfer' && t._transferDirection === 'incoming'))
        .reduce((sum, t) => sum + (t.amount || 0), 0);
    }
    if (type === 'expense') {
      return txs
        .filter(t => t.type === 'expense' || (t.type === 'transfer' && t._transferDirection !== 'incoming'))
        .reduce((sum, t) => sum + (t.amount || 0), 0);
    }
    return txs.filter(t => t.type === type).reduce((sum, t) => sum + (t.amount || 0), 0);
  }

  return {
    get, set, on, off,
    loadAll, reload, reloadTransactions, reloadCategories,
    getBudgetPeriod,
    getFilteredTransactions,
    sumTransactions,
  };
})();
