import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyUser } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const user = await verifyUser(request);
    const body = await request.json();
    const { amount } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Nominal penarikan tidak valid' },
        { status: 400 }
      );
    }

    // 1. Dapatkan info bank user dan saldo wallet
    const [profileRes, walletRes] = await Promise.all([
      supabaseAdmin.from('profiles').select('bank_name, bank_account_number, bank_account_name').eq('id', user.id).single(),
      supabaseAdmin.from('wallets').select('balance').eq('user_id', user.id).single()
    ]);

    if (profileRes.error) throw new Error('Gagal mengambil profil user');
    if (walletRes.error) throw new Error('Gagal mengambil data dompet');

    const profile = profileRes.data;
    const wallet = walletRes.data;

    // 2. Validasi Info Bank
    if (!profile.bank_name || !profile.bank_account_number || !profile.bank_account_name) {
      return NextResponse.json(
        { success: false, error: 'Silakan lengkapi informasi rekening bank terlebih dahulu.' },
        { status: 400 }
      );
    }

    // 3. Validasi Saldo
    if (wallet.balance < amount) {
      return NextResponse.json(
        { success: false, error: 'Saldo tidak mencukupi.' },
        { status: 400 }
      );
    }

    // 4. Kurangi saldo & Buat transaksi (RPC or manual since we don't have decrement_wallet RPC yet)
    // For safety, we should ideally use a transaction or RPC.
    // For now, since it's a direct decrement:
    const newBalance = Number(wallet.balance) - Number(amount);
    const { error: updateError } = await supabaseAdmin
      .from('wallets')
      .update({ balance: newBalance })
      .eq('user_id', user.id);

    if (updateError) throw new Error('Gagal mengupdate saldo: ' + updateError.message);

    // 5. Catat transaksi penarikan
    const description = `Penarikan ke ${profile.bank_name} - ${profile.bank_account_number} (A/N ${profile.bank_account_name})`;
    const { data: tx, error: txError } = await supabaseAdmin
      .from('wallet_transactions')
      .insert({
        wallet_id: user.id,
        type: 'withdrawal',
        amount: amount,
        status: 'pending',
        description: description
      })
      .select()
      .single();

    if (txError) {
      // Revert saldo if failed
      await supabaseAdmin.from('wallets').update({ balance: wallet.balance }).eq('user_id', user.id);
      throw new Error('Gagal membuat transaksi: ' + txError.message);
    }

    return NextResponse.json({
      success: true,
      message: 'Pengajuan penarikan berhasil',
      transaction: tx
    });

  } catch (error) {
    console.error('Withdraw API error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('Unauthorized') ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
