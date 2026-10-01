(function () {
  const { $ } = PW;
  const badge = $('api-status');
  const hint = $('api-hint');

  function describe(online) {
    badge.classList.remove('checking', 'online', 'offline');
    badge.classList.add(online ? 'online' : 'offline');
    if (online) {
      badge.textContent = `Practice API online (${PerfApi.base})`;
      PW.show(hint, 'You can explore it in the API explorer, and point your k6 scripts at it.');
    } else {
      badge.textContent = 'Practice API offline';
      PW.show(hint, PerfApi.offlineReason());
    }
  }

  async function check() {
    badge.classList.remove('online', 'offline');
    badge.classList.add('checking');
    badge.textContent = 'Checking...';
    describe(await PerfApi.isOnline());
  }

  $('api-recheck').addEventListener('click', check);
  check();
})();
