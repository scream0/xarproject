import test from "node:test";
import assert from "node:assert/strict";
import { calculateDashboardStats } from "./dashboardSummary.js";

test("calculateDashboardStats sums revenue and stock alerts from minimal data", () => {
  const result = calculateDashboardStats({
    products: [
      {
        id: "p1",
        variants: [
          { stock: 8 },
          { stock: 2 },
        ],
      },
      {
        id: "p2",
        variants: [
          { stock: 20 },
          { stock: 6 },
        ],
      },
    ],
    orders: [
      { status: "success", amount: 100000 },
      { status: "cancelled", amount: 50000 },
      { status: "processing", amount: 250000 },
    ],
  } as any);

  assert.equal(result.totalRevenue, 350000);
  assert.equal(result.totalOrders, 3);
  assert.equal(result.activeProducts, 2);
  assert.equal(result.lowStockCount, 1);
});

test("calculateDashboardStats ignores non-paid order statuses and zero-value variants", () => {
  const result = calculateDashboardStats({
    products: [
      { id: "p1", variants: [{ stock: 0 }, { stock: 5 }] },
      { id: "p2", variants: [{ stock: null }, { stock: 22 }] },
    ],
    orders: [
      { status: "pending", amount: 99000 },
      { status: "completed", amount: 400000 },
      { status: "failed", amount: 350000 },
    ],
  } as any);

  assert.equal(result.totalRevenue, 400000);
  assert.equal(result.lowStockCount, 3);
  assert.equal(result.activeProducts, 2);
});
