(function () {
  const { $ } = PW;
  const status = (msg) => { $('tricky-status').textContent = msg; };
  const suffix = () => Math.random().toString(36).slice(2, 7);

  // Seedable random so the "random" delay can be reproduced with ?seed=N.
  let seed = Number(PW.param('seed'));
  const random = PW.param('seed') === null ? Math.random : () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  // 1. Duplicate ids: each button reports its own label.
  document.querySelectorAll('button[id="duplicate"]').forEach((b) => b.addEventListener('click', () => status(`Clicked: ${b.textContent}`)));

  // 2. Changing classes and ids
  const shape = $('dynamic-class-btn');
  let shapeClicks = 0;
  setInterval(() => { shape.className = `btn dyn-${suffix()}`; }, 400);
  shape.addEventListener('click', () => status(`Shape-shifting button clicked ${++shapeClicks} time(s)`));
  const input = $('dynamic-id-input');
  const newId = `field-${suffix()}`;
  input.id = newId;
  $('dynamic-id-label').outerHTML = `<label id="dynamic-id-label" for="${newId}">Input with a random id</label>`;

  // 3. Timing
  const delayed = $('delayed-enable');
  setTimeout(() => { delayed.disabled = false; }, PW.delay(2000));
  delayed.addEventListener('click', () => status('Delayed button clicked'));

  const self = $('disable-after-click');
  self.addEventListener('click', () => {
    self.disabled = true;
    status('Self-disabling button clicked');
    setTimeout(() => { self.disabled = false; }, PW.delay(1500));
  });

  setTimeout(() => $('cover').remove(), PW.delay(2000));
  $('covered-btn').addEventListener('click', () => status('Covered button clicked'));

  const moving = $('moving-btn');
  moving.style.animationDuration = `${PW.delay(2000)}ms`;
  moving.addEventListener('click', () => status('Moving target clicked'));

  $('random-btn').addEventListener('click', () => {
    const ms = Math.round(300 + random() * 1700);
    $('random-btn').disabled = true;
    $('random-spinner').hidden = false;
    $('random-result').textContent = '';
    setTimeout(() => {
      $('random-spinner').hidden = true;
      $('random-btn').disabled = false;
      $('random-result').textContent = `Done after ${ms} ms`;
    }, PW.delay(ms));
  });

  // 4. Re-rendering list
  const list = $('rerender-list');
  function renderList() {
    list.replaceChildren(...[1, 2, 3, 4].map((n) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn secondary small';
      b.textContent = `Item ${n}`;
      b.addEventListener('click', () => status(`Clicked Item ${n}`));
      li.append(b);
      return li;
    }));
  }
  renderList();
  setInterval(renderList, 500);

  // 6. Delete from a list with identical buttons
  $('delete-list').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const li = btn.closest('li');
    status(`Deleted: ${li.querySelector('span').textContent}`);
    li.remove();
  });

  // 8. Far button
  $('far-btn').addEventListener('click', () => status('Far away button clicked'));
})();
