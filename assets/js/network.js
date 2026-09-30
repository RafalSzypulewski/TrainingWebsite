(function () {
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const TIMEOUT = Number(params.get('timeout')) || 3000;
  const POLL = Number(params.get('poll')) || 1000;
  $('timeout-ms').textContent = TIMEOUT;
  $('poll-interval').textContent = POLL;

  /** fetch that tells "server said no" apart from "could not reach server" and "bad body". */
  async function getJSON(path, options = {}) {
    let res;
    try {
      res = await fetch(PW.url(path), { cache: 'no-store', ...options });
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      throw new Error('Network error: could not reach the server');
    }
    if (!res.ok) throw new Error(`Server responded with ${res.status}`);
    try {
      return await res.json();
    } catch {
      throw new Error('Invalid response from the server');
    }
  }

  // 1. Users -----------------------------------------------------------------
  $('users-btn').addEventListener('click', async () => {
    $('users-btn').disabled = true;
    $('users-spinner').hidden = false;
    $('users-error').hidden = true;
    $('users-empty').hidden = true;
    $('users-list').replaceChildren();
    try {
      const users = await getJSON('assets/data/api/users.json?page=1', { headers: { 'X-Practice-Client': 'pw-lab' } });
      if (!Array.isArray(users) || users.length === 0) {
        $('users-empty').hidden = false;
      } else {
        $('users-list').replaceChildren(...users.map((u) => {
          const li = document.createElement('li');
          li.dataset.testid = 'user';
          li.textContent = `${u.name} <${u.email}>`;
          return li;
        }));
      }
    } catch (err) {
      $('users-error').textContent = `Failed to load users: ${err.message}`;
      $('users-error').hidden = false;
    } finally {
      $('users-btn').disabled = false;
      $('users-spinner').hidden = true;
    }
  });

  // 2. Slow request with timeout ---------------------------------------------
  $('slow-btn').addEventListener('click', async () => {
    const status = $('slow-status');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT);
    $('slow-btn').disabled = true;
    status.textContent = 'Loading...';
    try {
      const data = await getJSON('assets/data/api/slow.json', { signal: controller.signal });
      status.textContent = `Loaded: ${data.message}`;
    } catch (err) {
      status.textContent = err.name === 'AbortError' ? `Request timed out after ${TIMEOUT} ms` : `Failed: ${err.message}`;
    } finally {
      clearTimeout(timer);
      $('slow-btn').disabled = false;
    }
  });

  // 3. Retry -----------------------------------------------------------------
  $('retry-btn').addEventListener('click', async () => {
    const MAX = 3;
    const status = $('retry-status');
    $('retry-btn').disabled = true;
    let lastError;
    for (let attempt = 1; attempt <= MAX; attempt++) {
      status.textContent = `Attempt ${attempt} of ${MAX}...`;
      try {
        const data = await getJSON('assets/data/api/flaky.json');
        status.textContent = `${data.message} after ${attempt} attempt${attempt === 1 ? '' : 's'}`;
        $('retry-btn').disabled = false;
        return;
      } catch (err) {
        lastError = err;
        if (attempt < MAX) await PW.wait(300);
      }
    }
    status.textContent = `Gave up after ${MAX} attempts: ${lastError.message}`;
    $('retry-btn').disabled = false;
  });

  // 4. Polling ---------------------------------------------------------------
  let timer = null;
  function stopPolling() {
    clearInterval(timer);
    timer = null;
    $('poll-start').disabled = false;
    $('poll-stop').disabled = true;
  }
  $('poll-start').addEventListener('click', () => {
    let polls = 0;
    $('poll-start').disabled = true;
    $('poll-stop').disabled = false;
    $('poll-status').textContent = 'Job started, waiting...';
    const tick = async () => {
      polls++;
      try {
        const job = await getJSON('assets/data/api/status.json');
        if (job.state === 'done') {
          $('poll-status').textContent = `Job finished after ${polls} poll${polls === 1 ? '' : 's'}`;
          stopPolling();
        } else {
          $('poll-status').textContent = `Job ${job.state} (${job.progress ?? 0}%), poll ${polls}`;
        }
      } catch (err) {
        $('poll-status').textContent = `Polling failed: ${err.message}`;
        stopPolling();
      }
    };
    timer = setInterval(tick, POLL);
  });
  $('poll-stop').addEventListener('click', () => {
    stopPolling();
    $('poll-status').textContent = 'Polling stopped';
  });

  // 5. POST ------------------------------------------------------------------
  $('feedback-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = $('fb-message').value.trim();
    $('fb-error').hidden = message !== '';
    if (!message) return;
    $('fb-status').textContent = 'Sending...';
    try {
      const res = await fetch(PW.url('api/feedback'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: $('fb-name').value.trim() || 'Anonymous', message }),
      });
      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
      const data = await res.json();
      $('fb-status').textContent = `Thanks! Feedback #${data.id} received (${data.status})`;
    } catch (err) {
      $('fb-status').textContent = err instanceof TypeError ? 'Could not send feedback: network error' : `Could not send feedback: ${err.message}`;
    }
  });
})();
