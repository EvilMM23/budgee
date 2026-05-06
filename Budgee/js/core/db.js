/**
 * db.js – IndexedDB Wrapper
 * Alle Daten werden lokal im Browser gespeichert.
 * Kein Server, kein Cloud-Sync – vollständig offline-fähig.
 *
 * Stores:
 *  - users        : Haushaltsmitglieder
 *  - accounts     : Konten (Girokonto, Depot, etc.)
 *  - transactions : Einnahmen, Ausgaben, Überträge
 *  - categories   : Hauptkategorien mit Budget
 *  - tags         : Benutzerdefinierte Tags
 *  - settings     : App-weite Einstellungen (Key-Value)
 */

const DB = (() => {
  const DB_NAME    = 'HaushaltsFinanzDB';
  const DB_VERSION = 1;
  let _db = null;

  /** Datenbank öffnen und Schema anlegen */
  function open() {
    return new Promise((resolve, reject) => {
      if (_db) return resolve(_db);

      const req = indexedDB.open(DB_NAME, DB_VERSION);

      // Schema-Erstellung beim ersten Öffnen (oder Version-Upgrade)
      req.onupgradeneeded = (e) => {
        const db = e.target.result;

        // ── Users Store ──
        if (!db.objectStoreNames.contains('users')) {
          const userStore = db.createObjectStore('users', { keyPath: 'id', autoIncrement: true });
          userStore.createIndex('name', 'name', { unique: false });
        }

        // ── Accounts Store ──
        if (!db.objectStoreNames.contains('accounts')) {
          const accStore = db.createObjectStore('accounts', { keyPath: 'id', autoIncrement: true });
          accStore.createIndex('userId', 'userId', { unique: false });
        }

        // ── Transactions Store ──
        if (!db.objectStoreNames.contains('transactions')) {
          const txStore = db.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true });
          txStore.createIndex('userId',     'userId',     { unique: false });
          txStore.createIndex('date',       'date',       { unique: false });
          txStore.createIndex('categoryId', 'categoryId', { unique: false });
          txStore.createIndex('type',       'type',       { unique: false });
        }

        // ── Categories Store ──
        if (!db.objectStoreNames.contains('categories')) {
          db.createObjectStore('categories', { keyPath: 'id', autoIncrement: true });
        }

        // ── Tags Store ──
        if (!db.objectStoreNames.contains('tags')) {
          const tagStore = db.createObjectStore('tags', { keyPath: 'id', autoIncrement: true });
          tagStore.createIndex('name', 'name', { unique: true });
        }

        // ── Settings Store (Key-Value) ──
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      req.onsuccess = (e) => {
        _db = e.target.result;
        console.log('[DB] IndexedDB geöffnet:', DB_NAME);
        resolve(_db);
      };

      req.onerror = (e) => {
        console.error('[DB] Fehler beim Öffnen:', e.target.error);
        reject(e.target.error);
      };
    });
  }

  /**
   * Generische Hilfsfunktion: Alle Datensätze aus einem Store laden
   * @param {string} storeName
   * @returns {Promise<Array>}
   */
  function getAll(storeName) {
    return open().then(db => new Promise((resolve, reject) => {
      const tx    = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req   = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    }));
  }

  /**
   * Einzelnen Datensatz per ID laden
   * @param {string} storeName
   * @param {number} id
   */
  function getById(storeName, id) {
    return open().then(db => new Promise((resolve, reject) => {
      const tx    = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req   = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    }));
  }

  /**
   * Datensätze nach Index filtern
   * @param {string} storeName
   * @param {string} indexName
   * @param {*} value
   */
  function getByIndex(storeName, indexName, value) {
    return open().then(db => new Promise((resolve, reject) => {
      const tx    = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const req   = index.getAll(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    }));
  }

  /**
   * Datensatz hinzufügen
   * @param {string} storeName
   * @param {object} data
   * @returns {Promise<number>} – neue ID
   */
  function add(storeName, data) {
    return open().then(db => new Promise((resolve, reject) => {
      const tx    = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req   = store.add({ ...data, createdAt: Date.now() });
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    }));
  }

  /**
   * Datensatz aktualisieren (vollständiges Objekt erforderlich)
   * @param {string} storeName
   * @param {object} data – muss `id` enthalten
   */
  function update(storeName, data) {
    return open().then(db => new Promise((resolve, reject) => {
      const tx    = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req   = store.put({ ...data, updatedAt: Date.now() });
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    }));
  }

  /**
   * Datensatz löschen
   * @param {string} storeName
   * @param {number} id
   */
  function remove(storeName, id) {
    return open().then(db => new Promise((resolve, reject) => {
      const tx    = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req   = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror   = () => reject(req.error);
    }));
  }

  /**
   * Setting per Key lesen
   * @param {string} key
   * @param {*} defaultValue
   */
  function getSetting(key, defaultValue = null) {
    return open().then(db => new Promise((resolve, reject) => {
      const tx    = db.transaction('settings', 'readonly');
      const store = tx.objectStore('settings');
      const req   = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : defaultValue);
      req.onerror   = () => reject(req.error);
    }));
  }

  /**
   * Setting schreiben
   * @param {string} key
   * @param {*} value
   */
  function setSetting(key, value) {
    return open().then(db => new Promise((resolve, reject) => {
      const tx    = db.transaction('settings', 'readwrite');
      const store = tx.objectStore('settings');
      const req   = store.put({ key, value });
      req.onsuccess = () => resolve(true);
      req.onerror   = () => reject(req.error);
    }));
  }

  /** Alle Transaktionen in einem Datumsbereich laden */
  function getTransactionsInRange(startDate, endDate) {
    return open().then(db => new Promise((resolve, reject) => {
      const tx    = db.transaction('transactions', 'readonly');
      const store = tx.objectStore('transactions');
      const index = store.index('date');
      const range = IDBKeyRange.bound(startDate, endDate);
      const req   = index.getAll(range);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    }));
  }

  // Öffentliche API
  return {
    open,
    getAll,
    getById,
    getByIndex,
    add,
    update,
    remove,
    getSetting,
    setSetting,
    getTransactionsInRange,
  };
})();
