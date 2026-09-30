(function () {
  const $ = (id) => document.getElementById(id);

  function saveBlob(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    $('download-error').hidden = true;
    $('download-status').textContent = `Downloaded ${filename} (${blob.size} bytes)`;
  }

  const csvCell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

  // 1. Generated CSV
  $('csv-btn').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    $('csv-spinner').hidden = false;
    $('download-status').textContent = 'Preparing employees.csv...';
    $('download-error').hidden = true;
    try {
      const rows = await PW.fetchJSON('assets/data/employees.json', { defaultDelay: 500 });
      const cols = Object.keys(rows[0]);
      const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n');
      saveBlob('employees.csv', csv, 'text/csv');
    } catch (err) {
      $('download-error').textContent = `Export failed: ${err.message}`;
      $('download-error').hidden = false;
      $('download-status').textContent = 'No download started.';
    } finally {
      btn.disabled = false;
      $('csv-spinner').hidden = true;
    }
  });

  // 2. Custom text file
  $('text-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const content = $('file-content').value;
    $('file-content-error').hidden = content.trim() !== '';
    if (!content.trim()) return;
    const name = ($('file-name').value.trim() || 'note').replace(/[^\w.-]+/g, '_');
    saveBlob(`${name}.txt`, content, 'text/plain');
  });

  // 3. JSON export of everything this site stored in the browser
  $('json-btn').addEventListener('click', () => {
    const dump = (store) => Object.fromEntries(Object.keys(store).map((k) => [k, store.getItem(k)]));
    saveBlob('browser-data.json', JSON.stringify({ localStorage: dump(localStorage), sessionStorage: dump(sessionStorage) }, null, 2), 'application/json');
  });

  // 4. CSV import
  function parseCsv(text) {
    const rows = [];
    let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') quoted = false;
        else cell += c;
      } else if (c === '"') quoted = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  $('csv-import').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const [header, ...data] = parseCsv(await file.text());
    $('import-summary').textContent = `Parsed ${data.length} rows and ${header.length} columns from ${file.name}`;
    const table = document.querySelector('[data-testid="import-preview-table"]');
    table.tHead.innerHTML = `<tr>${header.map((h) => `<th scope="col"></th>`).join('')}</tr>`;
    table.tHead.querySelectorAll('th').forEach((th, i) => { th.textContent = header[i]; });
    table.tBodies[0].replaceChildren(...data.slice(0, 3).map((r) => {
      const tr = document.createElement('tr');
      r.forEach((v) => { const td = document.createElement('td'); td.textContent = v; tr.append(td); });
      return tr;
    }));
    $('import-preview').hidden = false;
  });
})();
