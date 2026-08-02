
import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

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

// GET /api/users/[userId]/addresses -> Get all addresses for a user
export async function GET(request, { params }) {
  try {
    const { userId } = params;
    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const addressesRef = db.collection("users").doc(userId).collection("addresses");
    const snapshot = await addressesRef.orderBy("createdAt", "desc").get();

    if (snapshot.empty) {
      return NextResponse.json([], { status: 200 });
    }

    const addresses = snapshot.docs.map(serializeData);
    return NextResponse.json(addresses, { status: 200 });
  } catch (error) {
    console.error("Failed to get addresses:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST /api/users/[userId]/addresses -> Add a new address
export async function POST(request, { params }) {
  try {
    const { userId } = params;
    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const body = await request.json();
    const { recipientName, recipientPhone, street, city, province, postalCode, label, isPrimary } = body;

    if (!recipientName || !recipientPhone || !street || !city || !province) {
      return NextResponse.json({ error: "Missing required address fields" }, { status: 400 });
    }

    const addressesRef = db.collection("users").doc(userId).collection("addresses");
    
    // If isPrimary is true, we need to ensure no other address is primary.
    if (isPrimary) {
        const primaryQuery = await addressesRef.where("isPrimary", "==", true).get();
        const batch = db.batch();
        primaryQuery.forEach(doc => {
            batch.update(doc.ref, { isPrimary: false });
        });
        await batch.commit();
    }

    const newAddress = {
      ...body,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const newDocRef = await addressesRef.add(newAddress);
    const newDoc = await newDocRef.get();

    return NextResponse.json(serializeData(newDoc), { status: 201 });
  } catch (error) {
    console.error("Failed to add address:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
