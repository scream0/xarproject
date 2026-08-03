import test from "node:test";
import assert from "node:assert/strict";
import {
  mapGatewayStatus,
  processPaymentWebhook,
} from "./paymentWebhookService.js";
import { updateOrderStatus } from "../../orders/orderService.js";

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

test("mapGatewayStatus maps success statuses to paid", () => {
  assert.equal(mapGatewayStatus("settlement"), "paid");
  assert.equal(mapGatewayStatus("capture"), "paid");
  assert.equal(mapGatewayStatus("success"), "paid");
  assert.equal(mapGatewayStatus(" settlement "), "paid");
});

test("mapGatewayStatus maps failure statuses to cancelled", () => {
  assert.equal(mapGatewayStatus("failure"), "cancelled");
  assert.equal(mapGatewayStatus("deny"), "cancelled");
  assert.equal(mapGatewayStatus("cancel"), "cancelled");
  assert.equal(mapGatewayStatus(" deny "), "cancelled");
});

test("processPaymentWebhook updates order status for successful payment", async () => {
  const calls = [];
  const orderSnapshot = { id: "ORDER-1", status: "paid" };

  const result = await processPaymentWebhook(
    {
      order_id: "ORDER-1",
      transaction_status: "settlement",
    },
    {
      updateStatus: async (orderId, nextStatus, note, metadata) => {
        calls.push({ orderId, nextStatus, note, metadata });
        return orderSnapshot;
      },
    },
  );

  assert.equal(result.nextStatus, "paid");
  assert.deepEqual(result.order, orderSnapshot);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].orderId, "ORDER-1");
  assert.equal(calls[0].nextStatus, "paid");
  assert.match(calls[0].note, /settlement/i);
  assert.equal(calls[0].metadata.gatewayStatusRaw, "settlement");
  assert.equal(calls[0].metadata.gatewayStatusNormalized, "settlement");
  assert.equal(calls[0].metadata.sourceField, "transaction_status");
});

test("processPaymentWebhook writes normalized status in audit note", async () => {
  const calls = [];

  await processPaymentWebhook(
    {
      order_id: "ORDER-NOTE-1",
      transaction_status: "  SeTtLeMeNt  ",
    },
    {
      updateStatus: async (orderId, nextStatus, note, metadata) => {
        calls.push({ orderId, nextStatus, note, metadata });
        return { id: orderId, status: nextStatus, note };
      },
    },
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].nextStatus, "paid");
  assert.equal(calls[0].note, "Webhook payment status: settlement");
  assert.equal(calls[0].metadata.gatewayStatusRaw, "  SeTtLeMeNt  ");
  assert.equal(calls[0].metadata.gatewayStatusNormalized, "settlement");
  assert.equal(calls[0].metadata.sourceField, "transaction_status");
});

test("processPaymentWebhook updates order status for failed payment", async () => {
  const calls = [];

  await processPaymentWebhook(
    {
      orderId: "ORDER-2",
      transaction_status: "failure",
    },
    {
      updateStatus: async (orderId, nextStatus, note, metadata) => {
        calls.push({ orderId, nextStatus, note, metadata });
        return { id: orderId, status: nextStatus, note };
      },
    },
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].orderId, "ORDER-2");
  assert.equal(calls[0].nextStatus, "cancelled");
  assert.match(calls[0].note, /failure/i);
  assert.equal(calls[0].metadata.gatewayStatusRaw, "failure");
  assert.equal(calls[0].metadata.gatewayStatusNormalized, "failure");
  assert.equal(calls[0].metadata.sourceField, "transaction_status");
});

test("processPaymentWebhook maps expire and deny statuses to cancelled", async () => {
  const statuses = ["expire", "deny"];

  for (const gatewayStatus of statuses) {
    const calls = [];

    await processPaymentWebhook(
      {
        orderId: `ORDER-${gatewayStatus}`,
        transaction_status: gatewayStatus,
      },
      {
        updateStatus: async (orderId, nextStatus, note, metadata) => {
          calls.push({ orderId, nextStatus, note, metadata });
          return { id: orderId, status: nextStatus, note };
        },
      },
    );

    assert.equal(calls.length, 1);
    assert.equal(calls[0].nextStatus, "cancelled");
    assert.match(calls[0].note, new RegExp(gatewayStatus, "i"));
    assert.equal(calls[0].metadata.gatewayStatusRaw, gatewayStatus);
    assert.equal(calls[0].metadata.gatewayStatusNormalized, gatewayStatus);
    assert.equal(calls[0].metadata.sourceField, "transaction_status");
  }
});

test("processPaymentWebhook falls back to payment_status metadata when transaction_status is missing", async () => {
  const calls = [];

  await processPaymentWebhook(
    {
      orderId: "ORDER-META-1",
      payment_status: "capture",
    },
    {
      updateStatus: async (orderId, nextStatus, note, metadata) => {
        calls.push({ orderId, nextStatus, note, metadata });
        return { id: orderId, status: nextStatus, note };
      },
    },
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].nextStatus, "paid");
  assert.equal(calls[0].metadata.gatewayStatusRaw, "capture");
  assert.equal(calls[0].metadata.gatewayStatusNormalized, "capture");
  assert.equal(calls[0].metadata.sourceField, "payment_status");
});

test("processPaymentWebhook returns 400 error when order id is missing", async () => {
  await assert.rejects(
    () =>
      processPaymentWebhook(
        {
          transaction_status: "settlement",
        },
        {
          updateStatus: async () => ({ ok: true }),
        },
      ),
    (error) => {
      assert.equal(error.status, 400);
      assert.match(error.message, /orderId is required/i);
      return true;
    },
  );
});

test("processPaymentWebhook with failure status cancels order and restores reserved stock", async () => {
  const productsById = {
    "prod-99": {
      id: "prod-99",
      name: "Parfum Z",
      variants: [
        {
          size: "30ml",
          stock: 8,
          stok: 8,
        },
      ],
    },
  };

  const initialOrder = {
    id: "ORDER-99",
    orderId: "ORDER-99",
    userId: "user-99",
    status: "paid",
    stockReservedAt: "2026-08-04T10:00:00.000Z",
    items: [
      {
        id: "prod-99",
        size: "30ml",
        quantity: 2,
        price: 75000,
      },
    ],
    statusHistory: [],
  };

  const fakeSupabase = createFakeSupabase(productsById);
  const { db, state } = createFakeDb(initialOrder);

  const result = await processPaymentWebhook(
    {
      order_id: "ORDER-99",
      transaction_status: "failure",
    },
    {
      updateStatus: (orderId, nextStatus, note, statusMetadata) =>
        updateOrderStatus(db, orderId, nextStatus, "webhook", note, {
          supabaseClient: fakeSupabase,
          statusMetadata,
        }),
    },
  );

  assert.equal(result.nextStatus, "cancelled");
  assert.equal(state.order.status, "cancelled");
  assert.ok(state.order.stockRestoredAt);
  assert.ok(state.order.stock_restored_at);
  assert.equal(productsById["prod-99"].variants[0].stock, 10);
  assert.equal(productsById["prod-99"].variants[0].stok, 10);
  assert.equal(state.order.last_status_metadata.source_field, "transaction_status");
  assert.equal(state.order.last_status_metadata.gateway_status_raw, "failure");
  assert.equal(state.order.last_status_metadata.gateway_status_normalized, "failure");
  assert.ok(state.order.last_status_metadata.recorded_at);
  assert.ok(state.order.last_status_metadata_recorded_at);
  assert.equal(
    state.order.last_status_metadata.recorded_at,
    state.order.last_status_metadata_recorded_at,
  );
});
