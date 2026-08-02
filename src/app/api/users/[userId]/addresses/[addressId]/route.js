
import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

// Helper to serialize data
function serializeData(doc) {
  const data = doc.data();
  if (!data) return null;
  
  for (const key in data) {
    if (data[key]?.toDate) {
      data[key] = data[key].toDate().toISOString();
    }
  }
  return { id: doc.id, ...data };
}

// PUT /api/users/[userId]/addresses/[addressId] -> Update an address
export async function PUT(request, { params }) {
  try {
    const { userId, addressId } = params;
    if (!userId || !addressId) {
      return NextResponse.json({ error: "User ID and Address ID are required" }, { status: 400 });
    }

    const body = await request.json();
    const { recipientName, recipientPhone, street, city, province, postalCode, label, isPrimary } = body;

    if (!recipientName || !recipientPhone || !street || !city || !province) {
      return NextResponse.json({ error: "Missing required address fields" }, { status: 400 });
    }

    const addressRef = db.collection("users").doc(userId).collection("addresses").doc(addressId);
    
    // If isPrimary is true, unset other primary addresses
    if (isPrimary) {
        const addressesRef = db.collection("users").doc(userId).collection("addresses");
        const primaryQuery = await addressesRef.where("isPrimary", "==", true).get();
        const batch = db.batch();
        primaryQuery.forEach(doc => {
            if (doc.id !== addressId) {
                batch.update(doc.ref, { isPrimary: false });
            }
        });
        await batch.commit();
    }

    const updatedAddress = {
      ...body,
      updatedAt: FieldValue.serverTimestamp(),
    };

    await addressRef.update(updatedAddress);

    const updatedDoc = await addressRef.get();
    return NextResponse.json(serializeData(updatedDoc), { status: 200 });
  } catch (error) {
    console.error("Failed to update address:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE /api/users/[userId]/addresses/[addressId] -> Delete an address
export async function DELETE(request, { params }) {
  try {
    const { userId, addressId } = params;
    if (!userId || !addressId) {
      return NextResponse.json({ error: "User ID and Address ID are required" }, { status: 400 });
    }

    const addressRef = db.collection("users").doc(userId).collection("addresses").doc(addressId);
    await addressRef.delete();

    return NextResponse.json({ message: "Address deleted successfully" }, { status: 200 });
  } catch (error) {
    console.error("Failed to delete address:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PATCH /api/users/[userId]/addresses/[addressId]/set-primary -> Set an address as primary
export async function PATCH(request, { params }) {
    try {
        const { userId, addressId } = params;
        if (!userId || !addressId) {
            return NextResponse.json({ error: "User ID and Address ID are required" }, { status: 400 });
        }

        const addressesRef = db.collection("users").doc(userId).collection("addresses");
        const batch = db.batch();

        // Unset any existing primary address
        const primaryQuery = await addressesRef.where("isPrimary", "==", true).get();
        primaryQuery.forEach(doc => {
            batch.update(doc.ref, { isPrimary: false });
        });

        // Set the new primary address
        const newPrimaryRef = addressesRef.doc(addressId);
        batch.update(newPrimaryRef, { isPrimary: true });

        await batch.commit();

        return NextResponse.json({ message: "Primary address updated successfully" }, { status: 200 });
    } catch (error) {
        console.error("Failed to set primary address:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
