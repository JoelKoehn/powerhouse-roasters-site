// Email popup + banner — 10s delay or exit intent, suppressed by cookie for 30 days
(function () {
  const COOKIE_NAME = "ph_popup_dismissed";
  const DISCOUNT_CODE = "POWERHOUSE10";

  function hasCookie() {
    return document.cookie.split(";").some(c => c.trim().startsWith(COOKIE_NAME + "="));
  }

  function setCookie() {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    document.cookie = `${COOKIE_NAME}=1; expires=${d.toUTCString()}; path=/`;
  }

  function injectBanner() {
    if (document.getElementById("email-banner")) return;
    const el = document.createElement("div");
    el.id = "email-banner";
    el.className = "email-banner";
    el.innerHTML = `
      Sign up for emails and get <strong>10% off your first order</strong> — use code <strong>${DISCOUNT_CODE}</strong>
      <button class="email-banner-close" onclick="this.closest('.email-banner').remove()" aria-label="Close">✕</button>
    `;
    document.body.insertBefore(el, document.body.firstChild);
  }

  function injectPopup() {
    if (document.getElementById("email-popup")) return;

    const overlay = document.createElement("div");
    overlay.id = "email-popup";
    overlay.className = "popup-overlay";
    overlay.innerHTML = `
      <div class="popup-box" role="dialog" aria-modal="true" aria-label="Email signup">
        <button class="popup-close" id="popup-close-btn" aria-label="Close">✕</button>
        <div class="popup-eyebrow">Exclusive Offer</div>
        <h2 class="popup-headline">10% Off<br>Your First Order</h2>
        <p class="popup-sub">Join the Powerhouse community and get a discount code sent straight to your inbox.</p>
        <form class="popup-form" id="popup-form" novalidate>
          <input type="email" class="popup-input" id="popup-email" placeholder="Your email address" required>
          <button type="submit" class="popup-submit">Claim 10% Off</button>
        </form>
        <p class="popup-disclaimer">No spam, ever. Unsubscribe anytime.</p>
        <p class="popup-success" id="popup-success">✓ Check your inbox for your discount code!</p>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closePopup();
    });

    document.getElementById("popup-close-btn").addEventListener("click", closePopup);

    document.getElementById("popup-form").addEventListener("submit", async function (e) {
      e.preventDefault();
      const email = document.getElementById("popup-email").value.trim();
      if (!email) return;

      const btn = this.querySelector(".popup-submit");
      btn.disabled = true;
      btn.textContent = "Sending...";

      try {
        await fetch("/.netlify/functions/subscribe-mailchimp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email })
        });
      } catch (_) {}

      document.getElementById("popup-success").style.display = "block";
      this.style.display = "none";
      setCookie();
      setTimeout(closePopup, 3500);
    });

    requestAnimationFrame(() => {
      requestAnimationFrame(() => overlay.classList.add("open"));
    });
  }

  function closePopup() {
    const overlay = document.getElementById("email-popup");
    if (!overlay) return;
    overlay.classList.remove("open");
    setCookie();
    setTimeout(() => overlay.remove(), 400);
  }

  function init() {
    if (hasCookie()) {
      injectBanner();
      return;
    }

    // 10-second delay popup
    const timer = setTimeout(() => {
      if (!hasCookie()) injectPopup();
    }, 10000);

    // Exit-intent (desktop only)
    document.addEventListener("mouseleave", function handler(e) {
      if (e.clientY <= 0 && !hasCookie()) {
        clearTimeout(timer);
        document.removeEventListener("mouseleave", handler);
        injectPopup();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
