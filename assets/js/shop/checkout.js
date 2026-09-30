(async function () {
  const { $, esc } = PW;
  const form = $('checkout-form');
  const { money } = Shop;
  const ORDERS = 'pw_orders';

  let lines = [];
  try {
    // ?fail=true should break the payment step, not the loading of the cart summary.
    lines = await Shop.lines({ respectFail: false });
  } catch (err) {
    PW.show($('checkout-server-error'), err.message);
    form.querySelector('[type="submit"]').disabled = true;
    return;
  }
  if (!lines.length) {
    location.replace('cart.html?reason=empty');
    return;
  }

  const method = () => form.elements.method.value;
  function renderSummary() {
    $('summary-items').innerHTML = lines.map((l) => `<li><span>${l.qty} &times; ${esc(l.product.name)}</span><span>${money(l.product.price * l.qty)}</span></li>`).join('');
    const t = Shop.totals(lines, { method: method() });
    $('subtotal').textContent = money(t.subtotal);
    $('discount-label').hidden = $('discount').hidden = t.discount === 0;
    $('discount').textContent = `-${money(t.discount)}`;
    $('shipping').textContent = t.shipping === 0 ? 'Free' : money(t.shipping);
    $('total').textContent = money(t.total);
    return t;
  }
  renderSummary();
  $('place-order').disabled = false; // enabled only once the page is ready
  form.querySelectorAll('[name="method"]').forEach((r) => r.addEventListener('change', renderSummary));

  const digits = (v) => v.replace(/[\s-]/g, '');
  const rules = {
    fullName: (v) => (!v.trim() ? 'Full name is required' : ''),
    email: (v) => (!v ? 'Email is required' : !PW.isEmail(v) ? 'Enter a valid email address' : ''),
    address: (v) => (!v.trim() ? 'Address is required' : ''),
    city: (v) => (!v.trim() ? 'City is required' : ''),
    zip: (v) => (!v.trim() ? 'Postal code is required' : !/^[A-Za-z0-9 -]{4,10}$/.test(v.trim()) ? 'Enter a valid postal code' : ''),
    country: (v) => (!v ? 'Please select a country' : ''),
    card: (v) => (!v.trim() ? 'Card number is required' : !/^\d{16}$/.test(digits(v)) ? 'Card number must be 16 digits' : ''),
    expiry: (v) => {
      const m = v.trim().match(/^(\d{2})\/(\d{2})$/);
      if (!v.trim()) return 'Expiry date is required';
      if (!m || +m[1] < 1 || +m[1] > 12) return 'Use the format MM/YY';
      const now = new Date();
      const expires = new Date(2000 + +m[2], +m[1], 1); // first day after the expiry month
      return expires <= now ? 'Card has expired' : '';
    },
    cvc: (v) => (!v.trim() ? 'CVC is required' : !/^\d{3}$/.test(v.trim()) ? 'CVC must be 3 digits' : ''),
  };

  function validate(name) {
    return PW.fieldError(name, rules[name](form.elements[name].value));
  }
  form.addEventListener('input', (e) => {
    const name = e.target.name;
    if (rules[name] && !$(`${name}-error`).hidden) validate(name);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    $('checkout-server-error').hidden = true;
    const errors = Object.keys(rules).map(validate).filter(Boolean);
    PW.errorSummary($('checkout-summary-error'), errors.length, 'placing your order');
    if (errors.length) return;

    const submit = $('place-order');
    PW.setBusy(true, submit, $('order-spinner'));
    try {
      await PW.wait(PW.delay(800));
      if (PW.shouldFail()) throw new Error('Payment service unavailable (500). Please try again.');
      if (digits(form.elements.card.value) === '4000000000000002') throw new Error('Your card was declined.');

      const totals = Shop.totals(lines, { method: method() });
      const orders = PW.storage.getJSON(ORDERS, []);
      const order = {
        id: `ORD-${1001 + orders.length}`,
        customer: { name: form.elements.fullName.value.trim(), email: form.elements.email.value.trim(), address: form.elements.address.value.trim(), city: form.elements.city.value.trim(), zip: form.elements.zip.value.trim(), country: form.elements.country.value },
        method: method(),
        cardLast4: digits(form.elements.card.value).slice(-4),
        items: lines.map((l) => ({ id: l.product.id, name: l.product.name, qty: l.qty, price: l.product.price })),
        promo: totals.promo?.code ?? null,
        totals: { subtotal: totals.subtotal, discount: totals.discount, shipping: totals.shipping, total: totals.total },
      };
      PW.storage.setJSON(ORDERS, [...orders, order]);
      Shop.cart.clear();
      location.href = `confirmation.html?order=${order.id}`;
    } catch (err) {
      PW.show($('checkout-server-error'), err.message);
      PW.setBusy(false, submit, $('order-spinner'));
    }
  });
})();
