(function () {
  const $ = (id) => document.getElementById(id);

  // 1. Loading data ----------------------------------------------------------
  async function loadQuotes() {
    const btn = $('load-btn');
    btn.disabled = true;
    $('load-spinner').hidden = false;
    $('load-error').hidden = true;
    $('load-status').textContent = '';
    $('quotes').replaceChildren();
    try {
      const quotes = await PW.fetchJSON('assets/data/quotes.json', { defaultDelay: 1500 });
      $('quotes').replaceChildren(...quotes.map((q) => {
        const li = document.createElement('li');
        li.dataset.testid = 'quote';
        li.textContent = `"${q.text}" - ${q.author}`;
        return li;
      }));
      $('load-status').textContent = `Loaded ${quotes.length} quotes`;
    } catch (err) {
      $('load-error-text').textContent = err.message;
      $('load-error').hidden = false;
    } finally {
      btn.disabled = false;
      $('load-spinner').hidden = true;
    }
  }
  $('load-btn').addEventListener('click', loadQuotes);
  $('retry-btn').addEventListener('click', loadQuotes);

  // 2. Appearing / disappearing ----------------------------------------------
  $('delayed-btn').addEventListener('click', async (e) => {
    e.target.disabled = true;
    $('delayed-slot').replaceChildren();
    await PW.wait(PW.delay(2000));
    const p = document.createElement('p');
    p.id = 'delayed-message';
    p.className = 'banner success';
    p.dataset.testid = 'delayed-message';
    p.textContent = 'Hello, I was worth the wait!';
    $('delayed-slot').append(p);
    e.target.disabled = false;
  });

  $('temp-btn').addEventListener('click', () => {
    const p = document.createElement('p');
    p.className = 'banner info';
    p.textContent = 'This banner disappears on its own.';
    $('temp-slot').replaceChildren(p);
    setTimeout(() => p.remove(), PW.delay(3000));
  });

  let box = $('box');
  $('remove-btn').addEventListener('click', (e) => {
    if (box.isConnected) {
      box.remove();
      e.target.textContent = 'Add box';
    } else {
      $('box-slot').append(box);
      e.target.textContent = 'Remove box';
    }
  });
  $('hide-btn').addEventListener('click', (e) => {
    box.hidden = !box.hidden;
    e.target.textContent = box.hidden ? 'Show box' : 'Hide box';
  });

  // 3. Delayed enable --------------------------------------------------------
  $('enable-btn').addEventListener('click', async (e) => {
    e.target.disabled = true;
    $('enable-status').textContent = ' Enabling...';
    await PW.wait(PW.delay(2000));
    $('delayed-input').disabled = false;
    $('enable-status').textContent = ' Input is enabled.';
  });

  // 4. Progress --------------------------------------------------------------
  $('progress-btn').addEventListener('click', (e) => {
    const btn = e.target;
    const total = Math.max(PW.delay(3000), 100);
    const start = Date.now();
    btn.disabled = true;
    const timer = setInterval(() => {
      const pct = Math.min(100, Math.round(((Date.now() - start) / total) * 100));
      $('progress').setAttribute('aria-valuenow', pct);
      $('progress-bar').style.width = `${pct}%`;
      $('progress-text').textContent = pct === 100 ? 'Done!' : `${pct}%`;
      if (pct === 100) {
        clearInterval(timer);
        btn.disabled = false;
      }
    }, 50);
  });

  // 5. Infinite scroll -------------------------------------------------------
  const BATCH = 10;
  const list = $('scroll-list');
  const sentinel = $('sentinel');
  let items = null;
  let shown = 0;
  let loading = false;

  async function loadMore() {
    if (loading || (items && shown >= items.length)) return;
    loading = true;
    $('scroll-spinner').hidden = false;
    $('scroll-error').hidden = true;
    try {
      if (!items) items = await PW.fetchJSON('assets/data/scroll-items.json');
      await PW.wait(PW.delay(600));
      items.slice(shown, shown + BATCH).forEach((it) => {
        const li = document.createElement('li');
        li.textContent = it.title;
        list.append(li);
      });
      shown = list.children.length;
      $('scroll-count').textContent = `Showing ${shown} of ${items.length}`;
      $('scroll-end').hidden = shown < items.length;
    } catch (err) {
      $('scroll-error').textContent = err.message;
      $('scroll-error').hidden = false;
      return;
    } finally {
      loading = false;
      $('scroll-spinner').hidden = true;
    }
    // Re-observe so the sentinel fires again if it is still in view.
    observer.unobserve(sentinel);
    observer.observe(sentinel);
  }

  const observer = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) loadMore();
  }, { root: $('scroll-box') });
  observer.observe(sentinel);
})();
