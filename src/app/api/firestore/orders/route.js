
import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

// Helper to serialize data
function serializeData(doc) {
  const data = doc.data();
  if (!data) return null;

  // Serialize Timestamps
  for (const key in data) {
    if (data[key]?.toDate) {
      data[key] = data[key].toDate().toISOString();
    }
  }
  return { id: doc.id, ...data };
}

// GET /api/firestore/orders -> Get all orders or orders for a specific user
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    let query = db.collection("orders");
    if (userId) {
      query = query.where("userId", "==", userId);
    }

    const snapshot = await query.orderBy("createdAt", "desc").get();

    if (snapshot.empty) {
      return NextResponse.json([], { status: 200 });
    }

    const orders = snapshot.docs.map(serializeData);
    return NextResponse.json(orders, { status: 200 });
  } catch (error) {
    console.error("Failed to get orders:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST /api/firestore/orders -> Create a new order
export async function POST(request) {
    // In a real app, you'd get the userId from the auth token
    const body = await request.json();
    const { userId, orderId, items, address, total } = body;

    if (!userId || !orderId || !items || !address || !total) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    try {
        const orderRef = db.collection("orders").doc(orderId);
        await orderRef.set({
            userId,
            items,
            shippingAddress: address,
            total,
            status: "pending",
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        return NextResponse.json({ message: "Order created successfully" });
    } catch (error) {
        console.error("Failed to create order:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

// PUT /api/firestore/orders -> Update an order status
export async function PUT(request) {
    // Basic auth check
    const secret = request.headers.get('x-admin-secret');
    if (secret !== process.env.ADMIN_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { orderId, status } = await request.json();
    if (!orderId || !status) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    try {
        const orderRef = db.collection("orders").doc(orderId);
        const orderDoc = await orderRef.get();

        if (!orderDoc.exists) {
            return NextResponse.json({ error: "Order not found" }, { status: 404 });
        }

        await orderRef.update({
            status,
            updatedAt: FieldValue.serverTimestamp(),
        });

        // If order is paid, update stock
        if (status === 'paid' || status === 'processing') {
            const order = orderDoc.data();
            const stockUpdatePromises = order.items.map(item => {
                return fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/firestore/products`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-admin-secret': process.env.ADMIN_SECRET,
                    },
                    body: JSON.stringify({
                        productId: item.productId,
                        variantId: item.variantId,
                        quantity: item.quantity,
                    }),
                });
            });

            await Promise.all(stockUpdatePromises);
        }

        return NextResponse.json({ message: "Order updated successfully" });
    } catch (error) {
        console.error("Failed to update order:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
