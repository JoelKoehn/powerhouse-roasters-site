const CART_KEY = "powerhouse_cart";

const PRODUCTS = {
  "Brazil": {
    name: "Brazil",
    price: 1900,
    image: "images/brazil-bag.jpg",
    page: "brazil.html",
    roast: "Medium Roast"
  },
  "Guatemala": {
    name: "Guatemala",
    price: 1900,
    image: "images/guate-bag.jpg",
    page: "guatemala.html",
    roast: "Medium Roast"
  },
  "Ethiopia": {
    name: "Ethiopia",
    price: 1900,
    image: "images/ethiopia-bag.jpg",
    page: "ethiopia.html",
    roast: "Light Roast"
  },
  "Range Line Roast": {
    name: "Range Line Roast",
    price: 1900,
    image: "images/rangeline-bag.jpg",
    page: "rangeline.html",
    roast: "Medium Roast"
  },
  "Stillwater Decaf": {
    name: "Stillwater Decaf",
    price: 1900,
    image: "images/swater-bag.jpg",
    page: "stillwaterdecaf.html",
    roast: "Medium Roast"
  },
  "Full Power Dark": {
    name: "Full Power Dark",
    price: 1900,
    image: "images/fpdark-bag.jpg",
    page: "fullpowerdark.html",
    roast: "Medium-Dark Roast"
  }
};

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartCount();
}

function addToCart(productName, qty = 1) {
  const product = PRODUCTS[productName];
  if (!product) return;

  const cart = getCart();
  const existing = cart.find(item => item.name === productName);

  if (existing) {
    existing.quantity += qty;
  } else {
    cart.push({
      name: product.name,
      price: product.price,
      image: product.image,
      page: product.page,
      roast: product.roast,
      quantity: qty
    });
  }

  saveCart(cart);
  openCartDrawer();
}

function removeFromCart(productName) {
  const cart = getCart().filter(item => item.name !== productName);
  saveCart(cart);
  renderCartPage();
  renderCartDrawer();
}

function updateQuantity(productName, quantity) {
  const cart = getCart();
  const item = cart.find(i => i.name === productName);
  if (!item) return;

  if (quantity <= 0) {
    removeFromCart(productName);
    return;
  }

  item.quantity = quantity;
  saveCart(cart);
  renderCartPage();
  renderCartDrawer();
}

function drawerUpdateQty(productName, delta) {
  const cart = getCart();
  const item = cart.find(i => i.name === productName);
  if (!item) return;
  const newQty = item.quantity + delta;
  if (newQty <= 0) {
    removeFromCart(productName);
  } else {
    item.quantity = newQty;
    saveCart(cart);
    renderCartDrawer();
  }
}

function getCartCount() {
  return getCart().reduce((sum, item) => sum + item.quantity, 0);
}

