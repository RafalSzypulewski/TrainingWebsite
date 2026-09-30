(async function () {
  const $ = (id) => document.getElementById(id);
  const { money } = Shop;

  try {
    const products = await Shop.products();
    const id = Number(PW.param('id'));
    const p = products.find((x) => x.id === id);
    $('product-loading').hidden = true;
    if (!p) {
      $('product-error').textContent = 'Product not found.';
      $('product-error').hidden = false;
      return;
    }

    document.title = `${p.name} - PW Practice Lab`;
    $('p-image').src = PW.url(p.image);
    $('p-image').alt = p.name;
    $('p-category').textContent = p.category;
    $('p-name').textContent = p.name;
    $('p-rating').textContent = `★ ${p.rating}`;
    $('p-description').textContent = p.description;
    $('p-price').textContent = money(p.price);
    $('p-stock').textContent = p.stock === 0 ? 'Out of stock' : `${p.stock} in stock`;
    $('p-add').disabled = p.stock === 0;
    $('p-qty').max = p.stock;
    $('product').hidden = false;

    $('p-add').addEventListener('click', () => {
      const qty = Number($('p-qty').value);
      const msg = $('p-message');
      msg.className = '';
      if (!Number.isInteger(qty) || qty < 1) {
        msg.textContent = 'Enter a quantity of at least 1.';
        msg.className = 'error';
        return;
      }
      const res = Shop.cart.add(p, qty);
      if (!res.ok) {
        msg.textContent = `Only ${res.stock} in stock.`;
        msg.className = 'error';
        return;
      }
      msg.textContent = `Added ${qty} x ${p.name} to your cart.`;
      $('p-go-cart').hidden = false;
    });
  } catch (err) {
    $('product-loading').hidden = true;
    $('product-error').textContent = err.message;
    $('product-error').hidden = false;
  }
})();
