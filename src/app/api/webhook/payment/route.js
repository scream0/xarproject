import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { updateOrderStatus } from "@/app/api/orders/orderService";
import { createPaymentWebhookHandler } from "./paymentWebhookRouteHandler";

export const dynamic = "force-dynamic";

const MAX_AUDIT_SEGMENT_LENGTH = 80;
const MAX_AUDIT_NOTE_LENGTH = 280;

function sanitizeAuditValue(value, maxLength = MAX_AUDIT_SEGMENT_LENGTH) {
  const cleaned = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return "";
  }

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return `${cleaned.slice(0, maxLength - 3)}...`;
}

function truncateAuditNote(note, maxLength = MAX_AUDIT_NOTE_LENGTH) {
  if (note.length <= maxLength) {
    return note;
  }

  return `${note.slice(0, maxLength - 3)}...`;
}

const paymentWebhookHandler = createPaymentWebhookHandler({
  updateStatus: (orderId, nextStatus, note, metadata = {}) => {
    const details = [
      `source=${sanitizeAuditValue(metadata.sourceField || "unknown", 24)}`,
      `raw=${sanitizeAuditValue(metadata.gatewayStatusRaw || "")}`,
      `normalized=${sanitizeAuditValue(metadata.gatewayStatusNormalized || "")}`,
    ].join(" | ");

    const safeBaseNote = sanitizeAuditValue(note, 140) || "Webhook payment status: pending";
    const auditNote = truncateAuditNote(`${safeBaseNote} (${details})`);
    return updateOrderStatus(db, orderId, nextStatus, "webhook", auditNote, {
      statusMetadata: metadata,
    });
  },
  createJsonResponse: (body, init) => NextResponse.json(body, init),
});

export async function POST(request) {
  return paymentWebhookHandler(request);
}