function getCartSubtotal() {
  return getCart().reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

function formatMoney(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

function updateCartCount() {
  const countEls = document.querySelectorAll(".cart-count");
  const count = getCartCount();
  countEls.forEach(el => {
    el.textContent = count;
    el.style.display = count > 0 ? "inline-flex" : "none";
  });
}

// ── Cart Drawer ──────────────────────────────────────────

function injectCartDrawer() {
  if (document.getElementById("cart-drawer")) return;

  document.body.insertAdjacentHTML("beforeend", `
    <div id="cart-drawer-overlay" class="cart-drawer-overlay" onclick="closeCartDrawer()"></div>
    <aside id="cart-drawer" class="cart-drawer" aria-label="Shopping cart">
      <div class="drawer-header">
        <span class="drawer-title">Your Cart <span class="drawer-count-badge" id="drawer-count-badge"></span></span>
        <button class="drawer-close" onclick="closeCartDrawer()" aria-label="Close cart">✕</button>
      </div>
      <div id="drawer-items" class="drawer-items"></div>
      <div class="drawer-footer">
        <div class="drawer-shipping-bar" id="drawer-shipping-bar"></div>
        <div class="drawer-total-row">
          <span>Subtotal</span>
          <span id="drawer-total">$0.00</span>
        </div>
        <button class="drawer-checkout-btn" id="drawer-checkout-btn" onclick="checkoutCart()">
          Proceed to Checkout
        </button>
        <button class="drawer-continue-btn" onclick="closeCartDrawer()">
          Continue Shopping
        </button>
      </div>
    </aside>
  `);
}

function openCartDrawer() {
  renderCartDrawer();
  document.getElementById("cart-drawer")?.classList.add("open");
  document.getElementById("cart-drawer-overlay")?.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeCartDrawer() {
  document.getElementById("cart-drawer")?.classList.remove("open");
  document.getElementById("cart-drawer-overlay")?.classList.remove("open");
  document.body.style.overflow = "";
}

function renderCartDrawer() {
  const itemsEl = document.getElementById("drawer-items");
  const totalEl = document.getElementById("drawer-total");
  const shippingEl = document.getElementById("drawer-shipping-bar");
  const badgeEl = document.getElementById("drawer-count-badge");
  const checkoutBtn = document.getElementById("drawer-checkout-btn");

  if (!itemsEl) return;

  const cart = getCart();
  const subtotal = getCartSubtotal();
  const count = getCartCount();
  const freeShippingThreshold = 7500;

  if (badgeEl) badgeEl.textContent = count;
  if (totalEl) totalEl.textContent = formatMoney(subtotal);
  if (checkoutBtn) checkoutBtn.disabled = cart.length === 0;

  if (shippingEl) {
    if (subtotal >= freeShippingThreshold) {
      shippingEl.textContent = "You've qualified for free shipping!";
    } else {
      const remaining = freeShippingThreshold - subtotal;
      shippingEl.textContent = `${formatMoney(remaining)} away from free shipping`;
    }
  }

  if (cart.length === 0) {
    itemsEl.innerHTML = `<div class="drawer-empty">Your cart is empty.<br><br>Add some coffee to get started.</div>`;
    return;
  }

  itemsEl.innerHTML = cart.map(item => {
    const safeName = item.name.replace(/'/g, "\\'");
    return `
      <div class="drawer-item">
        <a href="${item.page}">
          <img src="${item.image}" alt="${item.name}" class="drawer-item-img">
        </a>
        <div>
          <div class="drawer-item-name">${item.name}</div>
          <div class="drawer-item-roast">${item.roast || ""}</div>
          <div class="drawer-qty-row">
            <button class="drawer-qty-btn" onclick="drawerUpdateQty('${safeName}', -1)">−</button>
            <span class="drawer-qty-val">${item.quantity}</span>
            <button class="drawer-qty-btn" onclick="drawerUpdateQty('${safeName}', 1)">+</button>
          </div>
          <button class="drawer-remove-btn" onclick="removeFromCart('${safeName}')">Remove</button>
        </div>
        <div class="drawer-item-total">${formatMoney(item.price * item.quantity)}</div>
      </div>
    `;
  }).join("");
}

async function checkoutCart() {
  const cart = getCart();
  if (!cart.length) return;

  const btn = document.getElementById("drawer-checkout-btn");
  if (btn) { btn.disabled = true; btn.textContent = "Redirecting..."; }

  try {
    const res = await fetch("/.netlify/functions/create-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cart })
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      alert("Checkout error. Please try again.");
      if (btn) { btn.disabled = false; btn.textContent = "Proceed to Checkout"; }
    }
  } catch {
    alert("Checkout error. Please try again.");
    if (btn) { btn.disabled = false; btn.textContent = "Proceed to Checkout"; }
  }
}

// ── Cart page ────────────────────────────────────────────

function renderCartPage() {
  const cartItemsEl = document.getElementById("cart-items");
  const subtotalEl = document.getElementById("cart-subtotal");
  const shippingMsgEl = document.getElementById("cart-shipping-message");
  const checkoutBtn = document.getElementById("checkout-button");

  if (!cartItemsEl || !subtotalEl || !shippingMsgEl || !checkoutBtn) return;

  const cart = getCart();
  const subtotal = getCartSubtotal();
  const freeShippingThreshold = 7500;

  if (cart.length === 0) {
    cartItemsEl.innerHTML = `
      <div class="cart-empty">
        <h2>Your cart is empty</h2>
        <p>Add some coffee to get started.</p>
        <a href="index.html#coffees" class="cart-shop-link">Shop Coffees</a>
      </div>
    `;
    subtotalEl.textContent = formatMoney(0);
    shippingMsgEl.textContent = "Free shipping on orders $75+ • Contiguous U.S. only (48 states)";
    checkoutBtn.disabled = true;
    checkoutBtn.classList.add("is-disabled");
    return;
  }

  cartItemsEl.innerHTML = cart.map(item => `
    <div class="cart-item">
      <a href="${item.page}" class="cart-item-image-wrap">
        <img src="${item.image}" alt="${item.name}" class="cart-item-image">
      </a>

      <div class="cart-item-info">
        <a href="${item.page}" class="cart-item-name">${item.name}</a>
        <div class="cart-item-price">${formatMoney(item.price)}</div>

        <div class="cart-item-controls">
          <button class="qty-btn" onclick="updateQuantity('${item.name.replace(/'/g, "\\'")}', ${item.quantity - 1})">−</button>
          <span class="qty-value">${item.quantity}</span>
          <button class="qty-btn" onclick="updateQuantity('${item.name.replace(/'/g, "\\'")}', ${item.quantity + 1})">+</button>
          <button class="remove-btn" onclick="removeFromCart('${item.name.replace(/'/g, "\\'")}')">Remove</button>
        </div>
      </div>

      <div class="cart-item-total">
        ${formatMoney(item.price * item.quantity)}
      </div>
    </div>
  `).join("");

  subtotalEl.textContent = formatMoney(subtotal);

  if (subtotal >= freeShippingThreshold) {
    shippingMsgEl.textContent = "You've qualified for free shipping in the contiguous U.S.";
  } else {
    const remaining = freeShippingThreshold - subtotal;
    shippingMsgEl.textContent = `${formatMoney(remaining)} away from free shipping`;
  }

  checkoutBtn.disabled = false;
  checkoutBtn.classList.remove("is-disabled");
}

function bindAddToCartButtons() {
  document.querySelectorAll(".add-to-cart").forEach(button => {
    button.addEventListener("click", function (e) {
      e.preventDefault();
      const productName = this.dataset.product;
      addToCart(productName, 1);
    });
  });
}

document.addEventListener("DOMContentLoaded", function () {
  injectCartDrawer();
  updateCartCount();
  bindAddToCartButtons();
  renderCartPage();
});
