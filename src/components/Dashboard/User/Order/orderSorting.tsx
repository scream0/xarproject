// @ts-nocheck
function normalizeTimestamp(value: any) {
  if (!value) return 0;

  if (typeof value === 'number') return value;

  if (typeof value === 'object' && value !== null && typeof value.seconds === 'number') {
    return value.seconds * 1000;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function sortOrdersByNewestFirst(orders = []) {
  return [...orders].sort((a, b) => {
    const timeA = normalizeTimestamp(a.createdAt || a.created_at || a.timestamp || a.date);
    const timeB = normalizeTimestamp(b.createdAt || b.created_at || b.timestamp || b.date);

    return timeB - timeA;
  });
}

module.exports = {
  normalizeTimestamp,
  sortOrdersByNewestFirst,
};
