/**
 * navbar.js – Untere Navigationsleiste
 * Wird nach dem Login eingeblendet und bleibt persistent.
 */

const Navbar = (() => {
  const TABS = [
    { id: 'dashboard', icon: '⊞',  label: 'Übersicht' },
    { id: 'accounts',  icon: '🏦', label: 'Konten'    },
    { id: 'budget',    icon: '◎',  label: 'Budget'    },
    { id: 'analytics', icon: '📊', label: 'Analyse'   },
    { id: 'settings',  icon: '⚙',  label: 'Einstellungen' },
  ];

  let _navbar = null;

  /** Navbar ins DOM einhängen (einmalig) */
  function mount() {
    if (_navbar) return;

    _navbar = document.createElement('nav');
    _navbar.className = 'navbar';
    _navbar.setAttribute('role', 'navigation');
    _navbar.setAttribute('aria-label', 'Hauptnavigation');
    _navbar.innerHTML = TABS.map(tab => `
      <button
        class="nav-item ${State.get('activeTab') === tab.id ? 'active' : ''}"
        data-tab="${tab.id}"
        aria-label="${tab.label}"
        aria-current="${State.get('activeTab') === tab.id ? 'page' : 'false'}"
      >
        <span class="nav-icon">${tab.icon}</span>
        <span>${tab.label}</span>
      </button>
    `).join('');

    document.body.appendChild(_navbar);

    // Click-Handler
    _navbar.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-tab]');
      if (!btn) return;
      const tab = btn.dataset.tab;
      State.set({ activeTab: tab });
      Router.navigate(tab);
    });
  }

  /** Navbar entfernen (z.B. beim Logout) */
  function unmount() {
    _navbar?.remove();
    _navbar = null;
  }

  /** Aktiven Tab hervorheben */
  function setActive(tab) {
    if (!_navbar) return;
    _navbar.querySelectorAll('.nav-item').forEach(btn => {
      const isActive = btn.dataset.tab === tab;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-current', isActive ? 'page' : 'false');
    });
  }

  return { mount, unmount, setActive };
})();
