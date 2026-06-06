/**
 * transaction-form.js – Transaktionsformular
 * Neu: isPaycheck-Flag für Gehaltseingang-Markierung
 */

function openTransactionForm(existing = null) {
  const categories = State.get('categories');
  const tags       = State.get('tags');
  const user       = State.get('currentUser');
  const isEdit     = !!existing;
  const budgetMode = State.get('budgetMode');

  let formData = {
    type:        existing?.type        || 'expense',
    amount:      existing?.amount      || '',
    date:        existing?.date        || Utils.today(),
    categoryId:  existing?.categoryId  || null,
    note:        existing?.note        || '',
    tagIds:      existing?.tagIds      || [],
    accountId:   existing?.accountId   || null,
    toAccountId: existing?.toAccountId || null,
    isPaycheck:  existing?.isPaycheck  || false,
  };

  function syncFormDataFromDOM() {
    const amountEl    = document.getElementById('tx-amount');
    const dateEl      = document.getElementById('tx-date');
    const noteEl      = document.getElementById('tx-note');
    const accEl       = document.getElementById('tx-account');
    const toAccEl     = document.getElementById('tx-to-account');
    const paycheckEl  = document.getElementById('tx-is-paycheck');

    if (amountEl && amountEl.value !== '') formData.amount      = parseFloat(amountEl.value) || formData.amount;
    if (dateEl)    formData.date        = dateEl.value    || formData.date;
    if (noteEl)    formData.note        = noteEl.value;
    if (accEl)     formData.accountId   = +accEl.value    || formData.accountId;
    if (toAccEl)   formData.toAccountId = +toAccEl.value  || formData.toAccountId;
    if (paycheckEl) formData.isPaycheck = paycheckEl.checked;
  }

  function filteredCategories() {
    if (formData.type === 'income')   return categories.filter(c => c.isIncome);
    if (formData.type === 'expense')  return categories.filter(c => !c.isIncome);
    return categories;
  }

  function renderBody() {
    const myAccounts  = State.get('accounts').filter(a => a.userId === user.id && a.includeInAnalysis !== false);
    const allAccounts = State.get('accounts').filter(a => a.includeInAnalysis !== false);
    const allUsers    = State.get('users');
    const cats        = filteredCategories();
    const selectedCat = cats.find(c => c.id === formData.categoryId) || cats[0];

    function accountOption(acc, selectedId) {
      const typeObj  = Utils.getAccountType(acc.type);
      const owner    = allUsers.find(u => u.id === acc.userId);
      const ownerTag = owner && owner.id !== user.id ? ` (${owner.name})` : '';
      const allTxs   = State.get('transactions');
      const bal      = computeBalance(acc, allTxs);
      return `<option value="${acc.id}" ${selectedId === acc.id ? 'selected' : ''}>
        ${typeObj.icon} ${acc.name}${ownerTag} · ${Utils.formatCurrency(bal)}
      </option>`;
    }

    return `
      <!-- Typ -->
      <div class="segmented-control" style="margin-bottom:20px">
        ${['expense','income','transfer'].map(t => `
          <button class="seg-btn ${formData.type===t?`active-${t}`:''}" data-type="${t}">
            ${{expense:'↓ Ausgabe', income:'↑ Einnahme', transfer:'⇄ Übertrag'}[t]}
          </button>`).join('')}
      </div>

      <!-- Betrag -->
      <div class="form-group" style="margin-bottom:16px">
        <div class="input-group">
          <span class="input-prefix" style="font-size:1.2rem">€</span>
          <input type="number" id="tx-amount" placeholder="0,00"
            value="${formData.amount}" step="0.01" min="0" autofocus
            style="padding-left:36px;font-size:1.3rem;font-weight:600" />
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
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${cats.map(cat => `
            <button class="btn btn-sm ${cat.id===(selectedCat?.id)?'btn-primary':'btn-secondary'}"
                    data-cat="${cat.id}"
                    style="${cat.id===(selectedCat?.id)?`background:${cat.color};border-color:${cat.color};color:#fff`:''}">
              ${cat.icon} ${cat.name}
            </button>`).join('')}
        </div>
      </div>` : ''}

      <!-- Konto -->
      ${myAccounts.length > 0 ? `
      <div class="form-group" style="margin-bottom:16px">
        <label class="form-label">${formData.type==='transfer'?'Von Konto':'Konto'}</label>
        <select id="tx-account">
          ${myAccounts.map(a => accountOption(a, formData.accountId)).join('')}
        </select>
      </div>
      ${formData.type==='transfer' ? `
      <div class="form-group" style="margin-bottom:16px">
        <label class="form-label">An Konto (inkl. andere Mitglieder)</label>
        <select id="tx-to-account">
          ${allAccounts.filter(a=>a.id!==formData.accountId).map(a=>accountOption(a,formData.toAccountId)).join('')}
        </select>
      </div>` : ''}` : ''}

      <!-- Notiz -->
      <div class="form-group" style="margin-bottom:16px">
        <label class="form-label">Notiz (optional)</label>
        <input type="text" id="tx-note" placeholder="z.B. Rewe, Tankstelle…" value="${formData.note}" />
      </div>

      <!-- Gehaltseingang-Markierung (nur bei Einnahme + Paycheck-Modus) -->
      ${formData.type === 'income' && budgetMode === 'paycheck' ? `
      <div class="form-group" style="margin-bottom:16px;padding:12px 14px;
           background:var(--sand-dim);border:1px solid var(--sand-border);border-radius:var(--radius-md)">
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
          <input type="checkbox" id="tx-is-paycheck" ${formData.isPaycheck?'checked':''}
                 style="width:18px;height:18px;accent-color:var(--navy)" />
          <div>
            <p style="font-weight:500;font-size:0.9rem">Als Gehaltseingang markieren</p>
            <p class="text-xs text-muted">Setzt den Startpunkt der Budget-Periode</p>
          </div>
        </label>
      </div>` : ''}

      <!-- Tags -->
      <div class="form-group">
        <label class="form-label">Tags</label>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px" id="selected-tags">
          ${formData.tagIds.map(tid => {
            const tag = tags.find(t => t.id === tid);
            return tag ? `<span class="tag tag-amber tag-removable" data-tag-id="${tid}">${tag.name}</span>` : '';
          }).join('')}
        </div>
        <div style="display:flex;gap:8px">
          <input type="text" id="tag-input" placeholder="Tag hinzufügen…" style="flex:1" />
          <button class="btn btn-secondary" id="add-tag-btn">+</button>
        </div>
      </div>
    `;
  }

  Modal.open({
    title: isEdit ? 'Transaktion bearbeiten' : 'Transaktion hinzufügen',
    body:  renderBody(),
    actions: [
      ...(isEdit ? [{ label:'Löschen', class:'btn-danger', onClick:() => deleteTransaction(existing.id) }] : []),
      { label: isEdit?'Speichern':'Hinzufügen', class:'btn-primary', onClick: saveTransaction },
    ],
  });

  // Initiale Typ-Buttons
  document.querySelectorAll('[data-type]').forEach(btn => {
    btn.addEventListener('click', () => {
      syncFormDataFromDOM();
      formData.type = btn.dataset.type;
      formData.categoryId = null;
      formData.isPaycheck = false;
      Modal.updateBody(renderBody());
      rebindFormEvents();
    });
  });

  rebindFormEvents();

  function rebindFormEvents() {
    document.querySelectorAll('[data-cat]').forEach(btn =>
      btn.addEventListener('click', () => {
        syncFormDataFromDOM();
        formData.categoryId = +btn.dataset.cat;
        Modal.updateBody(renderBody());
        rebindFormEvents();
      })
    );

    document.querySelectorAll('[data-type]').forEach(btn =>
      btn.addEventListener('click', () => {
        syncFormDataFromDOM();
        formData.type = btn.dataset.type;
        formData.categoryId = null;
        formData.isPaycheck = false;
        Modal.updateBody(renderBody());
        rebindFormEvents();
      })
    );

    document.querySelectorAll('.tag-removable').forEach(tag =>
      tag.addEventListener('click', () => {
        formData.tagIds = formData.tagIds.filter(id => id !== +tag.dataset.tagId);
        tag.remove();
      })
    );

    document.getElementById('add-tag-btn')?.addEventListener('click', addTag);
    document.getElementById('tag-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); addTag(); }
    });
  }

  async function addTag() {
    const input = document.getElementById('tag-input');
    const name  = input?.value.trim();
    if (!name) return;
    let tag = State.get('tags').find(t => t.name.toLowerCase() === name.toLowerCase());
    if (!tag) {
      const id = await DB.add('tags', { name });
      tag = { id, name };
      const tags = await DB.getAll('tags');
      State.set({ tags });
    }
    if (!formData.tagIds.includes(tag.id)) {
      formData.tagIds.push(tag.id);
      const container = document.getElementById('selected-tags');
      const span = document.createElement('span');
      span.className = 'tag tag-amber tag-removable';
      span.dataset.tagId = tag.id;
      span.textContent = tag.name;
      span.addEventListener('click', () => {
        formData.tagIds = formData.tagIds.filter(id => id !== tag.id);
        span.remove();
      });
      container?.appendChild(span);
    }
    if (input) input.value = '';
  }

  async function saveTransaction() {
    syncFormDataFromDOM();
    const amount      = parseFloat(document.getElementById('tx-amount')?.value);
    const date        = document.getElementById('tx-date')?.value;
    const note        = document.getElementById('tx-note')?.value.trim();
    const accountId   = +document.getElementById('tx-account')?.value  || null;
    const toAccountId = +document.getElementById('tx-to-account')?.value || null;
    const isPaycheck  = document.getElementById('tx-is-paycheck')?.checked || false;

    if (!amount || amount <= 0) { Toast.error('Bitte gib einen gültigen Betrag ein.'); return; }
    if (!date)                  { Toast.error('Bitte wähle ein Datum.');               return; }

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
      isPaycheck:  formData.type === 'income' ? isPaycheck : false,
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
      if (['dashboard','budget','analytics'].includes(Router.current())) {
        Router.navigate(Router.current());
      }
    } catch (err) {
      Toast.error('Fehler beim Speichern: ' + err.message);
    }
  }

  async function deleteTransaction(id) {
    if (!confirm('Transaktion wirklich löschen?')) return;
    await DB.remove('transactions', id);
    await State.reloadTransactions();
    Modal.close();
    Toast.success('Transaktion gelöscht.');
    if (['dashboard','budget','analytics'].includes(Router.current())) {
      Router.navigate(Router.current());
    }
  }
}
