// eslint-disable-next-line @typescript-eslint/no-require-imports
const test = require('node:test');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const assert = require('node:assert/strict');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { sortOrdersByNewestFirst } = require('./orderSorting');

test('sortOrdersByNewestFirst puts the most recent order first', () => {
  const orders = [
    { id: 'old', createdAt: '2024-01-10T10:00:00.000Z' },
    { id: 'newer', createdAt: '2024-02-20T10:00:00.000Z' },
    { id: 'newest', createdAt: '2024-03-05T10:00:00.000Z' },
  ];

  const sorted = sortOrdersByNewestFirst(orders);

  assert.deepEqual(sorted.map((order) => order.id), ['newest', 'newer', 'old']);
});
