(function () {
  const { $ } = PW;

  // 1. Hover -----------------------------------------------------------------
  const hoverTarget = $('hover-target');
  const showHover = (on) => { $('hover-message').hidden = !on; };
  hoverTarget.addEventListener('mouseenter', () => showHover(true));
  hoverTarget.addEventListener('mouseleave', () => showHover(false));

  // 2. Clicks ----------------------------------------------------------------
  const counts = { click: 0, dblclick: 0, context: 0 };
  function record(kind, label) {
    counts[kind]++;
    $(`${kind}-count`).textContent = counts[kind];
    $('last-event').textContent = label;
  }
  const pad = $('click-pad');
  const mods = (e) => [e.shiftKey && 'shift', e.ctrlKey && 'ctrl', e.altKey && 'alt'].filter(Boolean).join('+');
  pad.addEventListener('click', (e) => record('click', mods(e) ? `${mods(e)}+click` : 'click'));
  pad.addEventListener('dblclick', () => record('dblclick', 'dblclick'));
  pad.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    record('context', 'contextmenu');
  });

  // 3. Context menu ----------------------------------------------------------
  const menu = $('context-menu');
  const hideMenu = () => { menu.hidden = true; };
  $('context-area').addEventListener('contextmenu', (e) => {
    e.preventDefault();
    menu.hidden = false;
    // Keep the menu fully inside the viewport.
    const { offsetWidth: w, offsetHeight: h } = menu;
    menu.style.left = `${Math.max(0, Math.min(e.clientX, window.innerWidth - w))}px`;
    menu.style.top = `${Math.max(0, Math.min(e.clientY, window.innerHeight - h))}px`;
  });
  menu.addEventListener('click', (e) => {
    const item = e.target.closest('[role="menuitem"]');
    if (!item) return;
    $('context-result').textContent = `Context action: ${item.textContent}`;
    hideMenu();
  });
  document.addEventListener('click', (e) => { if (!menu.contains(e.target)) hideMenu(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideMenu(); });

  // 4. Drag and drop ---------------------------------------------------------
  document.querySelectorAll('[draggable="true"]').forEach((item) => {
    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', item.id);
      item.classList.add('dragging');
    });
    item.addEventListener('dragend', () => item.classList.remove('dragging'));
  });
  document.querySelectorAll('.dropzone').forEach((zone) => {
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('over'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('over');
      const item = $(e.dataTransfer.getData('text/plain'));
      if (!item) return;
      zone.querySelector('ul').append(item);
      const name = zone.querySelector('h3').textContent;
      $('dnd-status').textContent = `Moved "${item.textContent}" to ${name}`;
    });
  });

  // 5. Custom slider ---------------------------------------------------------
  const slider = $('slider');
  function setSlider(value) {
    const v = Math.max(0, Math.min(100, Math.round(value)));
    slider.setAttribute('aria-valuenow', v);
    $('slider-value').textContent = v;
    $('slider-fill').style.width = `${v}%`;
    $('slider-thumb').style.left = `${v}%`;
  }
  const fromPointer = (e) => {
    const rect = slider.getBoundingClientRect();
    setSlider(((e.clientX - rect.left) / rect.width) * 100);
  };
  slider.addEventListener('pointerdown', (e) => {
    slider.setPointerCapture(e.pointerId);
    fromPointer(e);
    const move = (ev) => fromPointer(ev);
    slider.addEventListener('pointermove', move);
    slider.addEventListener('pointerup', () => slider.removeEventListener('pointermove', move), { once: true });
  });
  slider.addEventListener('keydown', (e) => {
    const now = Number(slider.getAttribute('aria-valuenow'));
    const next = { ArrowRight: now + 5, ArrowUp: now + 5, ArrowLeft: now - 5, ArrowDown: now - 5, Home: 0, End: 100 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    setSlider(next);
  });
  setSlider(25);

  // 6. Keyboard --------------------------------------------------------------
  $('key-input').addEventListener('keydown', (e) => {
    const m = [e.ctrlKey && 'Ctrl', e.shiftKey && 'Shift', e.altKey && 'Alt', e.metaKey && 'Meta'].filter(Boolean);
    $('key-info').textContent = `Key: ${e.key} | Code: ${e.code}${m.length ? ` | Modifiers: ${m.join('+')}` : ''}`;
  });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      $('shortcut-status').textContent = 'Shortcut Ctrl+K triggered!';
    }
  });
  const quick = $('quick-add');
  const quickList = $('quick-list');
  const plural = (n) => `${n} item${n === 1 ? '' : 's'}`;

  function updateQuickStatus(message) {
    const total = quickList.children.length;
    const selected = quickList.querySelectorAll('input:checked').length;
    $('quick-remove').disabled = selected === 0;
    const summary = total === 0 ? 'No items yet.' : `${plural(total)}, ${selected} selected`;
    $('quick-status').textContent = message ? `${message} ${summary}` : summary;
  }

  quick.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && quick.value.trim()) {
      const li = document.createElement('li');
      const label = document.createElement('label');
      const box = document.createElement('input');
      const text = document.createElement('span');
      box.type = 'checkbox';
      text.textContent = quick.value.trim();
      label.append(box, ' ', text);
      li.append(label);
      quickList.append(li);
      quick.value = '';
      updateQuickStatus();
    } else if (e.key === 'Escape') {
      quick.value = '';
    }
  });
  quickList.addEventListener('change', () => updateQuickStatus());
  $('quick-remove').addEventListener('click', () => {
    const checked = [...quickList.querySelectorAll('input:checked')];
    checked.forEach((box) => box.closest('li').remove());
    updateQuickStatus(`Removed ${plural(checked.length)}.`);
  });
})();
