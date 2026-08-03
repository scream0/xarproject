import test from "node:test";
import assert from "node:assert/strict";
import {
  filterOrdersWithWebhookMetadata,
  getLastStatusMetadataRecordedAt,
  hasWebhookStatusMetadata,
  sortOrdersByWebhookLatest,
} from "./orderService.js";

test("getLastStatusMetadataRecordedAt reads flattened and nested metadata timestamp", () => {
  const flattened = {
    id: "o-1",
    last_status_metadata_recorded_at: "2026-08-04T09:00:00.000Z",
  };

  const nested = {
    id: "o-2",
    last_status_metadata: {
      recorded_at: "2026-08-04T10:00:00.000Z",
    },
  };

  assert.equal(
    getLastStatusMetadataRecordedAt(flattened),
    "2026-08-04T09:00:00.000Z",
  );
  assert.equal(
    getLastStatusMetadataRecordedAt(nested),
    "2026-08-04T10:00:00.000Z",
  );
});

test("filterOrdersWithWebhookMetadata keeps only webhook-tagged orders", () => {
  const orders = [
    {
      id: "with-flat",
      last_status_metadata_recorded_at: "2026-08-04T11:00:00.000Z",
    },
    {
      id: "with-nested",
      last_status_metadata: {
        recorded_at: "2026-08-04T12:00:00.000Z",
      },
    },
    {
      id: "without",
      createdAt: "2026-08-04T13:00:00.000Z",
    },
  ];

  const filtered = filterOrdersWithWebhookMetadata(orders);

  assert.deepEqual(filtered.map((order) => order.id), ["with-flat", "with-nested"]);
  assert.equal(hasWebhookStatusMetadata(orders[0]), true);
  assert.equal(hasWebhookStatusMetadata(orders[1]), true);
  assert.equal(hasWebhookStatusMetadata(orders[2]), false);
});

test("sortOrdersByWebhookLatest sorts by newest webhook timestamp with createdAt fallback", () => {
  const orders = [
    {
      id: "fallback-later",
      createdAt: "2026-08-04T14:00:00.000Z",
      last_status_metadata_recorded_at: "2026-08-04T10:00:00.000Z",
    },
    {
      id: "webhook-newest",
      createdAt: "2026-08-04T09:00:00.000Z",
      last_status_metadata_recorded_at: "2026-08-04T13:00:00.000Z",
    },
    {
      id: "fallback-earlier",
      createdAt: "2026-08-04T08:00:00.000Z",
      last_status_metadata_recorded_at: "2026-08-04T10:00:00.000Z",
    },
    {
      id: "no-webhook",
      createdAt: "2026-08-04T15:00:00.000Z",
    },
  ];

  const sorted = sortOrdersByWebhookLatest(orders);

  assert.deepEqual(sorted.map((order) => order.id), [
    "webhook-newest",
    "fallback-later",
    "fallback-earlier",
    "no-webhook",
  ]);
  assert.notEqual(sorted, orders);
});
