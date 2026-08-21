import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdmin } from '@/lib/apiAuth';
import { applyOrderStatusUpdate } from '@/lib/orderStatusHelper';

export const dynamic = 'force-dynamic';

export async function PUT(request, context) {
  try {
    await verifyAdmin(request);
    const params = await context.params;
    const { id } = params;
    const { action, admin_note } = await request.json(); // 'approve' or 'reject', and admin_note

    // 1. Dapatkan detail return
    const { data: ret, error: fetchError } = await supabaseAdmin
      .from('return_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !ret) throw new Error('Return request tidak ditemukan');
    if (ret.status !== 'requested' && ret.status !== 'pending') throw new Error('Return sudah diproses');

    if (action === 'approve') {
      // 2. Set status return menjadi completed
      const { error: updateError } = await supabaseAdmin
        .from('return_requests')
        .update({ status: 'approved', admin_note: admin_note || 'Disetujui admin' })
        .eq('id', id);
        
      if (updateError) throw new Error(updateError.message);

      // 3. Tambahkan saldo ke dompet user (Refund)
      const { data: orderData } = await supabaseAdmin
        .from('orders')
        .select('amount')
        .eq('id', ret.order_id)
        .single();
      
      const refundAmount = orderData?.amount || 0;
      
      const { data: wallet } = await supabaseAdmin.from('wallets').select('balance').eq('user_id', ret.user_id).single();
      const newBalance = Number(wallet?.balance || 0) + Number(refundAmount);
      await supabaseAdmin.from('wallets').update({ balance: newBalance }).eq('user_id', ret.user_id);

      // 4. Catat transaksi refund
      await supabaseAdmin.from('wallet_transactions').insert({
        wallet_id: ret.user_id,
        type: 'refund',
        amount: refundAmount,
        status: 'completed',
        reference_id: ret.order_id,
        description: `Refund pesanan #${ret.order_id}`
      });

      // 5. Ubah status pesanan menjadi 'returned' & balikan stok
      await applyOrderStatusUpdate(supabaseAdmin, {
        orderId: ret.order_id,
        status: 'returned',
        actorId: 'admin'
      });

    } else if (action === 'reject') {
      // 2. Set status return menjadi rejected
      const { error: updateError } = await supabaseAdmin
        .from('return_requests')
        .update({ status: 'rejected', admin_note: admin_note || 'Ditolak admin' })
        .eq('id', id);
        
      if (updateError) throw new Error(updateError.message);

      // Ubah status pesanan kembali ke 'delivered' (karena return ditolak)
      await applyOrderStatusUpdate(supabaseAdmin, {
        orderId: ret.order_id,
        status: 'delivered',
        actorId: 'admin'
      });
    } else {
      throw new Error('Aksi tidak valid');
    }

    return NextResponse.json({ success: true, message: `Return berhasil di-${action}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('Unauthorized') ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
