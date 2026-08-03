import { processPaymentWebhook } from "./paymentWebhookService.js";

function createPaymentWebhookHandler({
  updateStatus,
  createJsonResponse = (body, init) => Response.json(body, init),
  onError = (error) => console.error("Payment webhook failed:", error),
}) {
  return async function handleWebhook(request) {
    try {
      const body = await request.json().catch(() => ({}));
      const result = await processPaymentWebhook(body, {
        updateStatus,
      });

      return createJsonResponse({ success: true, order: result.order });
    } catch (error) {
      onError(error);
      return createJsonResponse(
        { success: false, error: error.message || "Internal Server Error" },
        { status: Number(error?.status) || 500 },
      );
    }
  };
}

export { createPaymentWebhookHandler };
