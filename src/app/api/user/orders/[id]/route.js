import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createUserOrderDetailHandler } from "./orderDetailRouteHandler";

export const dynamic = "force-dynamic";

const userOrderDetailHandler = createUserOrderDetailHandler({
  db: supabaseAdmin,
  createJsonResponse: (body, init) => NextResponse.json(body, init),
});

export async function GET(request, context) {
  return userOrderDetailHandler(request, context);
}

