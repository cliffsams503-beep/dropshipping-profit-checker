// Run: node --test calc.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('./calc.js');
const near = (a, b, eps = 0.005) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const inputs = (o) => C.validate(o).values;

test('Furry Finds antler hat: $6.25 landed, $12.99 price, Shopify Basic fee', () => {
  const a = C.analyze(inputs({ productCost: '6.25', shippingCost: '0', salePrice: '12.99' }));
  near(a.landedCost, 6.25); near(a.fee, 0.68); near(a.totalCost, 6.93);
  near(a.profit, 6.06); near(a.marginPct, 46.68); near(a.markupPct, 107.84);
  near(a.breakEven, 6.75); near(a.suggested2x, 13.18); assert.equal(a.suggestedCharm, 13.99);
  near(a.priceFor50, 13.91);
  assert.equal(a.clearsRule, false); // 51.9% before fees, 46.7% after fees
});

test('shipping charged to customer, other costs and custom fee', () => {
  const a = C.analyze(inputs({ productCost: 5, shippingCost: 3, otherCosts: 1, salePrice: 20, shippingCharged: 4.99, feePct: 3, feeFixed: 0.5 }));
  near(a.revenue, 24.99); near(a.fee, 1.25); near(a.totalCost, 10.25); near(a.profit, 14.74); near(a.marginPct, 58.98);
  assert.equal(a.clearsRule, true);
});

test('suggested price keeps landed × (1+markup) after fees, for every slider step', () => {
  const v = inputs({ productCost: 4.1, shippingCost: 3.2, otherCosts: 0.5 });
  for (let m = 30; m <= 100; m += 5) {
    const p = C.suggestedPrice(v, m);
    const net = p * (1 - 0.029) - 0.30 - 0.5;
    near(net, 7.3 * (1 + m / 100), 1e-9);
  }
});

test('break-even price gives zero profit; price-for-50% gives exactly 50%', () => {
  const v = inputs({ productCost: 8.74, shippingCost: 0 });
  const be = C.breakEvenPrice(v);
  near(C.analyze({ ...v, salePrice: be }).profit, 0, 1e-9);
  const p50 = C.priceForMargin(v, 50);
  near(C.analyze({ ...v, salePrice: p50 }).marginPct, 50, 0.005);
  assert.equal(C.analyze({ ...v, salePrice: p50 }).clearsRule, true);
});

test('impossible margin returns NaN', () => {
  assert.ok(Number.isNaN(C.priceForMargin(inputs({ productCost: 5, feePct: 60 }), 50)));
});

test('charm pricing rounds up to .99', () => {
  assert.equal(C.charmPrice(12.51), 12.99); assert.equal(C.charmPrice(13.0), 13.99);
  assert.equal(C.charmPrice(12.99), 12.99); assert.ok(Number.isNaN(C.charmPrice(-1)));
});

test('bad input is reported, not computed', () => {
  assert.equal(C.validate({}).ok, false);
  assert.match(C.validate({ productCost: 'abc' }).errors.productCost, /number/);
  assert.match(C.validate({ productCost: '-3' }).errors.productCost, /negative/);
  assert.match(C.validate({ productCost: '5', feePct: '100' }).errors.feePct, /under/);
  assert.match(C.validate({ productCost: '0', shippingCost: '0' }).errors.productCost, /more than/);
  assert.equal(C.validate({ productCost: '$6.25', salePrice: '1,299' }).values.salePrice, 1299);
});

test('defaults: blank optional fields use Shopify Basic 2.9% + $0.30, free shipping', () => {
  const v = inputs({ productCost: '5' });
  assert.equal(v.feePct, 2.9); assert.equal(v.feeFixed, 0.3); assert.equal(v.shippingCharged, 0); assert.equal(v.otherCosts, 0);
  assert.equal(C.analyze(v).hasSalePrice, false);
});

test('losing money is flagged', () => {
  const a = C.analyze(inputs({ productCost: 10, shippingCost: 4, salePrice: 12 }));
  assert.ok(a.profit < 0); assert.equal(a.clearsRule, false);
});
