import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRequestedItems,
  createCheckoutReservationService,
} from "./checkoutReservationService.js";

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
  const lockState = {};

  return {
    lockState,
    db: {
      collection(name) {
        if (name !== "inventory_locks") {
          throw new Error(`Unexpected collection: ${name}`);
        }

        return {
          doc(lockKey) {
            return { id: lockKey };
          },
        };
      },
      async runTransaction(handler) {
        const transaction = {
          async get(lockRef) {
            const data = lockState[lockRef.id];
            return {
              exists: Boolean(data),
              data: () => deepClone(data),
            };
          },
          set(lockRef, payload) {
            lockState[lockRef.id] = {
              ...(lockState[lockRef.id] || {}),
              ...deepClone(payload),
            };
          },
          delete(lockRef) {
            delete lockState[lockRef.id];
          },
        };

        await handler(transaction);
      },
    },
  };
}

test("buildRequestedItems merges duplicate product variant lines", () => {
  const requested = buildRequestedItems([
    { id: "p1", size: "50ml", quantity: 1, name: "A" },
    { id: "p1", size: "50ML", quantity: 2, name: "A" },
  ]);

  assert.equal(requested.length, 1);
  assert.equal(requested[0].quantity, 3);
  assert.equal(requested[0].variantNormalized, "50ml");
});

test("acquireInventoryLock blocks concurrent owner on same product key", async () => {
  const { db, lockState } = createFakeDb();
  const service = createCheckoutReservationService({
    db,
    supabase: null,
    lockRetryCount: 1,
    lockRetryDelayMs: 1,
  });

  const lockKey = "product:p1:variant:50ml";
  await service.acquireInventoryLock(lockKey, "owner-1");

  await assert.rejects(
    () => service.acquireInventoryLock(lockKey, "owner-2"),
    (error) => {
      assert.equal(error.status, 409);
      assert.match(error.message, /memproses stok produk yang sama/i);
      return true;
    },
  );

  assert.equal(lockState[lockKey].ownerId, "owner-1");

  await service.releaseInventoryLocks([{ id: lockKey }], "owner-1");
  assert.equal(lockState[lockKey], undefined);
});

test("reserveStockInSupabase prevents stock from going below zero", async () => {
  const { db } = createFakeDb();
  const productsById = {
    p1: {
      id: "p1",
      name: "Parfum Race",
      variants: [{ size: "50ml", stock: 1, stok: 1 }],
    },
  };

  const service = createCheckoutReservationService({
    db,
    supabase: createFakeSupabase(productsById),
  });

  const firstReservation = await service.reserveStockInSupabase([
    {
      productId: "p1",
      variantSize: "50ml",
      variantNormalized: "50ml",
      quantity: 1,
      productName: "Parfum Race",
    },
  ]);

  assert.equal(productsById.p1.variants[0].stock, 0);
  assert.equal(firstReservation.length, 1);

  await assert.rejects(
    () =>
      service.reserveStockInSupabase([
        {
          productId: "p1",
          variantSize: "50ml",
          variantNormalized: "50ml",
          quantity: 1,
          productName: "Parfum Race",
        },
      ]),
    (error) => {
      assert.equal(error.status, 409);
      assert.match(error.message, /stok/i);
      return true;
    },
  );

  assert.equal(productsById.p1.variants[0].stock, 0);
});
