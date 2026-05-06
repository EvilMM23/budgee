/**
 * utils.js – Hilfsfunktionen
 * Formatierung, Datum, Farben, DOM-Helfer
 */

const Utils = (() => {

  // ── Währungsformatierung ──

  /**
   * Betrag als Euro-String formatieren
   * @param {number} amount
   * @param {boolean} showSign – Vorzeichen immer anzeigen
   */
  function formatCurrency(amount, showSign = false) {
    const formatted = new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(amount));

    if (showSign && amount > 0)  return `+${formatted}`;
    if (amount < 0)              return `−${formatted}`; // Minus-Zeichen (kein Bindestrich)
    return formatted;
  }

  /**
   * Kompakte Zahl (1.200 → 1,2K)
   */
  function formatCompact(amount) {
    if (Math.abs(amount) >= 1000) {
      return new Intl.NumberFormat('de-DE', {
        notation: 'compact',
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 1,
      }).format(amount);
    }
    return formatCurrency(amount);
  }

  // ── Datum-Helfer ──

  /** Heutiges Datum als ISO-String YYYY-MM-DD */
  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  /** Aktueller Monat als YYYY-MM */
  function currentMonth() {
    return new Date().toISOString().slice(0, 7);
  }

  /**
   * ISO-Datum leserlich machen
   * @param {string} isoDate – YYYY-MM-DD
   * @param {'short'|'long'|'relative'} style
   */
  function formatDate(isoDate, style = 'short') {
    if (!isoDate) return '–';
    const date = new Date(isoDate + 'T12:00:00'); // Mittag, kein Timezone-Bug

    if (style === 'relative') {
      const diffDays = Math.floor((new Date(today()) - new Date(isoDate)) / 86400000);
      if (diffDays === 0) return 'Heute';
      if (diffDays === 1) return 'Gestern';
      if (diffDays < 7)  return `Vor ${diffDays} Tagen`;
    }

    if (style === 'long') {
      return date.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    // short (Standard)
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  /**
   * Monatsname aus YYYY-MM
   */
  function formatMonth(ym) {
    const [year, month] = ym.split('-');
    const date = new Date(+year, +month - 1, 1);
    return date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  }

  /**
   * Vorherigen / nächsten Monat berechnen
   */
  function addMonths(ym, delta) {
    const [year, month] = ym.split('-').map(Number);
    const date = new Date(year, month - 1 + delta, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * Datum-Range für einen Monat (YYYY-MM → { start, end })
   */
  function monthRange(ym) {
    const [year, month] = ym.split('-').map(Number);
    const start = `${ym}-01`;
    const end   = new Date(year, month, 0).toISOString().slice(0, 10); // Letzter Tag
    return { start, end };
  }

  // ── Farben ──

  /** Vordefinierte Kategorie-Farben */
  const CATEGORY_COLORS = [
    '#f5a623', '#2dd4bf', '#fb7185', '#a78bfa',
    '#34d399', '#60a5fa', '#fbbf24', '#f472b6',
    '#4ade80', '#818cf8', '#38bdf8', '#fb923c',
  ];

  /** Kategorie-Icons (Emoji-Auswahl) */
  const CATEGORY_ICONS = [
    '🛒', '🏠', '🚗', '🍽️', '💊', '👕', '🎬', '✈️',
    '📱', '💪', '📚', '🎮', '☕', '🐾', '🎁', '💰',
    '🔧', '🌱', '💻', '🎵', '🏋️', '🍺', '🚌', '⚡',
  ];

  /** Kontomodell-Definitionen */
  const ACCOUNT_TYPES = [
    { id: 'checking',  name: 'Girokonto',      icon: '🏦', color: '#60a5fa' },
    { id: 'savings',   name: 'Tagesgeld',       icon: '💸', color: '#34d399' },
    { id: 'depot',     name: 'Depot',           icon: '📈', color: '#a78bfa' },
    { id: 'cash',      name: 'Bargeld',         icon: '💵', color: '#fbbf24' },
    { id: 'credit',    name: 'Kreditkarte',     icon: '💳', color: '#fb7185' },
    { id: 'crypto',    name: 'Krypto',          icon: '₿',  color: '#f5a623' },
    { id: 'building',  name: 'Bausparer',       icon: '🏗️', color: '#2dd4bf' },
    { id: 'other',     name: 'Sonstiges',       icon: '🗂️', color: '#8a90a8' },
  ];

  /** Standard-Kategorien für neue Haushalte */
  const DEFAULT_CATEGORIES = [
    { name: 'Lebensmittel',    icon: '🛒', color: '#34d399', budget: 400,  isDefault: true },
    { name: 'Wohnen',          icon: '🏠', color: '#60a5fa', budget: 1200, isDefault: true },
    { name: 'Transport',       icon: '🚗', color: '#fbbf24', budget: 200,  isDefault: true },
    { name: 'Restaurants',     icon: '🍽️', color: '#fb7185', budget: 150,  isDefault: true },
    { name: 'Gesundheit',      icon: '💊', color: '#2dd4bf', budget: 100,  isDefault: true },
    { name: 'Kleidung',        icon: '👕', color: '#a78bfa', budget: 100,  isDefault: true },
    { name: 'Freizeit',        icon: '🎬', color: '#f472b6', budget: 200,  isDefault: true },
    { name: 'Sonstiges',       icon: '🗂️', color: '#8a90a8', budget: 150,  isDefault: true },
    { name: 'Einnahmen',       icon: '💰', color: '#f5a623', budget: 0,    isDefault: true, isIncome: true },
  ];

  // ── DOM-Helfer ──

  /**
   * Element erstellen und einhängen
   * @param {string} tag
   * @param {object} attrs
   * @param {string|Element|Array} children
   */
  function el(tag, attrs = {}, children = '') {
    const elem = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class')  elem.className = v;
      else if (k === 'style') Object.assign(elem.style, v);
      else if (k.startsWith('on')) elem.addEventListener(k.slice(2).toLowerCase(), v);
      else elem.setAttribute(k, v);
    });
    if (Array.isArray(children)) {
      children.forEach(c => c && elem.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
    } else if (children instanceof Element) {
      elem.appendChild(children);
    } else {
      elem.innerHTML = children;
    }
    return elem;
  }

  /**
   * HTML-String parsen und als DocumentFragment zurückgeben
   * (für template strings)
   */
  function html(strings, ...vals) {
    const raw = strings.reduce((acc, s, i) => acc + (vals[i - 1] ?? '') + s);
    const tpl = document.createElement('template');
    tpl.innerHTML = raw.trim();
    return tpl.content;
  }

  /**
   * Avatar-Initialen aus Name generieren
   */
  function initials(name) {
    return name
      .split(' ')
      .map(w => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  /**
   * Zufällige ID
   */
  function uid() {
    return Math.random().toString(36).slice(2, 10);
  }

  /**
   * Prozentsatz berechnen (safe: kein Division-by-Zero)
   */
  function percent(value, total) {
    if (!total || total === 0) return 0;
    return Math.min(100, Math.round((value / total) * 100));
  }

  /**
   * Farbe für Progress-Balken (nach Auslastung)
   */
  function progressColor(pct) {
    if (pct >= 100) return 'over';
    if (pct >= 80)  return 'warn';
    return '';
  }

  /**
   * Betrag-Farbe nach Transaktionstyp
   */
  function typeColor(type) {
    if (type === 'income')   return 'var(--color-income)';
    if (type === 'expense')  return 'var(--color-expense)';
    if (type === 'transfer') return 'var(--color-transfer)';
    return 'var(--text-primary)';
  }

  /**
   * Betrag-Vorzeichen nach Typ
   */
  function typeSign(type, amount) {
    if (type === 'income')  return `+${formatCurrency(amount)}`;
    if (type === 'expense') return `−${formatCurrency(amount)}`;
    return formatCurrency(amount);
  }

  /**
   * Debounce – Funktion erst nach Pause aufrufen
   */
  function debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  /**
   * Konto-Typ-Definition per ID
   */
  function getAccountType(typeId) {
    return ACCOUNT_TYPES.find(t => t.id === typeId) || ACCOUNT_TYPES[ACCOUNT_TYPES.length - 1];
  }

  return {
    formatCurrency,
    formatCompact,
    today,
    currentMonth,
    formatDate,
    formatMonth,
    addMonths,
    monthRange,
    CATEGORY_COLORS,
    CATEGORY_ICONS,
    ACCOUNT_TYPES,
    DEFAULT_CATEGORIES,
    el,
    html,
    initials,
    uid,
    percent,
    progressColor,
    typeColor,
    typeSign,
    debounce,
    getAccountType,
  };
})();
