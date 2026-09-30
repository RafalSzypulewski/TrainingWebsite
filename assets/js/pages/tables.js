(function () {
  const { $, esc } = PW;
  const KEY = 'pw_tables';
  const money = (n) => `$${n.toLocaleString('en-US')}`;

  let all = [];
  let sort = { key: null, dir: 'asc' };
  let page = 1;
  let editing = null; // id of row being edited
  let confirming = null; // id of row awaiting delete confirmation
  const selected = new Set();

  // Changes (deletes / edits / status toggles) persist in localStorage on top of the JSON.
  const loadChanges = () => PW.storage.getJSON(KEY, { deleted: [], edits: {} });
  const saveChanges = (changes) => PW.storage.setJSON(KEY, changes);
  function mutate(fn) {
    const c = loadChanges();
    fn(c);
    saveChanges(c);
  }

  function filtered() {
    const q = $('search').value.trim().toLowerCase();
    const dept = $('department').value;
    const status = $('status').value;
    let rows = all.filter((r) =>
      (!q || r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q)) &&
      (!dept || r.department === dept) &&
      (!status || r.status === status));
    if (sort.key) {
      const k = sort.key;
      const dir = sort.dir === 'asc' ? 1 : -1;
      rows = [...rows].sort((a, b) => (typeof a[k] === 'number' ? a[k] - b[k] : String(a[k]).localeCompare(String(b[k]))) * dir);
    }
    return rows;
  }

  function rowHtml(r) {
    const checked = selected.has(r.id) ? 'checked' : '';
    let name = esc(r.name);
    let actions = `
      <button type="button" class="btn secondary small" data-action="edit" data-id="${r.id}" data-testid="edit-${r.id}">Edit</button>
      <button type="button" class="btn secondary small" data-action="toggle" data-id="${r.id}" aria-label="Toggle status of ${esc(r.name)}">Toggle</button>
      <button type="button" class="btn danger small" data-action="delete" data-id="${r.id}" data-testid="delete-${r.id}">Delete</button>`;
    if (editing === r.id) {
      name = `<input type="text" value="${esc(r.name)}" aria-label="Name" data-testid="edit-input-${r.id}">`;
      actions = `
        <button type="button" class="btn small" data-action="save" data-id="${r.id}" data-testid="save-${r.id}">Save</button>
        <button type="button" class="btn secondary small" data-action="cancel" data-id="${r.id}">Cancel</button>`;
    } else if (confirming === r.id) {
      actions = `
        <span>Delete ${esc(r.name)}?</span>
        <button type="button" class="btn danger small" data-action="confirm-delete" data-id="${r.id}" data-testid="confirm-delete-${r.id}">Yes</button>
        <button type="button" class="btn secondary small" data-action="cancel" data-id="${r.id}">No</button>`;
    }
    return `<tr data-testid="row-${r.id}">
      <td><input type="checkbox" class="row-select" data-id="${r.id}" aria-label="Select ${esc(r.name)}" ${checked}></td>
      <td>${r.id}</td><td>${name}</td><td>${esc(r.email)}</td><td>${esc(r.department)}</td><td>${esc(r.role)}</td>
      <td class="num">${money(r.salary)}</td>
      <td><span class="badge status-${r.status}">${r.status}</span></td>
      <td class="row-actions">${actions}</td></tr>`;
  }

  function render() {
    const rows = filtered();
    const size = Number($('page-size').value);
    const pages = Math.max(1, Math.ceil(rows.length / size));
    page = Math.min(page, pages);
    const start = (page - 1) * size;
    const visible = rows.slice(start, start + size);

    $('rows').innerHTML = visible.length
      ? visible.map(rowHtml).join('')
      : '<tr><td colspan="9" class="empty" data-testid="empty-state">No employees match your filters.</td></tr>';

    $('range-info').textContent = rows.length
      ? `Showing ${start + 1}-${start + visible.length} of ${rows.length}`
      : 'Showing 0 of 0';

    const nums = Array.from({ length: pages }, (_, i) => i + 1).map((n) =>
      `<button type="button" class="btn small ${n === page ? '' : 'secondary'}" data-page="${n}" ${n === page ? 'aria-current="page"' : ''}>${n}</button>`).join('');
    $('pagination').innerHTML = `
      <button type="button" class="btn secondary small" data-page="${page - 1}" data-testid="page-prev" ${page === 1 ? 'disabled' : ''}>Previous</button>
      ${nums}
      <button type="button" class="btn secondary small" data-page="${page + 1}" data-testid="page-next" ${page === pages ? 'disabled' : ''}>Next</button>`;

    document.querySelectorAll('.sort-btn').forEach((b) => {
      const active = b.dataset.sort === sort.key;
      b.closest('th').setAttribute('aria-sort', active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none');
    });

    const pageIds = visible.map((r) => r.id);
    $('select-all').checked = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
    $('selected-count').textContent = `${selected.size} selected`;
    $('delete-selected').disabled = selected.size === 0;
  }

  function reset() { page = 1; editing = confirming = null; render(); }
  ['search', 'department', 'status', 'page-size'].forEach((id) => $(id).addEventListener('input', reset));

  document.querySelectorAll('.sort-btn').forEach((b) => b.addEventListener('click', () => {
    sort = { key: b.dataset.sort, dir: sort.key === b.dataset.sort && sort.dir === 'asc' ? 'desc' : 'asc' };
    page = 1;
    render();
  }));

  $('pagination').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-page]');
    if (!btn || btn.disabled) return;
    page = Number(btn.dataset.page);
    editing = confirming = null;
    render();
  });

  $('select-all').addEventListener('change', (e) => {
    document.querySelectorAll('.row-select').forEach((cb) => {
      const id = Number(cb.dataset.id);
      e.target.checked ? selected.add(id) : selected.delete(id);
    });
    render();
  });

  $('delete-selected').addEventListener('click', () => {
    const ids = [...selected];
    mutate((c) => c.deleted.push(...ids));
    all = all.filter((r) => !selected.has(r.id));
    selected.clear();
    render();
  });

  $('rows').addEventListener('change', (e) => {
    if (!e.target.classList.contains('row-select')) return;
    const id = Number(e.target.dataset.id);
    e.target.checked ? selected.add(id) : selected.delete(id);
    render();
  });

  $('rows').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const row = all.find((r) => r.id === id);
    switch (btn.dataset.action) {
      case 'edit': editing = id; confirming = null; break;
      case 'cancel': editing = confirming = null; break;
      case 'save': {
        const name = document.querySelector(`[data-testid="edit-input-${id}"]`).value.trim();
        if (name) {
          row.name = name;
          mutate((c) => { c.edits[id] = { ...c.edits[id], name }; });
        }
        editing = null;
        break;
      }
      case 'toggle':
        row.status = row.status === 'active' ? 'inactive' : 'active';
        mutate((c) => { c.edits[id] = { ...c.edits[id], status: row.status }; });
        break;
      case 'delete': confirming = id; editing = null; break;
      case 'confirm-delete':
        mutate((c) => c.deleted.push(id));
        all = all.filter((r) => r.id !== id);
        selected.delete(id);
        confirming = null;
        break;
    }
    render();
  });

  async function init() {
    try {
      const data = await PW.fetchJSON('assets/data/employees.json', { defaultDelay: 300 });
      const changes = loadChanges();
      all = data.filter((r) => !changes.deleted.includes(r.id)).map((r) => ({ ...r, ...changes.edits[r.id] }));
      const depts = [...new Set(data.map((r) => r.department))].sort();
      $('department').append(...depts.map((d) => new Option(d, d)));
      render();
    } catch (err) {
      PW.show($('table-error'), err.message);
      $('rows').innerHTML = '';
      $('range-info').textContent = 'Failed to load employees.';
    }
  }
  init();
})();
