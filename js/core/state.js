/**
 * state.js – Globaler App-Zustand
 * Zentraler State-Store. Alle Views lesen von hier,
 * alle Änderungen laufen über die State-Funktionen.
 * So bleibt die App konsistent ohne Framework-Overhead.
 */

const State = (() => {
  // ── Interner State ──
  let _state = {
    /** Aktuell eingeloggter User (null = niemand) */
    currentUser: null,

    /** Alle Haushaltsmitglieder */
    users: [],

    /** Alle Konten */
    accounts: [],

    /** Alle Transaktionen (im Arbeitsspeicher gecacht) */
    transactions: [],

    /** Kategorien */
    categories: [],

    /** Tags */
    tags: [],

    /** Ob der Setup-Wizard schon abgeschlossen wurde */
    setupDone: false,

    /** Ansichts-Scope: 'personal' oder 'household' */
    viewScope: 'personal',

    /** Aktiver Navigations-Tab */
    activeTab: 'dashboard',

    /** Aktuell ausgewählter Monat (ISO-String YYYY-MM) */
    selectedMonth: new Date().toISOString().slice(0, 7),
  };

  // ── Listener für State-Änderungen ──
  const _listeners = {};

  /**
   * State lesen
   * @param {string|null} key – null = gesamter State
   */
  function get(key = null) {
    if (key === null) return { ..._state };
    return _state[key];
  }

  /**
   * State aktualisieren und Listener benachrichtigen
   * @param {object} updates
   */
  function set(updates) {
    const changedKeys = Object.keys(updates);
    Object.assign(_state, updates);

    // Listener für geänderte Keys aufrufen
    changedKeys.forEach(key => {
      if (_listeners[key]) {
        _listeners[key].forEach(fn => fn(_state[key]));
      }
    });

    // Wildcard-Listener (für globale Re-Renders)
    if (_listeners['*']) {
      _listeners['*'].forEach(fn => fn(_state));
    }
  }

  /**
   * Auf State-Änderungen reagieren
   * @param {string} key – State-Key oder '*' für alle
   * @param {Function} fn
   */
  function on(key, fn) {
    if (!_listeners[key]) _listeners[key] = [];
    _listeners[key].push(fn);
  }

  /**
   * Listener entfernen
   * @param {string} key
   * @param {Function} fn
   */
  function off(key, fn) {
    if (!_listeners[key]) return;
    _listeners[key] = _listeners[key].filter(f => f !== fn);
  }

  /**
   * Alle Stammdaten aus der DB in den State laden
   */
  async function loadAll() {
    const [users, accounts, transactions, categories, tags, setupDone] = await Promise.all([
      DB.getAll('users'),
      DB.getAll('accounts'),
      DB.getAll('transactions'),
      DB.getAll('categories'),
      DB.getAll('tags'),
      DB.getSetting('setupDone', false),
    ]);

    set({ users, accounts, transactions, categories, tags, setupDone });
    console.log('[State] Geladen:', { users: users.length, accounts: accounts.length, transactions: transactions.length });
  }

  /**
   * Transaktionen neu laden (nach Änderungen)
   */
  async function reloadTransactions() {
    const transactions = await DB.getAll('transactions');
    set({ transactions });
  }

  /**
   * Kategorien neu laden
   */
  async function reloadCategories() {
    const categories = await DB.getAll('categories');
    set({ categories });
  }

  /**
   * Alle Daten neu laden
   */
  async function reload() {
    await loadAll();
  }

  // ── Berechnungs-Helfer (werden von Views genutzt) ──

  /**
   * Gefilterte Transaktionen für den aktuellen Scope (personal/household)
   * und den ausgewählten Monat.
   *
   * ── Übertrag-Logik (haushaltsinterner Transfer) ──
   * Ein Übertrag zwischen zwei verschiedenen Haushaltsmitgliedern hat
   * userId = Sender. Das Zielkonto gehört einem anderen User.
   *
   * Persönliche Ansicht (scopeUser gesetzt):
   *   - Sender sieht den Übertrag als AUSGABE (normale Filterung nach userId)
   *   - Empfänger: Wir suchen alle Überträge, deren toAccountId einem eigenen
   *     Konto gehört und die von einem ANDEREN User stammen → synthetische
   *     EINNAHME-Kopie wird eingefügt (type bleibt 'transfer', aber
   *     _transferDirection = 'incoming' als Markierung für sumTransactions)
   *
   * Haushaltsansicht (kein scopeUser):
   *   - Alle Transaktionen aller Mitglieder, Überträge INNERHALB des Haushalts
   *     werden herausgefiltert (Sender ≠ Empfänger-User, beide im Haushalt)
   *     → netto ±0, also keine Verfälschung der Haushaltssummen
   *
   * Konten mit includeInAnalysis === false werden immer ausgeschlossen.
   */
  function getFilteredTransactions({ userId, month, type, categoryId } = {}) {
    // Ausgeschlossene Konten-IDs ermitteln
    const excludedAccountIds = new Set(
      _state.accounts
        .filter(a => a.includeInAnalysis === false)
        .map(a => a.id)
    );

    // Basis: alle Transaktionen, ausgeschlossene Konten raus
    let txs = _state.transactions.filter(t =>
      !excludedAccountIds.has(t.accountId) &&
      !excludedAccountIds.has(t.toAccountId)
    );

    // Eigene Konten-IDs des aktuellen Users (für Empfangs-Erkennung)
    const scopeUser = userId || (_state.viewScope === 'personal' ? _state.currentUser?.id : null);

    if (scopeUser) {
      // ── Persönliche Ansicht ──
      const myAccountIds = new Set(
        _state.accounts
          .filter(a => a.userId === scopeUser)
          .map(a => a.id)
      );

      // Alle Haushaltsmitglieder-IDs für interne-Übertrag-Erkennung
      const allUserIds = new Set(_state.users.map(u => u.id));

      // 1) Eigene Transaktionen (Sender)
      const ownTxs = txs.filter(t => t.userId === scopeUser);

      // 2) Haushaltsinterne Überträge bei denen das Zielkonto dem scopeUser gehört
      //    (= ich bin Empfänger eines fremden Übertrags)
      const incomingTransfers = txs
        .filter(t =>
          t.type === 'transfer' &&
          t.userId !== scopeUser &&           // anderer Sender
          allUserIds.has(t.userId) &&         // Sender ist Haushaltsmitglied
          t.toAccountId != null &&
          myAccountIds.has(t.toAccountId)     // Ziel ist mein Konto
        )
        .map(t => ({
          ...t,
          // Als virtuelle Einnahme markieren für sumTransactions
          _transferDirection: 'incoming',
        }));

      txs = [...ownTxs, ...incomingTransfers];

    } else {
      // ── Haushaltsansicht ──
      // Haushaltsinterne Überträge (Sender und Empfänger beide im Haushalt)
      // herausfiltern, damit sie sich nicht doppelt zählen (Ausgabe beim Sender
      // und Einnahme beim Empfänger würden beide in die Summe fließen).
      const allUserIds = new Set(_state.users.map(u => u.id));

      txs = txs.filter(t => {
        if (t.type !== 'transfer') return true;
        // Zielkonto ermitteln
        const toAccount = _state.accounts.find(a => a.id === t.toAccountId);
        if (!toAccount) return true; // Externes Konto → behalten
        // Ist Empfänger auch ein Haushaltsmitglied? → haushaltsinternen Übertrag ausblenden
        return !allUserIds.has(toAccount.userId);
      });
    }

    // Monats-Filter
    const m = month || _state.selectedMonth;
    if (m) {
      txs = txs.filter(t => t.date && t.date.startsWith(m));
    }

    // Typ-Filter (bei 'transfer' auch incoming-Überträge einbeziehen)
    if (type) txs = txs.filter(t => t.type === type);

    // Kategorie-Filter
    if (categoryId) txs = txs.filter(t => t.categoryId === categoryId);

    return txs;
  }

  /**
   * Summe einer Transaktion-Liste nach Typ.
   *
   * Besonderheit Überträge in persönlicher Ansicht:
   *   - Normale Überträge (Sender-Sicht, _transferDirection fehlt oder 'outgoing'):
   *     → zählen als AUSGABE
   *   - Eingehende Überträge (_transferDirection === 'incoming'):
   *     → zählen als EINNAHME
   *
   * In der Haushaltsansicht existieren keine incoming-Kopien, da interne
   * Überträge bereits aus der Liste entfernt wurden (±0).
   */
  function sumTransactions(txs, type) {
    if (type === 'income') {
      return txs
        .filter(t =>
          t.type === 'income' ||
          (t.type === 'transfer' && t._transferDirection === 'incoming')
        )
        .reduce((sum, t) => sum + (t.amount || 0), 0);
    }

    if (type === 'expense') {
      return txs
        .filter(t =>
          t.type === 'expense' ||
          (t.type === 'transfer' && t._transferDirection !== 'incoming')
        )
        .reduce((sum, t) => sum + (t.amount || 0), 0);
    }

    // Für direkte type-Abfragen (z.B. type === 'transfer')
    return txs
      .filter(t => t.type === type)
      .reduce((sum, t) => sum + (t.amount || 0), 0);
  }

  return {
    get,
    set,
    on,
    off,
    loadAll,
    reload,
    reloadTransactions,
    reloadCategories,
    getFilteredTransactions,
    sumTransactions,
  };
})();
