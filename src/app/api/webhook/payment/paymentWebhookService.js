function createHttpError(message, status = 500) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeGatewayStatusValue(status) {
  const normalized = String(status || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return normalized || "pending";
}

function truncateForNote(value, maxLength = 80) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

function mapGatewayStatus(status) {
  const normalized = normalizeGatewayStatusValue(status);
  if (["settlement", "capture", "success", "paid", "completed"].includes(normalized)) {
    return "paid";
  }
  if (["expire", "failure", "cancel", "cancelled", "deny"].includes(normalized)) {
    return "cancelled";
  }
  return "pending";
}

async function processPaymentWebhook(body = {}, { updateStatus }) {
  if (typeof updateStatus !== "function") {
    throw createHttpError("Webhook handler belum terkonfigurasi dengan benar", 500);
  }

  const orderId = body.order_id || body.orderId || body.order?.id;
  const gatewayStatusRawValue =
    body.transaction_status || body.status || body.payment_status || "pending";
  const gatewayStatusRaw = String(gatewayStatusRawValue ?? "");
  const gatewayStatus = normalizeGatewayStatusValue(gatewayStatusRawValue);
  const sourceField =
    body.transaction_status ? "transaction_status"
      : body.status
        ? "status"
        : body.payment_status
          ? "payment_status"
          : "default";

  if (!orderId) {
    throw createHttpError("orderId is required", 400);
  }

  const nextStatus = mapGatewayStatus(gatewayStatus);
  const note = `Webhook payment status: ${truncateForNote(gatewayStatus)}`;
  const updatedOrder = await updateStatus(orderId, nextStatus, note, {
    gatewayStatusRaw,
    gatewayStatusNormalized: gatewayStatus,
    sourceField,
  });

  return {
    orderId,
    gatewayStatusRaw,
    gatewayStatus,
    sourceField,
    nextStatus,
    order: updatedOrder,
  };
}

export { createHttpError, mapGatewayStatus, processPaymentWebhook };
