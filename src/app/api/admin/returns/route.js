import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdmin } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await verifyAdmin(request);

    const { data: returns, error } = await supabaseAdmin
      .from('return_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    // Fetch profiles manually
    const userIds = returns.map(r => r.user_id);
    const { data: profilesData } = await supabaseAdmin
      .from('profiles')
      .select('id, username, full_name, email')
      .in('id', userIds);

    const profilesMap = (profilesData || []).reduce((acc, p) => {
      acc[p.id] = p;
      return acc;
    }, {});

    const enrichedReturns = returns.map(r => ({
      ...r,
      profiles: profilesMap[r.user_id] || null
    }));

    return NextResponse.json({ success: true, returns: enrichedReturns });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('Unauthorized') ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
