/*
 * Shared shop logic: cart in localStorage, promo codes, totals, header cart link, toasts.
 * All money is handled in integer cents. Load after core/layout.js.
 */
(function () {
  const CART = 'pw_cart';
  const PROMO = 'pw_promo';
  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  };

  const PROMOS = {
    SAVE10: { code: 'SAVE10', label: '10% off your order', percent: 10 },
    FREESHIP: { code: 'FREESHIP', label: 'Free standard shipping', freeShipping: true },
  };
  const FREE_SHIPPING_FROM = 10000;
  const STANDARD_SHIPPING = 599;
  const EXPRESS_SHIPPING = 999;

  let productsPromise = null;

  const Shop = (window.Shop = {
    PROMOS,
    money: (cents) => `$${(cents / 100).toFixed(2)}`,
    esc: (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),

    /** Products from static JSON (cached; a failed load can be retried). */
    products({ respectFail = true } = {}) {
      productsPromise ??= PW.fetchJSON('assets/data/products.json', { defaultDelay: 400, respectFail }).catch((err) => {
        productsPromise = null;
        throw err;
      });
      return productsPromise;
    },

    cart: {
      get: () => read(CART, []),
      set(items) { localStorage.setItem(CART, JSON.stringify(items)); Shop.updateBadge(); },
      count: () => Shop.cart.get().reduce((n, i) => n + i.qty, 0),
      /** Adds qty of a product, respecting stock. Returns { ok, stock }. */
      add(product, qty = 1) {
        const items = Shop.cart.get();
        const existing = items.find((i) => i.id === product.id);
        const next = (existing?.qty ?? 0) + qty;
        if (next > product.stock) return { ok: false, stock: product.stock };
        if (existing) existing.qty = next;
        else items.push({ id: product.id, qty });
        Shop.cart.set(items);
        return { ok: true };
      },
      setQty(id, qty) {
        Shop.cart.set(Shop.cart.get().map((i) => (i.id === id ? { ...i, qty } : i)));
      },
      remove(id) { Shop.cart.set(Shop.cart.get().filter((i) => i.id !== id)); },
      clear() { localStorage.removeItem(CART); localStorage.removeItem(PROMO); Shop.updateBadge(); },
    },

    promo: {
      get: () => PROMOS[localStorage.getItem(PROMO)] ?? null,
      apply(code) {
        const promo = PROMOS[String(code).trim().toUpperCase()];
        if (promo) localStorage.setItem(PROMO, promo.code);
        return promo ?? null;
      },
      clear() { localStorage.removeItem(PROMO); },
    },

    /** Cart lines joined with product data; drops items whose product no longer exists. */
    async lines(options) {
      const products = await Shop.products(options);
      return Shop.cart.get()
        .map((i) => ({ product: products.find((p) => p.id === i.id), qty: i.qty }))
        .filter((l) => l.product);
    },

    totals(lines, { method = 'standard' } = {}) {
      const promo = Shop.promo.get();
      const subtotal = lines.reduce((sum, l) => sum + l.product.price * l.qty, 0);
      const discount = promo?.percent ? Math.round((subtotal * promo.percent) / 100) : 0;
      let shipping = 0;
      if (lines.length) {
        if (method === 'express') shipping = EXPRESS_SHIPPING;
        else shipping = promo?.freeShipping || subtotal >= FREE_SHIPPING_FROM ? 0 : STANDARD_SHIPPING;
      }
      return { subtotal, discount, shipping, total: subtotal - discount + shipping, promo };
    },

    updateBadge() {
      const link = document.querySelector('[data-testid="cart-link"]');
      if (link) link.querySelector('[data-testid="cart-count"]').textContent = Shop.cart.count();
    },

    toast(message, kind = 'success') {
      let region = document.getElementById('toast-region');
      if (!region) {
        region = Object.assign(document.createElement('div'), { id: 'toast-region', className: 'toast-region' });
        region.setAttribute('role', 'status');
        region.setAttribute('aria-live', 'polite');
        document.body.append(region);
      }
      const el = Object.assign(document.createElement('div'), { className: `toast ${kind}`, textContent: message });
      el.dataset.testid = 'toast';
      region.append(el);
      setTimeout(() => el.remove(), PW.delay(2500));
    },
  });

  // Cart link in the header bar (shop pages only).
  const bar = document.querySelector('.site-header .bar');
  if (bar) {
    const link = document.createElement('a');
    link.className = 'cart-link';
    link.href = PW.url('pages/cart.html');
    link.dataset.testid = 'cart-link';
    link.innerHTML = 'Cart <span class="cart-count" data-testid="cart-count">0</span>';
    link.setAttribute('aria-label', 'Shopping cart');
    bar.append(link);
    Shop.updateBadge();
  }
  window.addEventListener('storage', Shop.updateBadge);
})();
