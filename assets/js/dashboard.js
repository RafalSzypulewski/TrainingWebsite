(function () {
  const session = PW.requireAuth();
  if (!session) return;

  document.querySelector('main').hidden = false;
  document.getElementById('welcome').textContent = `Welcome, ${session.username}!`;
  document.querySelector('[data-testid="dashboard-role"]').textContent = session.role;
  document.querySelector('[data-testid="dashboard-storage"]').textContent = session.storage;
  document.getElementById('admin-panel').hidden = session.role !== 'admin';
  document.getElementById('logout').addEventListener('click', PW.logout);
})();
