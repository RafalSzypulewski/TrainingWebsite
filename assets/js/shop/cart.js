(function () {
  const $ = (id) => document.getElementById(id);
  const { money, esc } = Shop;

  async function render() {
    $('cart-message').textContent = '';
    let lines;
    try {
      lines = await Shop.lines();
    } catch (err) {
      $('cart-loading').hidden = true;
      $('cart-error').textContent = err.message;
      $('cart-error').hidden = false;
      return;
    }
    $('cart-loading').hidden = true;
    $('cart-error').hidden = true;
    $('cart-empty').hidden = lines.length > 0;
    $('cart-content').hidden = lines.length === 0;
    if (!lines.length) return;

    $('cart-rows').innerHTML = lines.map(({ product: p, qty }) => `
      <tr data-testid="cart-row-${p.id}">
        <td><a href="product.html?id=${p.id}">${esc(p.name)}</a></td>
        <td>${money(p.price)}</td>
        <td class="qty-cell">
          <button type="button" class="btn secondary small" data-act="dec" data-id="${p.id}" aria-label="Decrease quantity of ${esc(p.name)}" ${qty <= 1 ? 'disabled' : ''}>&minus;</button>
          <input type="number" min="1" max="${p.stock}" value="${qty}" data-id="${p.id}" aria-label="Quantity of ${esc(p.name)}" data-testid="qty-${p.id}">
          <button type="button" class="btn secondary small" data-act="inc" data-id="${p.id}" aria-label="Increase quantity of ${esc(p.name)}" ${qty >= p.stock ? 'disabled' : ''}>+</button>
        </td>
        <td data-testid="line-total-${p.id}">${money(p.price * qty)}</td>
        <td><button type="button" class="btn danger small" data-act="remove" data-id="${p.id}" aria-label="Remove ${esc(p.name)}" data-testid="remove-${p.id}">Remove</button></td>
      </tr>`).join('');

    const t = Shop.totals(lines);
    $('subtotal').textContent = money(t.subtotal);
    $('discount-label').hidden = $('discount').hidden = t.discount === 0;
    $('discount').textContent = `-${money(t.discount)}`;
    $('shipping').textContent = t.shipping === 0 ? 'Free' : money(t.shipping);
    $('total').textContent = money(t.total);
    $('promo-message').textContent = t.promo ? `Applied ${t.promo.code}: ${t.promo.label}` : '';
    $('promo-message').className = t.promo ? 'success-text' : '';
  }

  $('cart-rows').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const item = Shop.cart.get().find((i) => i.id === id);
    if (btn.dataset.act === 'remove') Shop.cart.remove(id);
    if (btn.dataset.act === 'inc') Shop.cart.setQty(id, item.qty + 1);
    if (btn.dataset.act === 'dec') Shop.cart.setQty(id, Math.max(1, item.qty - 1));
    await render();
  });

  $('cart-rows').addEventListener('change', async (e) => {
    if (e.target.type !== 'number') return;
    const id = Number(e.target.dataset.id);
    const product = (await Shop.products()).find((p) => p.id === id);
    let qty = Math.floor(Number(e.target.value));
    let message = '';
    if (!Number.isFinite(qty) || qty < 1) { qty = 1; message = 'Quantity must be at least 1.'; }
    if (qty > product.stock) { qty = product.stock; message = `Only ${product.stock} of ${product.name} in stock.`; }
    Shop.cart.setQty(id, qty);
    await render();
    $('cart-message').textContent = message;
  });

  $('clear-cart').addEventListener('click', async () => { Shop.cart.clear(); await render(); });

  $('promo-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = $('promo-code').value;
    if (!code.trim()) { $('promo-message').textContent = 'Enter a promo code.'; $('promo-message').className = 'error'; return; }
    if (!Shop.promo.apply(code)) {
      $('promo-message').textContent = 'Invalid promo code.';
      $('promo-message').className = 'error';
      return;
    }
    $('promo-code').value = '';
    await render();
  });

  render();
})();
