import test from "node:test";
import assert from "node:assert/strict";
import { createOrderRecord, updateOrderStatus } from "./orderService.js";
import { processPaymentWebhook } from "../webhook/payment/paymentWebhookService.js";

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

function createFakeDb() {
  const state = {
    orders: {},
    notifications: [],
  };

  function createOrderRef(orderId) {
    return {
      async get() {
        const order = state.orders[orderId];
        return {
          exists: Boolean(order),
          data: () => (order ? deepClone(order.doc) : null),
        };
      },
      async set(payload, options = {}) {
        const existing = state.orders[orderId] || {
          doc: null,
          orderItems: {},
          shippingDetails: {},
          orderStatusHistory: {},
        };

        if (options.merge && existing.doc) {
          existing.doc = {
            ...existing.doc,
            ...deepClone(payload),
          };
        } else if (options.merge) {
          existing.doc = {
            ...(existing.doc || {}),
            ...deepClone(payload),
          };
        } else {
          existing.doc = deepClone(payload);
        }

        state.orders[orderId] = existing;
      },
      collection(name) {
        if (name === "order_items") {
          return {
            doc(itemId) {
              return {
                async set(payload) {
                  const order = state.orders[orderId];
                  order.orderItems[itemId] = deepClone(payload);
                },
              };
            },
            async get() {
              const order = state.orders[orderId];
              return {
                docs: Object.entries(order.orderItems).map(([id, value]) => ({
                  id,
                  data: () => deepClone(value),
                })),
              };
            },
          };
        }

        if (name === "shipping_details") {
          return {
            doc(docId) {
              return {
                async set(payload) {
                  const order = state.orders[orderId];
                  order.shippingDetails[docId] = deepClone(payload);
                },
                async get() {
                  const order = state.orders[orderId];
                  const value = order.shippingDetails[docId];
                  return {
                    exists: Boolean(value),
                    data: () => deepClone(value),
                  };
                },
              };
            },
          };
        }

        if (name === "order_status_history") {
          return {
            doc(docId) {
              return {
                async set(payload) {
                  const order = state.orders[orderId];
                  order.orderStatusHistory[docId] = deepClone(payload);
                },
              };
            },
          };
        }

        throw new Error(`Unexpected subcollection: ${name}`);
      },
    };
  }

  return {
    state,
    db: {
      collection(name) {
        if (name === "orders") {
          return {
            doc(orderId) {
              return createOrderRef(orderId);
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
    },
  };
}

test("integration journey: checkout -> payment webhook -> admin processing -> delivered", async () => {
  const { db, state } = createFakeDb();
  const productsById = {
    "prod-journey-1": {
      id: "prod-journey-1",
      name: "Parfum Journey",
      variants: [
        {
          size: "50ml",
          stock: 12,
          stok: 12,
        },
      ],
    },
  };

  const orderId = "ORDER-JOURNEY-1";
  const created = await createOrderRecord(db, {
    userId: "user-journey-1",
    orderId,
    items: [
      {
        id: "prod-journey-1",
        size: "50ml",
        quantity: 2,
        price: 150000,
      },
    ],
    amount: 300000,
    status: "pending",
    stockReservedAt: "2026-08-04T08:00:00.000Z",
    customerName: "Journey User",
    customerEmail: "journey@example.com",
    customerPhone: "08123456789",
  });

  assert.equal(created.status, "pending");
  assert.equal(created.orderId, orderId);

  const fakeSupabase = createFakeSupabase(productsById);

  const webhookResult = await processPaymentWebhook(
    {
      order_id: orderId,
      transaction_status: "settlement",
    },
    {
      updateStatus: (targetOrderId, nextStatus, note, statusMetadata) =>
        updateOrderStatus(db, targetOrderId, nextStatus, "webhook", note, {
          supabaseClient: fakeSupabase,
          statusMetadata,
        }),
    },
  );

  assert.equal(webhookResult.nextStatus, "paid");
  assert.equal(state.orders[orderId].doc.status, "paid");

  const afterProcessing = await updateOrderStatus(
    db,
    orderId,
    "processing",
    "admin",
    "Admin memproses pesanan",
    { supabaseClient: fakeSupabase },
  );

  assert.equal(afterProcessing.status, "processing");

  const afterDelivered = await updateOrderStatus(
    db,
    orderId,
    "delivered",
    "admin",
    "Pesanan diterima customer",
    { supabaseClient: fakeSupabase },
  );

  assert.equal(afterDelivered.status, "delivered");
  assert.ok(afterDelivered.completed_at);

  const latestDoc = state.orders[orderId].doc;
  assert.equal(latestDoc.status, "delivered");
  assert.equal(Array.isArray(latestDoc.statusHistory), true);
  assert.ok(latestDoc.statusHistory.length >= 4);

  const historyStatuses = latestDoc.statusHistory.map((entry) => entry.status_to);
  assert.equal(historyStatuses[0], "pending");
  assert.equal(historyStatuses.includes("paid"), true);
  assert.equal(historyStatuses.includes("processing"), true);
  assert.equal(historyStatuses.includes("delivered"), true);

  assert.ok(latestDoc.last_status_metadata);
  assert.equal(latestDoc.last_status_metadata.source_field, "transaction_status");
  assert.equal(latestDoc.last_status_metadata.gateway_status_normalized, "settlement");
  assert.ok(latestDoc.last_status_metadata_recorded_at);
});
