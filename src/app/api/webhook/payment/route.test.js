import test from "node:test";
import assert from "node:assert/strict";
import { createPaymentWebhookHandler } from "./paymentWebhookRouteHandler.js";

function createTestHandler(updateStatus) {
  return createPaymentWebhookHandler({
    updateStatus,
    onError: () => {},
  });
}

function createJsonRequest(payload) {
  return new Request("http://localhost/api/webhook/payment", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

test("POST webhook handler returns 200 and success payload", async () => {
  const calls = [];
  const handler = createTestHandler(async (orderId, nextStatus, note) => {
      calls.push({ orderId, nextStatus, note });
      return { id: orderId, status: nextStatus };
  });

  const response = await handler(
    createJsonRequest({
      order_id: "ORDER-ROUTE-1",
      transaction_status: "settlement",
    }),
  );

  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.order.id, "ORDER-ROUTE-1");
  assert.equal(body.order.status, "paid");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].orderId, "ORDER-ROUTE-1");
  assert.equal(calls[0].nextStatus, "paid");
});

test("POST webhook handler maps deny status to cancelled", async () => {
  const calls = [];
  const handler = createTestHandler(async (orderId, nextStatus, note) => {
      calls.push({ orderId, nextStatus, note });
      return { id: orderId, status: nextStatus, note };
  });

  const response = await handler(
    createJsonRequest({
      orderId: "ORDER-ROUTE-2",
      transaction_status: "deny",
    }),
  );

  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].nextStatus, "cancelled");
  assert.match(calls[0].note, /deny/i);
});

test("POST webhook handler maps expire status to cancelled", async () => {
  const calls = [];
  const handler = createTestHandler(async (orderId, nextStatus, note) => {
    calls.push({ orderId, nextStatus, note });
    return { id: orderId, status: nextStatus, note };
  });

  const response = await handler(
    createJsonRequest({
      orderId: "ORDER-ROUTE-3",
      transaction_status: "expire",
    }),
  );

  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].nextStatus, "cancelled");
  assert.match(calls[0].note, /expire/i);
});

test("POST webhook handler returns 400 for missing order id", async () => {
  const handler = createTestHandler(async () => ({ ok: true }));

  const response = await handler(
    createJsonRequest({
      transaction_status: "settlement",
    }),
  );

  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.success, false);
  assert.match(body.error, /orderId is required/i);
});

test("POST webhook handler falls back to pending when transaction status is empty", async () => {
  const calls = [];
  const handler = createTestHandler(async (orderId, nextStatus, note) => {
    calls.push({ orderId, nextStatus, note });
    return { id: orderId, status: nextStatus, note };
  });

  const response = await handler(
    createJsonRequest({
      orderId: "ORDER-ROUTE-4",
      transaction_status: "",
    }),
  );

  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].nextStatus, "pending");
  assert.match(calls[0].note, /pending/i);
});

test("POST webhook handler uses payment_status when transaction_status is missing", async () => {
  const calls = [];
  const handler = createTestHandler(async (orderId, nextStatus, note) => {
    calls.push({ orderId, nextStatus, note });
    return { id: orderId, status: nextStatus, note };
  });

  const response = await handler(
    createJsonRequest({
      orderId: "ORDER-ROUTE-5",
      payment_status: "capture",
    }),
  );

  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].nextStatus, "paid");
  assert.match(calls[0].note, /capture/i);
});

test("POST webhook handler forwards raw and normalized status metadata", async () => {
  const calls = [];
  const handler = createTestHandler(async (orderId, nextStatus, note, metadata) => {
    calls.push({ orderId, nextStatus, note, metadata });
    return { id: orderId, status: nextStatus, note };
  });

  const response = await handler(
    createJsonRequest({
      orderId: "ORDER-ROUTE-5B",
      payment_status: "  CaPtUrE  ",
    }),
  );

  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].nextStatus, "paid");
  assert.equal(calls[0].metadata.gatewayStatusRaw, "  CaPtUrE  ");
  assert.equal(calls[0].metadata.gatewayStatusNormalized, "capture");
  assert.equal(calls[0].metadata.sourceField, "payment_status");
});

test("POST webhook handler keeps audit note bounded when raw status is very long", async () => {
  const calls = [];
  const veryLongStatus = `${"X".repeat(260)}\n${"Y".repeat(260)}`;
  const handler = createTestHandler(async (orderId, nextStatus, note, metadata) => {
    calls.push({ orderId, nextStatus, note, metadata });
    return { id: orderId, status: nextStatus, note };
  });

  const response = await handler(
    createJsonRequest({
      orderId: "ORDER-ROUTE-5C",
      payment_status: veryLongStatus,
    }),
  );

  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].note.length <= 120);
  assert.match(calls[0].note, /Webhook payment status:/i);
  assert.ok(!calls[0].note.includes("\n"));
  assert.ok(calls[0].note.includes("..."));
  assert.equal(calls[0].metadata.gatewayStatusRaw, veryLongStatus);
});

test("POST webhook handler prioritizes transaction_status over payment_status", async () => {
  const scenarios = [
    {
      payload: {
        orderId: "ORDER-ROUTE-6A",
        transaction_status: "settlement",
        payment_status: "deny",
      },
      expectedStatus: "paid",
      expectedNotePart: "settlement",
    },
    {
      payload: {
        orderId: "ORDER-ROUTE-6B",
        transaction_status: "deny",
        payment_status: "capture",
      },
      expectedStatus: "cancelled",
      expectedNotePart: "deny",
    },
  ];

  for (const scenario of scenarios) {
    const calls = [];
    const handler = createTestHandler(async (orderId, nextStatus, note) => {
      calls.push({ orderId, nextStatus, note });
      return { id: orderId, status: nextStatus, note };
    });

    const response = await handler(createJsonRequest(scenario.payload));
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].nextStatus, scenario.expectedStatus);
    assert.match(calls[0].note, new RegExp(scenario.expectedNotePart, "i"));
  }
});
