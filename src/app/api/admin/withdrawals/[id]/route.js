import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdmin } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function PUT(request, context) {
  try {
    await verifyAdmin(request);
    const params = await context.params;
    const { id } = params;
    const { action, description } = await request.json(); // 'approve' or 'reject', and admin note

    // 1. Ambil transaksi detail transaksi
    const { data: tx, error: fetchError } = await supabaseAdmin
      .from('wallet_transactions')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !tx) throw new Error('Transaksi tidak ditemukan');
    if (tx.status !== 'pending') throw new Error('Transaksi sudah diproses sebelumnya');
    if (tx.type !== 'withdrawal') throw new Error('Tipe transaksi tidak valid');

    if (action === 'approve') {
      // Update status menjadi completed
      const { error: updateError } = await supabaseAdmin
        .from('wallet_transactions')
        .update({ status: 'completed', description: description || 'Dana berhasil ditransfer' })
        .eq('id', id);
        
      if (updateError) throw new Error(updateError.message);

    } else if (action === 'reject') {
      // Set status menjadi rejected
      const { error: updateError } = await supabaseAdmin
        .from('wallet_transactions')
        .update({ status: 'rejected', description: description || 'Penarikan ditolak' })
        .eq('id', id);
        
      if (updateError) throw new Error(updateError.message);

      // 3. Kembalikan saldo ke dompet user
      // Get current balance
      const { data: wallet } = await supabaseAdmin.from('wallets').select('balance').eq('user_id', tx.wallet_id).single();
      const newBalance = Number(wallet?.balance || 0) + Number(tx.amount);
      
      await supabaseAdmin.from('wallets').update({ balance: newBalance }).eq('user_id', tx.wallet_id);
    } else {
      throw new Error('Aksi tidak valid');
    }

    return NextResponse.json({ success: true, message: `Penarikan dana berhasil di-${action}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('Unauthorized') ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
