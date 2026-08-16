// Injected on all product pages — adds subscription selector and reviews section
(function () {

  const ONE_TIME_PRICE = 1900; // cents
  const SUB_PRICE = 1600;      // cents — Subscribe & Save

  // ── Grind Selector ────────────────────────────────────────

  function injectGrindSelector() {
    const priceEl = document.querySelector(".fpd-price");
    if (!priceEl) return;

    const selector = document.createElement("div");
    selector.className = "purchase-options";
    selector.id = "grind-selector";
    selector.innerHTML = `
      <label class="purchase-option selected" id="grind-opt-whole">
        <input type="radio" name="grind-select" value="whole-bean" checked>
        <span class="purchase-option-label">
          <span class="purchase-option-title">Whole Bean</span>
        </span>
      </label>
      <label class="purchase-option" id="grind-opt-ground">
        <input type="radio" name="grind-select" value="ground">
        <span class="purchase-option-label">
          <span class="purchase-option-title">Ground</span>
        </span>
      </label>
    `;

    priceEl.insertAdjacentElement("afterend", selector);

    selector.querySelectorAll("input[type=radio]").forEach(radio => {
      radio.addEventListener("change", function () {
        document.getElementById("grind-opt-whole").classList.toggle("selected", this.value === "whole-bean");
        document.getElementById("grind-opt-ground").classList.toggle("selected", this.value === "ground");
      });
    });
  }

  function getSelectedGrind() {
    const input = document.querySelector('input[name="grind-select"]:checked');
    return input ? input.value : "whole-bean";
  }

  // ── Subscription Selector ────────────────────────────────

  function injectSubscriptionSelector() {
    const priceEl = document.querySelector(".fpd-price");
    const addBtn = document.querySelector(".fpd-btn.add-to-cart");
    if (!priceEl || !addBtn) return;

    const productName = addBtn.dataset.product;
    if (!productName) return;

    const selector = document.createElement("div");
    selector.className = "purchase-options";
    selector.innerHTML = `
      <label class="purchase-option selected" id="opt-onetime">
        <input type="radio" name="purchase-type" value="onetime" checked>
        <span class="purchase-option-label">
          <span class="purchase-option-title">One-time purchase</span>
          <span class="purchase-option-price">$19.00</span>
        </span>
      </label>
      <label class="purchase-option" id="opt-sub">
        <input type="radio" name="purchase-type" value="subscribe">
        <span class="purchase-option-label">
          <span class="purchase-option-title">Subscribe &amp; Save</span>
          <span class="purchase-option-price">$16.00/delivery</span>
        </span>
        <span class="purchase-option-save">Save $3</span>
      </label>
      <div class="frequency-row" id="frequency-row">
        <label for="sub-frequency">Delivery Frequency</label>
        <select class="frequency-select" id="sub-frequency">
          <option value="biweekly">Every 2 Weeks</option>
          <option value="monthly" selected>Monthly</option>
          <option value="6weeks">Every 6 Weeks</option>
        </select>
      </div>
    `;

    const anchor = document.getElementById("grind-selector") || priceEl;
    anchor.insertAdjacentElement("afterend", selector);

    selector.querySelectorAll("input[type=radio]").forEach(radio => {
      radio.addEventListener("change", function () {
        document.getElementById("opt-onetime").classList.toggle("selected", this.value === "onetime");
        document.getElementById("opt-sub").classList.toggle("selected", this.value === "subscribe");
        document.getElementById("frequency-row").classList.toggle("visible", this.value === "subscribe");
      });
    });

    // Override add-to-cart behavior for subscription
    addBtn.addEventListener("click", function (e) {
      const type = selector.querySelector("input[name=purchase-type]:checked")?.value;
      if (type === "subscribe") {
        e.preventDefault();
        e.stopImmediatePropagation();
        const frequency = document.getElementById("sub-frequency")?.value || "monthly";
        startSubscriptionCheckout(productName, frequency, getSelectedGrind());
      }
    }, true);
  }

  async function startSubscriptionCheckout(productName, frequency, grind) {
    try {
      const res = await fetch("/.netlify/functions/create-subscription-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName, frequency, grind })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("Subscription checkout unavailable. Please try again.");
      }
    } catch {
      alert("Subscription checkout unavailable. Please try again.");
    }
  }

  // ── Reviews Section ──────────────────────────────────────

  function getProductSlug(productName) {
    return productName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  }

  function starsHtml(rating) {
    return "★".repeat(rating) + "☆".repeat(5 - rating);
  }

  async function injectReviews() {
    const addBtn = document.querySelector(".fpd-btn.add-to-cart");
    if (!addBtn) return;
    const productName = addBtn.dataset.product;
    if (!productName) return;
    const slug = getProductSlug(productName);

    const container = document.querySelector(".fpd-shell") || document.querySelector("main") || document.body;

    const section = document.createElement("section");
    section.className = "reviews-section";
    section.innerHTML = `
      <div class="reviews-header">
        <h2 class="reviews-title">Customer Reviews</h2>
        <span class="reviews-subtitle" id="review-count-label"></span>
      </div>
      <div id="reviews-list"></div>
      <div class="review-form-card">
        <h3>Write a Review</h3>
        <div class="review-star-select" id="star-select" role="group" aria-label="Star rating">
          ${[1,2,3,4,5].map(n => `<button class="star-btn" data-val="${n}" aria-label="${n} star">★</button>`).join("")}
        </div>
        <form class="review-form-grid" id="review-form" novalidate>
          <input type="text" name="author" placeholder="Your name" required maxlength="80">
          <textarea name="body" placeholder="Share your experience with this coffee..." required maxlength="1200"></textarea>
          <button type="submit" class="review-submit-btn">Submit Review</button>
        </form>
        <p class="review-success" id="review-success">Thank you! Your review is pending approval.</p>
        <p class="review-error" id="review-error">Something went wrong. Please try again.</p>
      </div>
    `;

    container.appendChild(section);

    // Star rating interaction
    let selectedRating = 0;
    const starBtns = section.querySelectorAll(".star-btn");
    starBtns.forEach(btn => {
      btn.addEventListener("mouseenter", () => highlightStars(Number(btn.dataset.val)));
      btn.addEventListener("mouseleave", () => highlightStars(selectedRating));
      btn.addEventListener("click", () => {
        selectedRating = Number(btn.dataset.val);
        highlightStars(selectedRating);
      });
    });

    function highlightStars(n) {
      starBtns.forEach(b => b.classList.toggle("active", Number(b.dataset.val) <= n));
    }

    // Review submit
    document.getElementById("review-form").addEventListener("submit", async function (e) {
      e.preventDefault();
      if (!selectedRating) {
        alert("Please select a star rating.");
        return;
      }
      const author = this.author.value.trim();
      const body = this.body.value.trim();
      if (!author || !body) return;

      const btn = this.querySelector(".review-submit-btn");
      btn.disabled = true;
      btn.textContent = "Submitting...";

      try {
        const res = await fetch("/.netlify/functions/submit-review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productSlug: slug, productName, author, body, rating: selectedRating })
        });
        if (res.ok) {
          document.getElementById("review-success").style.display = "block";
          this.reset();
          selectedRating = 0;
          highlightStars(0);
        } else {
          throw new Error("non-ok");
        }
      } catch {
        document.getElementById("review-error").style.display = "block";
        btn.disabled = false;
        btn.textContent = "Submit Review";
      }
    });

    // Load existing reviews
    try {
      const res = await fetch(`/.netlify/functions/get-reviews?slug=${encodeURIComponent(slug)}`);
      const { reviews = [] } = await res.json();
      const listEl = document.getElementById("reviews-list");
      const countLabel = document.getElementById("review-count-label");

      countLabel.textContent = reviews.length
        ? `${reviews.length} review${reviews.length !== 1 ? "s" : ""}`
        : "";

      if (reviews.length === 0) {
        listEl.innerHTML = `<p class="no-reviews">No reviews yet — be the first!</p>`;
      } else {
        listEl.innerHTML = reviews.map(r => `
          <div class="review-card">
            <div class="review-stars">${starsHtml(r.rating)}</div>
            <p class="review-text">${r.body.replace(/</g, "&lt;")}</p>
            <span class="review-author">— ${r.author.replace(/</g, "&lt;")}</span>
          </div>
        `).join("");
      }
    } catch (_) {}
  }

  // ── Init ─────────────────────────────────────────────────

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      injectGrindSelector();
      injectSubscriptionSelector();
      injectReviews();
    });
  } else {
    injectGrindSelector();
    injectSubscriptionSelector();
    injectReviews();
  }

})();
