// @ts-nocheck
// eslint-disable-next-line @typescript-eslint/no-require-imports
const test = require('node:test');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const assert = require('node:assert/strict');

function calculateOrderStats(orders: any) {
  const total = orders.length;
  const pending = orders.filter((o: any) => ['pending', 'unpaid'].includes(o.status)).length;
  const processing = orders.filter((o: any) => ['paid', 'success', 'processing', 'settlement', 'capture'].includes(o.status)).length;
  const shipping = orders.filter((o: any) => ['shipping', 'shipped'].includes(o.status)).length;
  const history = orders.filter((o: any) => ['completed', 'delivered', 'cancelled', 'canceled'].includes(o.status)).length;
  const returnCount = orders.filter((o: any) => ['return_requested', 'returning', 'returned'].includes(o.status)).length;

  return { total, pending, processing, shipping, history, return: returnCount };
}

test('calculateOrderStats accurately counts paid and settlement orders as Sedang Dikemas', () => {
  const orders = [
    { id: 'ORD-1', status: 'pending' },
    { id: 'ORD-2', status: 'paid' },
    { id: 'ORD-3', status: 'settlement' },
    { id: 'ORD-4', status: 'success' },
    { id: 'ORD-5', status: 'processing' },
    { id: 'ORD-6', status: 'shipping' },
    { id: 'ORD-7', status: 'completed' },
    { id: 'ORD-8', status: 'cancelled' },
    { id: 'ORD-9', status: 'return_requested' },
  ];

  const stats = calculateOrderStats(orders);

  assert.equal(stats.total, 9);
  assert.equal(stats.pending, 1);
  assert.equal(stats.processing, 4); // paid, settlement, success, processing
  assert.equal(stats.shipping, 1);
  assert.equal(stats.history, 2); // completed, cancelled
  assert.equal(stats.return, 1);
});
