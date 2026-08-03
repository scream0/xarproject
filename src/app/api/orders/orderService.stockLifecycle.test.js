import test from "node:test";
import assert from "node:assert/strict";
import { updateOrderStatus } from "./orderService.js";

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createFakeSupabase(productsById) {
  return {
    from(table) {
      if (table !== "products") {
        throw new Error(`Unexpected table: ${table}`);
      }

      let selectedId = null;
      let pendingUpdate = null;

      const api = {
        select() {
          return api;
        },
        update(payload) {
          pendingUpdate = payload;
          return api;
        },
        eq(column, value) {
          if (column !== "id") {
            throw new Error(`Unexpected filter column: ${column}`);
          }

          selectedId = String(value);

          if (pendingUpdate) {
            const target = productsById[selectedId];
            if (!target) {
              return Promise.resolve({ error: new Error("not found") });
            }
            target.variants = deepClone(pendingUpdate.variants || []);
            return Promise.resolve({ error: null });
          }

          return {
            async single() {
              const product = productsById[selectedId];
              if (!product) {
                return { data: null, error: new Error("not found") };
              }

              return {
                data: deepClone(product),
                error: null,
              };
            },
          };
        },
      };

      return api;
    },
  };
}

function createFakeDb(initialOrder) {
  const state = {
    order: deepClone(initialOrder),
    history: {},
    notifications: [],
  };

  const orderRef = {
    async get() {
      return {
        exists: Boolean(state.order),
        data: () => deepClone(state.order),
      };
    },
    async set(payload, options = {}) {
      if (!options.merge) {
        state.order = deepClone(payload);
        return;
      }

      state.order = {
        ...state.order,
        ...deepClone(payload),
      };
    },
    collection(name) {
      if (name === "order_status_history") {
        return {
          doc(docId) {
            return {
              async set(payload) {
                state.history[docId] = deepClone(payload);
              },
            };
          },
        };
      }
      throw new Error(`Unexpected subcollection: ${name}`);
    },
  };

  const db = {
    collection(name) {
      if (name === "orders") {
        return {
          doc(docId) {
            if (docId !== state.order.id) {
              return {
                async get() {
                  return { exists: false, data: () => null };
                },
              };
            }
            return orderRef;
          },
        };
      }

      if (name === "notifications") {
        return {
          async add(payload) {
            state.notifications.push(deepClone(payload));
            return { id: `n-${state.notifications.length}` };
          },
        };
      }

      throw new Error(`Unexpected collection: ${name}`);
    },
  };

  return { db, state };
}

test("updateOrderStatus restores reserved stock once when order is cancelled", async () => {
  const productsById = {
    "prod-1": {
      id: "prod-1",
      name: "Parfum A",
      variants: [
        {
          size: "50ml",
          stock: 7,
          stok: 7,
        },
      ],
    },
  };

  const initialOrder = {
    id: "order-1",
    orderId: "order-1",
    userId: "user-1",
    status: "pending",
    stockReservedAt: "2026-08-04T10:00:00.000Z",
    items: [
      {
        id: "prod-1",
        size: "50ml",
        quantity: 3,
        price: 100000,
      },
    ],
    statusHistory: [],
  };

  const { db, state } = createFakeDb(initialOrder);
  const fakeSupabase = createFakeSupabase(productsById);

  const firstCancel = await updateOrderStatus(
    db,
    "order-1",
    "cancelled",
    "customer",
    "Cancel test",
    { supabaseClient: fakeSupabase },
  );

  assert.equal(firstCancel.status, "cancelled");
  assert.equal(productsById["prod-1"].variants[0].stock, 10);
  assert.equal(productsById["prod-1"].variants[0].stok, 10);
  assert.ok(state.order.stockRestoredAt);
  assert.ok(state.order.stock_restored_at);

  await updateOrderStatus(
    db,
    "order-1",
    "cancelled",
    "customer",
    "Cancel test duplicate",
    { supabaseClient: fakeSupabase },
  );

  assert.equal(productsById["prod-1"].variants[0].stock, 10);
  assert.equal(productsById["prod-1"].variants[0].stok, 10);
});

test("updateOrderStatus stores bounded status metadata for audit", async () => {
  const initialOrder = {
    id: "order-meta-1",
    orderId: "order-meta-1",
    userId: "user-meta-1",
    status: "pending",
    items: [],
    statusHistory: [],
  };

  const { db, state } = createFakeDb(initialOrder);

  await updateOrderStatus(
    db,
    "order-meta-1",
    "paid",
    "webhook",
    "Webhook payment status: settlement",
    {
      statusMetadata: {
        sourceField: "payment_status",
        gatewayStatusRaw: `${"A".repeat(100)}\n${"B".repeat(100)}`,
        gatewayStatusNormalized: `${"settlement".repeat(10)}`,
      },
    },
  );

  assert.ok(state.order.last_status_metadata);
  assert.equal(state.order.last_status_metadata.source_field, "payment_status");
  assert.ok(state.order.last_status_metadata.gateway_status_raw.length <= 120);
  assert.ok(state.order.last_status_metadata.gateway_status_normalized.length <= 64);
  assert.ok(state.order.last_status_metadata.recorded_at);
  assert.ok(state.order.last_status_metadata_recorded_at);
  assert.equal(
    state.order.last_status_metadata.recorded_at,
    state.order.last_status_metadata_recorded_at,
  );
  assert.ok(!state.order.last_status_metadata.gateway_status_raw.includes("\n"));
  assert.ok(state.order.last_status_metadata.gateway_status_raw.includes("..."));
  assert.ok(state.order.last_status_metadata.gateway_status_normalized.includes("..."));

  const latestHistory = state.order.statusHistory[state.order.statusHistory.length - 1];
  assert.ok(latestHistory.status_metadata);
  assert.equal(
    latestHistory.status_metadata.gateway_status_raw,
    state.order.last_status_metadata.gateway_status_raw,
  );
  assert.equal(latestHistory.status_metadata.recorded_at, state.order.last_status_metadata.recorded_at);
});
