/* assets/js/ga4-affiliate.js
 * 追蹤「前往購買」點擊（含動態內容）
 */
(function () {
  const BTN_MATCHERS = [
    '[data-track="buy"]',
    '.buy-btn', '.btn-buy', '.button-buy',
    'a[href*="s.shopee.tw"]', 'a[href*="shopee.tw"]'
  ];

  function guessTitleFromCard(a) {
    const card = a.closest('.card, .item, .product, li, article, div');
    const trySel = ['[data-title]', '.title', 'h3', 'h4', '.product-title'];
    for (const sel of trySel) {
      const el = card && card.querySelector(sel);
      const t  = el && (el.getAttribute?.('data-title') || el.textContent || '').trim();
      if (t) return t;
    }
    return (a.getAttribute('data-title') || a.title || '').trim();
  }

  function isBuyButton(a) {
    if (!a || a.tagName !== 'A') return false;
    for (const sel of BTN_MATCHERS) {
      try { if (a.matches(sel)) return true; } catch (_) {}
    }
    const txt = (a.textContent || '').replace(/\s+/g, '');
    if (/前往購買|去購買|立即購買|買|下單/.test(txt)) return true;
    return false;
  }

  document.addEventListener('click', function (ev) {
    const a = ev.target.closest && ev.target.closest('a');
    if (!a || !isBuyButton(a)) return;

    const title = guessTitleFromCard(a);
    const href  = a.href;

    ev.preventDefault();
    let navigated = false;
    function go() {
      if (navigated) return;
      navigated = true;
      window.open(href, '_blank', 'noopener');
    }

    try {
      gtag('event', 'affiliate_click', {
        event_category: 'affiliate',
        event_label: href,
        item_name: title || undefined,
        event_callback: go,
        transport_type: 'beacon'
      });
      setTimeout(go, 600);
    } catch (e) {
      go();
    }
  }, { capture: true });
})();
