(function () {
  const { $, esc } = PW;
  const { money } = Shop;
  let products = [];

  // Initial filters may come from the URL: ?q=book&category=Books
  $('search').value = PW.param('q', '');

  function visible() {
    const q = $('search').value.trim().toLowerCase();
    const category = $('category').value;
    const max = Number($('max-price').value) * 100;
    let list = products.filter((p) =>
      (!q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)) &&
      (!category || p.category === category) &&
      p.price <= max &&
      (!$('in-stock').checked || p.stock > 0));
    const sort = $('sort').value;
    if (sort === 'price-asc') list = [...list].sort((a, b) => a.price - b.price);
    if (sort === 'price-desc') list = [...list].sort((a, b) => b.price - a.price);
    if (sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'rating') list = [...list].sort((a, b) => b.rating - a.rating);
    return list;
  }

  function card(p) {
    const soldOut = p.stock === 0;
    return `<article class="product-card" data-testid="product-${p.id}">
      <a href="product.html?id=${p.id}"><img src="../${p.image}" alt="${esc(p.name)}" width="200" height="140"></a>
      <div class="product-body">
        <span class="badge">${esc(p.category)}</span>
        <h3><a href="product.html?id=${p.id}">${esc(p.name)}</a></h3>
        <p class="rating" aria-label="Rated ${p.rating} out of 5">&#9733; ${p.rating}</p>
        <p class="price" data-testid="price-${p.id}">${money(p.price)}</p>
        ${soldOut ? '<p class="stock out" data-testid="stock-' + p.id + '">Out of stock</p>' : p.stock <= 5 ? `<p class="stock low">Only ${p.stock} left</p>` : ''}
        <button type="button" class="btn small" data-add="${p.id}" data-testid="add-${p.id}" ${soldOut ? 'disabled' : ''}>${soldOut ? 'Unavailable' : 'Add to cart'}</button>
      </div></article>`;
  }

  function render() {
    const list = visible();
    $('product-grid').innerHTML = list.map(card).join('');
    $('result-count').textContent = `${list.length} product${list.length === 1 ? '' : 's'}`;
    $('no-results').hidden = list.length > 0;
  }

  ['search', 'category', 'sort', 'in-stock'].forEach((id) => $(id).addEventListener('input', render));
  $('max-price').addEventListener('input', (e) => {
    $('max-price-output').textContent = `$${e.target.value}`;
    render();
  });

  $('product-grid').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-add]');
    if (!btn) return;
    const product = products.find((p) => p.id === Number(btn.dataset.add));
    const res = Shop.cart.add(product);
    if (res.ok) PW.toast(`Added ${product.name} to cart`);
    else PW.toast(`Only ${res.stock} of ${product.name} in stock`, { kind: 'error' });
  });

  async function init() {
    $('shop-error').hidden = true;
    $('result-count').textContent = 'Loading products...';
    try {
      products = await Shop.products();
      const current = $('category').value;
      $('category').replaceChildren(new Option('All categories', ''), ...[...new Set(products.map((p) => p.category))].sort().map((c) => new Option(c, c)));
      $('category').value = current || PW.param('category', '');
      render();
    } catch (err) {
      $('shop-error-text').textContent = err.message;
      $('shop-error').hidden = false;
      $('result-count').textContent = 'Products could not be loaded.';
    }
  }
  $('shop-retry').addEventListener('click', init);
  init();
})();
