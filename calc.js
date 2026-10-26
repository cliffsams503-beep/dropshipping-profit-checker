/* Dropshipping Profit Checker – pure calculation functions (no DOM). Works in browser and Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ProfitCalc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DEFAULTS = {
    feePct: 2.9,      // Shopify Basic, online standard card rate (shopify.com/pricing, checked Oct 26 2026)
    feeFixed: 0.30,
    otherCosts: 0,
    shippingCharged: 0,
    targetMarkupPct: 100, // 100% markup = 2x landed cost
    marginRulePct: 50     // Furry Finds rule
  };

  function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

  /** Parse a user-typed value into a number. Accepts "$12.99", "12,99"? (no), " 7 ". Returns NaN if invalid. */
  function parseMoney(v) {
    if (typeof v === 'number') return v;
    if (v === null || v === undefined) return NaN;
    var s = String(v).trim().replace(/^\$/, '').replace(/,/g, '').replace(/%$/, '');
    if (s === '') return NaN;
    if (!/^-?\d*\.?\d+$/.test(s)) return NaN;
    return Number(s);
  }

  /** Round a price up to the next "charm" price ending in .99 (e.g. 12.51 -> 12.99, 13.00 -> 13.99). */
  function charmPrice(p) {
    if (!isFinite(p) || p <= 0) return NaN;
    var c = Math.floor(p) + 0.99;
    if (c + 1e-9 < p) c += 1;
    return round2(c);
  }

  /** Validate raw inputs; returns {values, errors}. Optional fields fall back to defaults when blank. */
  function validate(raw) {
    var errors = {};
    var v = {};
    function field(name, label, opts) {
      var r = raw[name];
      var blank = r === undefined || r === null || String(r).trim() === '';
      if (blank) {
        if (opts.required) { errors[name] = label + ' is required.'; return; }
        v[name] = opts.def; return;
      }
      var n = parseMoney(r);
      if (!isFinite(n)) { errors[name] = label + ' must be a number.'; return; }
      if (n < 0) { errors[name] = label + " can't be negative."; return; }
      if (opts.max !== undefined && n >= opts.max) { errors[name] = label + ' must be under ' + opts.max + '.'; return; }
      v[name] = n;
    }
    field('productCost', 'Product cost', { required: true });
    field('shippingCost', 'Shipping cost', { required: false, def: 0 });
    field('otherCosts', 'Other costs', { required: false, def: DEFAULTS.otherCosts });
    field('feePct', 'Fee %', { required: false, def: DEFAULTS.feePct, max: 100 });
    field('feeFixed', 'Fixed fee', { required: false, def: DEFAULTS.feeFixed });
    field('salePrice', 'Sale price', { required: false, def: NaN });
    field('shippingCharged', 'Shipping charged', { required: false, def: DEFAULTS.shippingCharged });
    field('targetMarkupPct', 'Target markup', { required: false, def: DEFAULTS.targetMarkupPct });
    if (!errors.productCost && !errors.shippingCost && v.productCost + v.shippingCost <= 0) {
      errors.productCost = 'Product cost plus shipping must be more than $0.';
    }
    return { values: v, errors: errors, ok: Object.keys(errors).length === 0 };
  }

  /**
   * Price (item price, excluding any shipping charged) at which, after the payment fee,
   * you keep `netNeeded` dollars. Fee applies to everything the customer pays.
   *   (P + S)(1 - f) - F = netNeeded   =>   P = (netNeeded + F)/(1 - f) - S
   */
  function priceForNet(netNeeded, i) {
    var f = i.feePct / 100;
    if (f >= 1) return NaN;
    return (netNeeded + i.feeFixed) / (1 - f) - i.shippingCharged;
  }

  /** Price where profit = 0. */
  function breakEvenPrice(i) {
    return priceForNet(i.productCost + i.shippingCost + i.otherCosts, i);
  }

  /**
   * Suggested price for a target markup over landed cost, with the fee covered:
   * after fees and other costs you keep landed × (1 + markup). Markup 100% = the 2× landed rule.
   */
  function suggestedPrice(i, markupPct) {
    var m = (markupPct === undefined ? i.targetMarkupPct : markupPct) / 100;
    var landed = i.productCost + i.shippingCost;
    return priceForNet(landed * (1 + m) + i.otherCosts, i);
  }

  /** Lowest price whose margin (profit ÷ customer total) reaches targetMarginPct. */
  function priceForMargin(i, targetMarginPct) {
    var f = i.feePct / 100, t = targetMarginPct / 100;
    if (1 - f - t <= 0) return NaN; // impossible: fees alone eat the margin
    var costs = i.productCost + i.shippingCost + i.otherCosts + i.feeFixed;
    // profit = R(1-f) - costs ; margin = profit/R = t  =>  R = costs/(1-f-t)
    return costs / (1 - f - t) - i.shippingCharged;
  }

  /** Full breakdown for a given sale price. */
  function analyze(i, marginRulePct) {
    var rule = marginRulePct === undefined ? DEFAULTS.marginRulePct : marginRulePct;
    var landed = i.productCost + i.shippingCost;
    var out = {
      landedCost: round2(landed),
      breakEven: round2(breakEvenPrice(i)),
      suggested: round2(suggestedPrice(i)),
      suggested2x: round2(suggestedPrice(i, 100)),
      priceFor50: round2(priceForMargin(i, rule)),
      hasSalePrice: isFinite(i.salePrice)
    };
    out.suggestedCharm = charmPrice(out.suggested);
    if (out.hasSalePrice) {
      var revenue = i.salePrice + i.shippingCharged;
      var fee = revenue * i.feePct / 100 + i.feeFixed;
      var total = landed + i.otherCosts + fee;
      var profit = revenue - total;
      out.revenue = round2(revenue);
      out.fee = round2(fee);
      out.totalCost = round2(total);
      out.profit = round2(profit);
      out.marginPct = revenue > 0 ? round2(profit / revenue * 100) : NaN;
      out.markupPct = round2((revenue - landed) / landed * 100);
      out.clearsRule = isFinite(out.marginPct) && profit / revenue * 100 >= rule - 1e-9;
    }
    return out;
  }

  return {
    DEFAULTS: DEFAULTS, parseMoney: parseMoney, validate: validate, charmPrice: charmPrice,
    breakEvenPrice: breakEvenPrice, suggestedPrice: suggestedPrice, priceForMargin: priceForMargin,
    analyze: analyze, round2: round2
  };
});
