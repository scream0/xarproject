import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyUser } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const user = await verifyUser(request);

    // Get wallet balance
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from('wallets')
      .select('balance')
      .eq('user_id', user.id)
      .single();

    if (walletError && walletError.code !== 'PGRST116') {
      throw new Error(walletError.message);
    }

    let balance = 0;
    if (wallet) {
      balance = wallet.balance;
    } else {
      // Create wallet if it doesn't exist
      const { data: newWallet, error: insertError } = await supabaseAdmin
        .from('wallets')
        .insert({ user_id: user.id, balance: 0 })
        .select('balance')
        .single();
      
      if (!insertError && newWallet) {
        balance = newWallet.balance;
      }
    }

    // Get wallet transactions
    const { data: transactions, error: txError } = await supabaseAdmin
      .from('wallet_transactions')
      .select('*')
      .eq('wallet_id', user.id)
      .order('created_at', { ascending: false });

    if (txError) {
      throw new Error(txError.message);
    }

    return NextResponse.json({
      success: true,
      balance,
      transactions: transactions || []
    });

  } catch (error) {
    console.error('Wallet fetch error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('Unauthorized') ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
