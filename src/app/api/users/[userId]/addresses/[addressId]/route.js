
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

function mapAddressRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    recipientName: row.recipient_name,
    recipientPhone: row.recipient_phone,
    street: row.street,
    city: row.city,
    cityId: row.city_id,
    province: row.province,
    postalCode: row.postal_code,
    label: row.label,
    isPrimary: row.is_primary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function PUT(request, { params }) {
  try {
    const { userId, addressId } = params;
    if (!userId || !addressId) {
      return NextResponse.json({ error: "User ID and Address ID are required" }, { status: 400 });
    }

    const body = await request.json();
    const { recipientName, recipientPhone, street, city, cityId, province, postalCode, label, isPrimary } = body;

    if (!recipientName || !recipientPhone || !street || !city || !province) {
      return NextResponse.json({ error: "Missing required address fields" }, { status: 400 });
    }

    if (isPrimary) {
      await supabaseAdmin
        .from("addresses")
        .update({ is_primary: false })
        .eq("user_id", userId);
    }

    const updatePayload = {
      recipient_name: recipientName,
      recipient_phone: recipientPhone,
      street,
      city,
      city_id: cityId || body.city_id || "",
      province,
      postal_code: postalCode || body.postalCode || "",
      label: label || "Rumah",
      is_primary: Boolean(isPrimary),
      updated_at: new Date().toISOString(),
    };

    const { data: updatedDoc, error } = await supabaseAdmin
      .from("addresses")
      .update(updatePayload)
      .eq("id", addressId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(mapAddressRow(updatedDoc), { status: 200 });
  } catch (error) {
    console.error("Failed to update address:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { userId, addressId } = params;
    if (!userId || !addressId) {
      return NextResponse.json({ error: "User ID and Address ID are required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("addresses")
      .delete()
      .eq("id", addressId)
      .eq("user_id", userId);

    if (error) throw error;

    return NextResponse.json({ message: "Address deleted successfully" }, { status: 200 });
  } catch (error) {
    console.error("Failed to delete address:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { userId, addressId } = params;
    if (!userId || !addressId) {
      return NextResponse.json({ error: "User ID and Address ID are required" }, { status: 400 });
    }

    await supabaseAdmin
      .from("addresses")
      .update({ is_primary: false })
      .eq("user_id", userId);

    const { error } = await supabaseAdmin
      .from("addresses")
      .update({ is_primary: true })
      .eq("id", addressId)
      .eq("user_id", userId);

    if (error) throw error;

    return NextResponse.json({ message: "Primary address updated successfully" }, { status: 200 });
  } catch (error) {
    console.error("Failed to set primary address:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

