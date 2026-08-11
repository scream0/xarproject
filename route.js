import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import Midtrans from 'midtrans-client';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  const orderId = params.id;
  const supabase = createRouteHandlerClient({ cookies });

  // 1. Ambil data order dari database
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, status, amount, customer_phone, customer_name') // Menambahkan customer_phone dan customer_name
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    return NextResponse.json({ message: 'Order not found' }, { status: 404 });
  }

  // Jangan lakukan pengecekan jika order sudah dalam status final (completed/success/cancelled)
  if (['completed', 'success', 'cancelled'].includes(order.status)) {
    return NextResponse.json({ message: 'Order status is final, no sync needed.', status: order.status });
  }

  // 2. Inisialisasi Midtrans client
  const snap = new Midtrans.Snap({
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    clientKey: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY,
  });

  try {
    // 3. Panggil getTransactionStatus dari Midtrans
    const statusResponse = await snap.transaction.status(orderId);
    const { transaction_status: midtransStatus, fraud_status: fraudStatus } = statusResponse;

    let newStatus = order.status;
    let statusChanged = false;

    // 4. Logika pemetaan status Midtrans -> status internal
    if (midtransStatus === 'capture' && fraudStatus === 'accept') {
      newStatus = 'processing';
    } else if (midtransStatus === 'settlement') {
      newStatus = 'success';
    } else if (midtransStatus === 'cancel' || midtransStatus === 'deny' || midtransStatus === 'expire') {
      newStatus = 'cancelled';
    } else if (midtransStatus === 'pending') {
      newStatus = 'pending';
    }

    // 5. Update database jika status berubah
    if (newStatus !== order.status) {
      statusChanged = true;
      const { error: updateError } = await supabase
        .from('orders')
        .update({ 
            status: newStatus,
            status_history: supabase.sql`status_history || '{"status": "${newStatus}", "timestamp": "${new Date().toISOString()}"}'::jsonb`
        })
        .eq('id', orderId);

      if (updateError) {
        console.error('Error updating order status:', updateError);
        return NextResponse.json({ message: 'Failed to update order status', error: updateError.message }, { status: 500 });
      }

      // Kirim notifikasi WhatsApp jika status berubah menjadi 'processing' atau 'success'
      if (newStatus === 'processing' || newStatus === 'success') {
        try {
          const whatsappMessage = `Halo ${order.customer_name},\n\nPesanan Anda dengan ID #${order.id.substring(0, 8)} telah berhasil diproses dan statusnya sekarang: *${newStatus.toUpperCase()}*.\n\nTerima kasih telah berbelanja di toko kami!`;
          // Gunakan variabel lingkungan untuk URL server WhatsApp di produksi
          await fetch(process.env.WHATSAPP_SERVER_URL || 'http://localhost:3001/send-message', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              phone: order.customer_phone,
              message: whatsappMessage,
            }),
          });
          console.log(`WhatsApp notification sent for order ${orderId}`);
        } catch (whatsappError) {
          console.error('Failed to send WhatsApp notification:', whatsappError);
          // Kegagalan mengirim notifikasi WhatsApp tidak boleh menghalangi respons API utama
        }
      }
    }

    return NextResponse.json({ message: 'Status synchronized successfully', statusChanged, newStatus });

  } catch (error) {
    console.error('Midtrans API error:', error);
    return NextResponse.json({ message: 'Failed to get transaction status from Midtrans', error: error.message }, { status: 500 });
  }
}