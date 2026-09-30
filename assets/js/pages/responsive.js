(function () {
  const $ = (id) => document.getElementById(id);
  const mq = (q) => window.matchMedia(q);

  function update() {
    const w = window.innerWidth;
    $('env-breakpoint').textContent = w < 640 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop';
    $('env-viewport').textContent = `${w} x ${window.innerHeight}`;
    $('env-input').textContent = mq('(pointer: coarse)').matches ? 'touch' : 'mouse';
    $('env-scheme').textContent = mq('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    $('env-motion').textContent = mq('(prefers-reduced-motion: reduce)').matches ? 'reduce' : 'no-preference';
    $('env-orientation').textContent = w > window.innerHeight ? 'landscape' : 'portrait';
  }
  window.addEventListener('resize', update);
  ['(prefers-color-scheme: dark)', '(prefers-reduced-motion: reduce)', '(pointer: coarse)'].forEach((q) => mq(q).addEventListener('change', update));
  update();

  $('demo-toggle').addEventListener('click', (e) => {
    const open = e.currentTarget.getAttribute('aria-expanded') === 'true';
    e.currentTarget.setAttribute('aria-expanded', String(!open));
    $('demo-menu').classList.toggle('open', !open);
  });
})();
