const CART_KEY = "powerhouse_cart";

const PRODUCTS = {
  "Brazil": {
    name: "Brazil",
    price: 1900,
    image: "images/brazil-bag.jpg",
    page: "brazil.html"
  },
  "Guatemala": {
    name: "Guatemala",
    price: 1900,
    image: "images/guate-bag.jpg",
    page: "guatemala.html"
  },
  "Ethiopia": {
    name: "Ethiopia",
    price: 1900,
    image: "images/ethiopia-bag.jpg",
    page: "ethiopia.html"
  },
  "Range Line Roast": {
    name: "Range Line Roast",
    price: 1900,
    image: "images/rangeline-bag.jpg",
    page: "rangeline.html"
  },
  "Stillwater Decaf": {
    name: "Stillwater Decaf",
    price: 1900,
    image: "images/swater-bag.jpg",
    page: "stillwaterdecaf.html"
  },
  "Full Power Dark": {
    name: "Full Power Dark",
    price: 1900,
    image: "images/fpdark-bag.jpg",
    page: "fullpowerdark.html"
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
      quantity: qty
    });
  }

  saveCart(cart);
  showCartToast(`${product.name} added to cart`);
}

function removeFromCart(productName) {
  const cart = getCart().filter(item => item.name !== productName);
  saveCart(cart);
  renderCartPage();
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

function showCartToast(message) {
  let toast = document.getElementById("cart-toast");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "cart-toast";
    toast.style.position = "fixed";
    toast.style.right = "20px";
    toast.style.bottom = "20px";
    toast.style.zIndex = "9999";
    toast.style.background = "#151515";
    toast.style.color = "#fff";
    toast.style.padding = "0.85rem 1rem";
    toast.style.borderRadius = "14px";
    toast.style.boxShadow = "0 12px 28px rgba(0,0,0,0.18)";
    toast.style.fontWeight = "700";
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    toast.style.transition = "all 0.2s ease";
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.style.opacity = "1";
  toast.style.transform = "translateY(0)";

  clearTimeout(window.__cartToastTimer);
  window.__cartToastTimer = setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
  }, 1900);
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
    shippingMsgEl.textContent = "You’ve qualified for free shipping in the contiguous U.S.";
  } else {
    const remaining = freeShippingThreshold - subtotal;
    shippingMsgEl.textContent = `${formatMoney(remaining)} away from free shipping`;
  }

  checkoutBtn.disabled = false;
  checkoutBtn.classList.remove("is-disabled");
}

document.addEventListener("DOMContentLoaded", function () {
  updateCartCount();
  bindAddToCartButtons();
  renderCartPage();
});