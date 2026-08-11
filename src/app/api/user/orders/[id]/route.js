import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createUserOrderDetailHandler } from "./orderDetailRouteHandler";

export const dynamic = "force-dynamic";

const userOrderDetailHandler = createUserOrderDetailHandler({
  db: supabaseAdmin,
  createJsonResponse: (body, init) => NextResponse.json(body, init),
});

export async function GET(request, context) {
  const { searchParams } = new URL(request.url);
  const requestedUserId = searchParams.get("userId");
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const { data: { user }, error } = token
    ? await supabaseAdmin.auth.getUser(token)
    : { data: { user: null }, error: new Error("Missing authorization") };
  if (error || !user || user.id !== requestedUserId) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  return userOrderDetailHandler(request, context);
}

