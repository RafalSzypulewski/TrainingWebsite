(function () {
  const $ = (id) => document.getElementById(id);
  const { money, esc } = Shop;

  let orders = [];
  try { orders = JSON.parse(localStorage.getItem('pw_orders') ?? '[]'); } catch { /* treated as no orders */ }
  const order = orders.find((o) => o.id === PW.param('order'));

  if (!order) {
    $('not-found').hidden = false;
    return;
  }

  const countries = { US: 'United States', PL: 'Poland', DE: 'Germany' };
  $('thanks').textContent = `Thank you, ${order.customer.name}!`;
  $('c-email').textContent = order.customer.email;
  $('order-number').textContent = order.id;
  $('c-address').textContent = `${order.customer.address}, ${order.customer.zip} ${order.customer.city}, ${countries[order.customer.country] ?? order.customer.country}`;
  $('c-method').textContent = order.method === 'express' ? 'Express' : 'Standard';
  $('c-card').textContent = `Card ending in ${order.cardLast4}`;
  $('c-items').innerHTML = order.items.map((i) => `<li><span>${i.qty} &times; ${esc(i.name)}</span><span>${money(i.price * i.qty)}</span></li>`).join('');
  $('c-subtotal').textContent = money(order.totals.subtotal);
  $('c-discount-label').hidden = $('c-discount').hidden = order.totals.discount === 0;
  $('c-discount').textContent = `-${money(order.totals.discount)}`;
  $('c-shipping').textContent = order.totals.shipping === 0 ? 'Free' : money(order.totals.shipping);
  $('c-total').textContent = money(order.totals.total);
  $('confirmation').hidden = false;
})();
