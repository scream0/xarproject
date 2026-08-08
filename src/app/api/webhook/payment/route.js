import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createPaymentWebhookHandler } from "./paymentWebhookRouteHandler";

export const dynamic = "force-dynamic";

const MAX_AUDIT_SEGMENT_LENGTH = 80;
const MAX_AUDIT_NOTE_LENGTH = 280;

function sanitizeAuditValue(value, maxLength = MAX_AUDIT_SEGMENT_LENGTH) {
  const cleaned = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength - 3)}...`;
}

function truncateAuditNote(note, maxLength = MAX_AUDIT_NOTE_LENGTH) {
  if (note.length <= maxLength) return note;
  return `${note.slice(0, maxLength - 3)}...`;
}

// Tandai voucher sebagai terpakai — dipanggil hanya saat status order jadi "paid"
async function markVoucherAsUsed(order) {
  if (!order?.voucher_claim_id) return;

  const { error } = await supabaseAdmin
    .from("user_vouchers")
    .update({
      used_at: new Date().toISOString(),
      order_id: order.id,
    })
    .eq("id", order.voucher_claim_id)
    .is("used_at", null); // safety: cuma update kalau belum pernah dipakai

  if (error) {
    console.error("Gagal menandai voucher sebagai used:", error.message);
    // Tidak melempar error — status order tetap berhasil diupdate walau ini gagal
  }
}

const paymentWebhookHandler = createPaymentWebhookHandler({
  updateStatus: async (orderId, nextStatus, note, metadata = {}) => {
    const details = [
      `source=${sanitizeAuditValue(metadata.sourceField || "unknown", 24)}`,
      `raw=${sanitizeAuditValue(metadata.gatewayStatusRaw || "")}`,
      `normalized=${sanitizeAuditValue(metadata.gatewayStatusNormalized || "")}`,
    ].join(" | ");

    const safeBaseNote = sanitizeAuditValue(note, 140) || "Webhook payment status: pending";
    const auditNote = truncateAuditNote(`${safeBaseNote} (${details})`);

    const { data: orderData } = await supabaseAdmin
      .from("orders")
      .select("status_history, voucher_claim_id")
      .eq("id", orderId)
      .single();

    const historyEntry = {
      status: nextStatus,
      notes: auditNote,
      actor: "webhook",
      timestamp: new Date().toISOString(),
    };

    const { data: updatedOrder, error } = await supabaseAdmin
      .from("orders")
      .update({
        status: nextStatus,
        status_history: [...(orderData?.status_history || []), historyEntry],
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .select()
      .single();

    if (error) throw error;

    // ── Baru tandai voucher "used" begitu status berhasil jadi "paid" ──
    if (nextStatus === "paid") {
      await markVoucherAsUsed(updatedOrder);
    }

    return updatedOrder;
  },
  createJsonResponse: (body, init) => NextResponse.json(body, init),
});

export async function POST(request) {
  return paymentWebhookHandler(request);
}