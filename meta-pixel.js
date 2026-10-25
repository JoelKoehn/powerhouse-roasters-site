// Meta Pixel for powerhouseroasters.com (dataset "Powerhouse Roasters Website",
// id 2154409848483174, in the Koehn Social Strategies business portfolio).
//
// Fires PageView on every page that loads this file, and Purchase on the order
// confirmation page. AddToCart fires from cart.js itself (addToCart()) rather
// than from a click listener here, since that's the single place every add-to-cart
// path -- button clicks, quantity changes, grind selection -- actually goes through.
//
// Purchase doesn't carry a value/currency yet: the client side has no reliable way
// to know the real order total at this point. The Stripe webhook already sees the
// exact total on every completed order, so routing Purchase through Meta's
// Conversions API from there (server-side) instead of/alongside this pixel call
// would be the accurate way to add it -- worth doing once there's ad spend relying
// on value-based optimization.
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '2154409848483174');
fbq('track', 'PageView');

if (/\/thank-you\/?$/.test(location.pathname)) {
  fbq('track', 'Purchase');
}

document.addEventListener('click', function (e) {
  var a = e.target && e.target.closest ? e.target.closest('a[href^="tel:"],a[href^="sms:"]') : null;
  if (a && window.fbq) fbq('track', 'Contact');
});
