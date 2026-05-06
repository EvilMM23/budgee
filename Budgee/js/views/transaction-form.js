/**
 * views/transaction-form.js – Transaktions-Formular
 * Bottom-Sheet Modal zum Erfassen von Einnahmen, Ausgaben und Überträgen.
 * Wird vom Dashboard und anderen Views aufgerufen.
 */

/**
 * Transaktions-Formular öffnen
 * @param {object|null} existing – vorhandene Transaktion zum Bearbeiten (null = neu)
 */
function openTransactionForm(existing = null) {
  const categories = State.get('categories');
  const tags       = State.get('tags');
  const user       = State.get('currentUser');
  const isEdit     = !!existing;

  // Formular-State
  let formData = {
    type:       existing?.type       || 'expense',
    amount:     existing?.amount     || '',
    date:       existing?.date       || Utils.today(),
    categoryId: existing?.categoryId || (categories[0]?.id || null),
    note:       existing?.note       || '',
    tagIds:     existing?.tagIds     || [],
    accountId:  existing?.accountId  || null,
    toAccountId: existing?.toAccountId || null,
  };

  // Nur Ausgaben-Kategorien initial zeigen
  function filteredCategories() {
    if (formData.type === 'income')   return categories.filter(c => c.isIncome);
    if (formData.type === 'expense')  return categories.filter(c => !c.isIncome);
    return categories; // transfer: alle
  }

  function renderBody() {
    // Eigene Konten (für Von-Konto / normale Transaktionen)
    const myAccounts  = State.get('accounts').filter(a => a.userId === user.id && a.includeInAnalysis !== false);
    // Alle Haushaltskonten (für Übertrag-Ziel: auch fremde Konten)
    const allAccounts = State.get('accounts').filter(a => a.includeInAnalysis !== false);
    const allUsers    = State.get('users');

    const cats        = filteredCategories();
    const selectedCat = cats.find(c => c.id === formData.categoryId) || cats[0];

    /** Konto-Option mit aktuellem (berechnetem) Saldo */
    function accountOption(acc, selectedId) {
      const typeObj       = Utils.getAccountType(acc.type);
      const owner         = allUsers.find(u => u.id === acc.userId);
      const ownerTag      = owner && owner.id !== user.id ? ` (${owner.name})` : '';
      // computeBalance ist global in accounts.js definiert und berücksichtigt alle Transaktionen
      const allTxs        = State.get('transactions');
      const currentBal    = computeBalance(acc, allTxs);
      const balColor      = currentBal < 0 ? 'color:var(--color-expense)' : '';
      return `<option value="${acc.id}" ${selectedId === acc.id ? 'selected' : ''}>
        ${typeObj.icon} ${acc.name}${ownerTag} · ${Utils.formatCurrency(currentBal)}
      </option>`;
    }

    return `
      <!-- Typ-Auswahl -->
      <div class="segmented-control" style="margin-bottom:20px">
        ${['expense','income','transfer'].map(t => `
          <button class="seg-btn ${formData.type === t ? `active-${t}` : ''}"
                  data-type="${t}">
            ${{ expense: '↓ Ausgabe', income: '↑ Einnahme', transfer: '⇄ Übertrag' }[t]}
          </button>
        `).join('')}
      </div>

      <!-- Betrag -->
      <div class="form-group" style="margin-bottom:16px">
        <div class="input-group">
          <span class="input-prefix" style="font-size:1.2rem">€</span>
          <input
            type="number"
            id="tx-amount"
            placeholder="0,00"
            value="${formData.amount}"
            step="0.01"
            min="0"
            style="padding-left:36px;font-size:1.4rem;font-weight:600;font-family:var(--font-display)"
            autofocus
          />
        </div>
      </div>

      <!-- Datum -->
      <div class="form-group" style="margin-bottom:16px">
        <label class="form-label">Datum</label>
        <input type="date" id="tx-date" value="${formData.date}" />
      </div>

      <!-- Kategorie -->
      ${formData.type !== 'transfer' ? `
      <div class="form-group" style="margin-bottom:16px">
        <label class="form-label">Kategorie</label>
        <div style="display:flex;flex-wrap:wrap;gap:8px" id="category-pills">
          ${cats.map(cat => `
            <button class="btn ${cat.id === (selectedCat?.id) ? 'btn-primary' : 'btn-secondary'} btn-sm"
                    data-cat="${cat.id}"
                    style="${cat.id === (selectedCat?.id) ? `background:${cat.color};border-color:${cat.color};color:#000` : ''}">
              ${cat.icon} ${cat.name}
            </button>
          `).join('')}
        </div>
      </div>
      ` : ''}

      <!-- Konto -->
      ${myAccounts.length > 0 ? `
      <div class="form-group" style="margin-bottom:16px">
        <label class="form-label">${formData.type === 'transfer' ? 'Von Konto' : 'Konto'}</label>
        <select id="tx-account">
          ${myAccounts.map(a => accountOption(a, formData.accountId)).join('')}
        </select>
      </div>
      ${formData.type === 'transfer' ? `
      <div class="form-group" style="margin-bottom:16px">
        <label class="form-label">An Konto (auch andere Haushaltsmitglieder)</label>
        <select id="tx-to-account">
          ${allAccounts.filter(a => a.id !== formData.accountId).map(a => accountOption(a, formData.toAccountId)).join('')}
        </select>
      </div>
      ` : ''}
      ` : ''}

      <!-- Notiz -->
      <div class="form-group" style="margin-bottom:16px">
        <label class="form-label">Notiz (optional)</label>
        <input type="text" id="tx-note" placeholder="z.B. Rewe, Tankstelle…" value="${formData.note}" />
      </div>

      <!-- Tags -->
      <div class="form-group">
        <label class="form-label">Tags</label>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px" id="selected-tags">
          ${formData.tagIds.map(tid => {
            const tag = tags.find(t => t.id === tid);
            return tag ? `<span class="tag tag-amber tag-removable" data-tag-id="${tid}">${tag.name}</span>` : '';
          }).join('')}
        </div>
        <div style="display:flex;gap:8px">
          <input type="text" id="tag-input" placeholder="Tag hinzufügen…" style="flex:1" list="tag-suggestions" />
          <datalist id="tag-suggestions">
            ${tags.filter(t => !formData.tagIds.includes(t.id)).map(t => `<option value="${t.name}">`).join('')}
          </datalist>
          <button class="btn btn-secondary" id="add-tag-btn">+</button>
        </div>
      </div>
    `;
  }

  /**
   * Aktuelle Formularwerte aus dem DOM in formData sichern,
   * bevor der Body neu gerendert wird (verhindert Datenverlust).
   */
  function syncFormDataFromDOM() {
    const amountEl = document.getElementById('tx-amount');
    const dateEl   = document.getElementById('tx-date');
    const noteEl   = document.getElementById('tx-note');
    const accEl    = document.getElementById('tx-account');
    const toAccEl  = document.getElementById('tx-to-account');

    if (amountEl && amountEl.value !== '') formData.amount     = parseFloat(amountEl.value) || formData.amount;
    if (dateEl)   formData.date       = dateEl.value   || formData.date;
    if (noteEl)   formData.note       = noteEl.value;
    if (accEl)    formData.accountId  = +accEl.value   || formData.accountId;
    if (toAccEl)  formData.toAccountId = +toAccEl.value || formData.toAccountId;
  }

  // Modal öffnen
  Modal.open({
    title: isEdit ? 'Transaktion bearbeiten' : 'Transaktion hinzufügen',
    body:  renderBody(),
    actions: [
      ...(isEdit ? [{ label: 'Löschen', class: 'btn-danger', onClick: () => deleteTransaction(existing.id) }] : []),
      { label: isEdit ? 'Speichern' : 'Hinzufügen', class: 'btn-primary', onClick: saveTransaction },
    ],
  });

  // ── Event-Handler ──

  // Initiale Typ-Buttons (außerhalb von rebindFormEvents – nur für den ersten Render)
  document.querySelectorAll('[data-type]').forEach(btn => {
    btn.addEventListener('click', () => {
      syncFormDataFromDOM();
      formData.type = btn.dataset.type;
      formData.categoryId = null;
      Modal.updateBody(renderBody());
      rebindFormEvents();
    });
  });

  rebindFormEvents();

  function rebindFormEvents() {
    // Kategorie-Auswahl – Formularwerte vorher sichern!
    document.querySelectorAll('[data-cat]').forEach(btn => {
      btn.addEventListener('click', () => {
        syncFormDataFromDOM();          // ← Betrag, Datum, Notiz retten
        formData.categoryId = +btn.dataset.cat;
        Modal.updateBody(renderBody());
        rebindFormEvents();
      });
    });

    // Typ-Buttons – Formularwerte vorher sichern!
    document.querySelectorAll('[data-type]').forEach(btn => {
      btn.addEventListener('click', () => {
        syncFormDataFromDOM();          // ← Betrag, Datum, Notiz retten
        formData.type = btn.dataset.type;
        formData.categoryId = null;
        Modal.updateBody(renderBody());
        rebindFormEvents();
      });
    });

    // Tag-Entfernen
    document.querySelectorAll('.tag-removable').forEach(tag => {
      tag.addEventListener('click', () => {
        const tid = +tag.dataset.tagId;
        formData.tagIds = formData.tagIds.filter(id => id !== tid);
        document.getElementById('selected-tags').innerHTML = formData.tagIds.map(tid => {
          const t = State.get('tags').find(t => t.id === tid);
          return t ? `<span class="tag tag-amber tag-removable" data-tag-id="${tid}">${t.name}</span>` : '';
        }).join('');
        rebindTagRemove();
      });
    });

    // Tag hinzufügen
    document.getElementById('add-tag-btn')?.addEventListener('click', addTag);
    document.getElementById('tag-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); addTag(); }
    });
  }

  function rebindTagRemove() {
    document.querySelectorAll('.tag-removable').forEach(tag => {
      tag.addEventListener('click', () => {
        const tid = +tag.dataset.tagId;
        formData.tagIds = formData.tagIds.filter(id => id !== tid);
        tag.remove();
      });
    });
  }

  async function addTag() {
    const input = document.getElementById('tag-input');
    const name  = input?.value.trim();
    if (!name) return;

    // Tag suchen oder anlegen
    let tag = State.get('tags').find(t => t.name.toLowerCase() === name.toLowerCase());
    if (!tag) {
      const id = await DB.add('tags', { name });
      tag = { id, name };
      await State.reloadTransactions();
      // Tags neu laden
      const tags = await DB.getAll('tags');
      State.set({ tags });
    }

    if (!formData.tagIds.includes(tag.id)) {
      formData.tagIds.push(tag.id);
      const container = document.getElementById('selected-tags');
      const span      = document.createElement('span');
      span.className  = 'tag tag-amber tag-removable';
      span.dataset.tagId = tag.id;
      span.textContent   = tag.name;
      container.appendChild(span);
      rebindTagRemove();
    }

    if (input) input.value = '';
  }

  /** Transaktion speichern */
  async function saveTransaction() {
    const amount = parseFloat(document.getElementById('tx-amount')?.value);
    const date   = document.getElementById('tx-date')?.value;
    const note   = document.getElementById('tx-note')?.value.trim();
    const accountId   = +document.getElementById('tx-account')?.value || null;
    const toAccountId = +document.getElementById('tx-to-account')?.value || null;

    if (!amount || amount <= 0) {
      Toast.error('Bitte gib einen gültigen Betrag ein.');
      return;
    }
    if (!date) {
      Toast.error('Bitte wähle ein Datum.');
      return;
    }

    const txData = {
      userId:      user.id,
      type:        formData.type,
      amount,
      date,
      categoryId:  formData.categoryId,
      note,
      tagIds:      formData.tagIds,
      accountId,
      toAccountId: formData.type === 'transfer' ? toAccountId : null,
    };

    try {
      if (isEdit) {
        await DB.update('transactions', { ...existing, ...txData });
        Toast.success('Transaktion aktualisiert.');
      } else {
        await DB.add('transactions', txData);
        Toast.success('Transaktion hinzugefügt.');
      }

      await State.reloadTransactions();
      Modal.close();

      // Dashboard neu laden wenn aktiv
      if (Router.current() === 'dashboard') {
        Router.navigate('dashboard');
      }
    } catch (err) {
      console.error('[TX] Speicherfehler:', err);
      Toast.error('Fehler beim Speichern.');
    }
  }

  /** Transaktion löschen */
  async function deleteTransaction(id) {
    if (!confirm('Transaktion wirklich löschen?')) return;
    await DB.remove('transactions', id);
    await State.reloadTransactions();
    Modal.close();
    Toast.success('Transaktion gelöscht.');

    if (Router.current() === 'dashboard') Router.navigate('dashboard');
    if (Router.current() === 'analytics') Router.navigate('analytics');
  }
}
