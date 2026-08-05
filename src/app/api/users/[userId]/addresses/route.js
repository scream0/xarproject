
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

export async function GET(request, { params }) {
  try {
    const { userId } = params;
    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("addresses")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    const addresses = (data || []).map(mapAddressRow);
    return NextResponse.json(addresses, { status: 200 });
  } catch (error) {
    console.error("Failed to get addresses:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { userId } = params;
    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
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

    const newAddressPayload = {
      user_id: userId,
      recipient_name: recipientName,
      recipient_phone: recipientPhone,
      street,
      city,
      city_id: cityId || body.city_id || "",
      province,
      postal_code: postalCode || body.postalCode || "",
      label: label || "Rumah",
      is_primary: Boolean(isPrimary),
    };

    const { data: createdAddress, error: insertError } = await supabaseAdmin
      .from("addresses")
      .insert(newAddressPayload)
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json(mapAddressRow(createdAddress), { status: 201 });
  } catch (error) {
    console.error("Failed to add address:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

