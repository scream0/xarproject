import test from "node:test";
import assert from "node:assert/strict";
import { createUserOrderDetailHandler } from "./orderDetailRouteHandler.js";

function mapOrderDoc(doc) {
  const order = doc.data() || {};
  return {
    id: doc.id,
    ...order,
    createdAt: order.createdAt || order.created_at || new Date().toISOString(),
    statusHistory: Array.isArray(order.statusHistory) ? order.statusHistory : [],
  };
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createFakeDb(order) {
  const state = {
    order: deepClone(order),
    orderItems: {
      "item-1": {
        id: "item-1",
        orderId: order.id,
        productId: "prod-1",
        quantity: 1,
      },
    },
    shippingDetails: {
      primary: {
        orderId: order.id,
        courier_name: "JNE",
        tracking_number: "RESI-123",
      },
    },
    orderStatusHistory: {
      initial: {
        id: "initial",
        orderId: order.id,
        status_to: "pending",
        created_at: "2026-08-04T09:00:00.000Z",
      },
    },
  };

  const orderRef = {
    async get() {
      return {
        exists: Boolean(state.order),
        data: () => deepClone(state.order),
      };
    },
    collection(name) {
      if (name === "order_items") {
        return {
          async get() {
            return {
              docs: Object.entries(state.orderItems).map(([id, value]) => ({
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
              async get() {
                const value = state.shippingDetails[docId];
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
          orderBy() {
            return {
              async get() {
                return {
                  docs: Object.entries(state.orderStatusHistory).map(([id, value]) => ({
                    id,
                    data: () => deepClone(value),
                  })),
                };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected subcollection: ${name}`);
    },
  };

  return {
    collection(name) {
      if (name !== "orders") {
        throw new Error(`Unexpected collection: ${name}`);
      }

      return {
        doc(docId) {
          if (docId !== order.id) {
            return {
              async get() {
                return { exists: false, data: () => null };
              },
              collection() {
                return {
                  async get() {
                    return { docs: [] };
                  },
                  doc() {
                    return {
                      async get() {
                        return { exists: false, data: () => null };
                      },
                    };
                  },
                  orderBy() {
                    return {
                      async get() {
                        return { docs: [] };
                      },
                    };
                  },
                };
              },
            };
          }

          return orderRef;
        },
      };
    },
  };
}

test("user order detail handler returns order for owner", async () => {
  const db = createFakeDb({
    id: "order-1",
    orderId: "order-1",
    userId: "user-1",
    status: "pending",
    createdAt: "2026-08-04T10:00:00.000Z",
  });

  const handler = createUserOrderDetailHandler({
    db,
    mapOrderDoc,
    onError: () => {},
  });

  const response = await handler(
    new Request("http://localhost/api/user/orders/order-1?userId=user-1"),
    { params: { id: "order-1" } },
  );

  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.order.id, "order-1");
  assert.equal(body.order.userId, "user-1");
  assert.equal(body.items.length, 1);
  assert.equal(body.statusHistory.length, 1);
});

test("user order detail handler blocks access for different user", async () => {
  const db = createFakeDb({
    id: "order-1",
    orderId: "order-1",
    userId: "user-1",
    status: "pending",
    createdAt: "2026-08-04T10:00:00.000Z",
  });

  const handler = createUserOrderDetailHandler({
    db,
    mapOrderDoc,
    onError: () => {},
  });

  const response = await handler(
    new Request("http://localhost/api/user/orders/order-1?userId=user-2"),
    { params: { id: "order-1" } },
  );

  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.success, false);
  assert.match(body.error, /forbidden/i);
});
