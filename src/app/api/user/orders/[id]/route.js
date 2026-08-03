import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { mapOrderDoc } from "@/app/api/orders/orderService";
import { createUserOrderDetailHandler } from "./orderDetailRouteHandler";

export const dynamic = "force-dynamic";

const userOrderDetailHandler = createUserOrderDetailHandler({
  db,
  mapOrderDoc,
  createJsonResponse: (body, init) => NextResponse.json(body, init),
});

export async function GET(request, context) {
  return userOrderDetailHandler(request, context);
}
