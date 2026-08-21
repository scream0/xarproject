import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdmin } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await verifyAdmin(request);

    const { data: withdrawals, error } = await supabaseAdmin
      .from('wallet_transactions')
      .select('*')
      .eq('type', 'withdrawal')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    // Fetch profiles manually
    const userIds = withdrawals.map(w => w.wallet_id);
    const { data: profilesData } = await supabaseAdmin
      .from('profiles')
      .select('id, username, full_name, email, bank_name, bank_account_number, bank_account_name')
      .in('id', userIds);

    const profilesMap = (profilesData || []).reduce((acc, p) => {
      acc[p.id] = p;
      return acc;
    }, {});

    const enrichedWithdrawals = withdrawals.map(w => ({
      ...w,
      profiles: profilesMap[w.wallet_id] || null
    }));

    return NextResponse.json({ success: true, withdrawals: enrichedWithdrawals });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('Unauthorized') ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
