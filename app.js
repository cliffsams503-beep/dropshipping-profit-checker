(function () {
  'use strict';
  var C = window.ProfitCalc;
  var ids = ['productCost','shippingCost','otherCosts','salePrice','shippingCharged','feePct','feeFixed','targetMarkupPct'];
  var el = {}; ids.forEach(function (k) { el[k] = document.getElementById(k); });
  function $(id) { return document.getElementById(id); }
  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  function money(n) { return isFinite(n) ? usd.format(n) : '–'; }
  function pct(n) { return isFinite(n) ? n.toFixed(1) + '%' : '–'; }
  var lastSuggested = NaN;

  // Example: a real Furry Finds listing (read from the store Oct 26 2026).
  var PRESET = { productCost: '6.25', shippingCost: '0', otherCosts: '0', salePrice: '12.99', shippingCharged: '0', feePct: '2.9', feeFixed: '0.30' };

  function markupLabel(v) { return v >= 100 ? '100% (2× landed)' : v + '%'; }

  function render() {
    var raw = {}; ids.forEach(function (k) { raw[k] = el[k].value; });
    $('markupOut').textContent = markupLabel(Number(el.targetMarkupPct.value));
    var res = C.validate(raw);
    ids.forEach(function (k) {
      var e = $(k + '-err'); var msg = res.errors[k] || '';
      // Don't nag about an empty required field before the user has typed anything.
      if (k === 'productCost' && raw.productCost.trim() === '') msg = '';
      if (e) e.textContent = msg;
      el[k].classList.toggle('invalid', !!msg);
    });
    var badge = $('badge');
    var outs = ['o-landed','o-total','o-profit','o-margin','o-markup','o-be','o-sug','o-p50'];
    if (!res.ok) {
      outs.forEach(function (o) { $(o).textContent = '–'; $(o).className = ''; });
      $('o-charm').textContent = '';
      badge.className = 'badge neutral';
      badge.textContent = raw.productCost.trim() === '' ? 'Enter a product cost to start' : 'Fix the highlighted field';
      $('use-sug').disabled = true; lastSuggested = NaN; return;
    }
    var v = res.values, a = C.analyze(v);
    $('o-landed').textContent = money(a.landedCost);
    $('o-be').textContent = money(a.breakEven);
    $('o-sug').textContent = money(a.suggested);
    $('o-charm').textContent = isFinite(a.suggestedCharm) ? '→ list at ' + money(a.suggestedCharm) : '';
    $('o-sug-lbl').textContent = v.targetMarkupPct >= 100 ? '(2× landed, fee covered)' : '(' + v.targetMarkupPct + '% markup, fee covered)';
    $('o-p50').textContent = isFinite(a.priceFor50) ? money(a.priceFor50) : 'not possible with these fees';
    lastSuggested = a.suggestedCharm; $('use-sug').disabled = !isFinite(lastSuggested);
    if (!a.hasSalePrice) {
      ['o-total','o-profit','o-margin','o-markup'].forEach(function (o) { $(o).textContent = '–'; $(o).className = ''; });
      badge.className = 'badge neutral'; badge.textContent = 'Add a sale price to check your margin';
      return;
    }
    $('o-total').textContent = money(a.totalCost);
    $('o-total-sub').textContent = 'incl. ' + money(a.fee) + ' payment fee';
    $('o-profit').textContent = money(a.profit);
    $('o-profit').className = a.profit < 0 ? 'neg' : 'pos';
    $('o-margin').textContent = pct(a.marginPct);
    $('o-markup').textContent = pct(a.markupPct);
    if (a.profit < 0) { badge.className = 'badge bad'; badge.textContent = '✕ Losing money on every order'; }
    else if (a.clearsRule) { badge.className = 'badge ok'; badge.textContent = '✓ Clears 50% margin'; }
    else { badge.className = 'badge bad'; badge.textContent = '✕ Below 50% margin (' + pct(a.marginPct) + ')'; }
  }

  ids.forEach(function (k) { el[k].addEventListener('input', render); });
  $('preset').addEventListener('click', function () {
    Object.keys(PRESET).forEach(function (k) { el[k].value = PRESET[k]; });
    var n = $('preset-note');
    n.hidden = false;
    n.textContent = 'Example: Plush Reindeer Antler Hat (Furry Finds). Listed at $12.99; CJ landed cost $6.25 with shipping already included, so shipping is entered as $0.';
    render();
  });
  $('clear').addEventListener('click', function () {
    ['productCost','shippingCost','salePrice'].forEach(function (k) { el[k].value = ''; });
    el.otherCosts.value = '0'; el.shippingCharged.value = '0'; el.feePct.value = '2.9'; el.feeFixed.value = '0.30';
    $('preset-note').hidden = true; render();
  });
  $('use-sug').addEventListener('click', function () { if (isFinite(lastSuggested)) { el.salePrice.value = lastSuggested.toFixed(2); render(); } });
  render();
})();
