import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const RAJAONGKIR_BASE_URL =
  process.env.RAJAONGKIR_BASE_URL || "https://api.rajaongkir.com/starter";
const API_KEY =
  process.env.RAJAONGKIR_API_KEY || process.env.NEXT_PUBLIC_RAJAONGKIR_API_KEY;

/**
 * GET /api/ongkir
 * Proxy ke RajaOngkir untuk menghitung biaya ongkir (cek tarif).
 *
 * Query params:
 *   origin       (string)  ID kota asal (wajib)
 *   destination  (string)  ID kota tujuan (wajib)
 *   weight       (number)  Berat paket dalam gram (wajib, >0)
 *   courier      (string)  Kode kurir: jne | tiki | pos | jnt | sicepat (opsional, default semua)
 *
 * Contoh:
 *   /api/ongkir?origin=501&destination=114&weight=1700&courier=jne
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const origin = searchParams.get("origin");
    const destination = searchParams.get("destination");
    const weight = searchParams.get("weight");
    const courier = searchParams.get("courier") || "jne";

    // Validasi parameter wajib
    if (!origin || !destination || !weight) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Parameter origin, destination, dan weight (gram) wajib diisi.",
        },
        { status: 400 },
      );
    }

    const weightNumber = Number(weight);
    if (!Number.isFinite(weightNumber) || weightNumber <= 0) {
      return NextResponse.json(
        { success: false, error: "Weight harus berupa angka positif (gram)." },
        { status: 400 },
      );
    }

    if (!API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error:
            "RAJAONGKIR_API_KEY belum diset di .env.local. Silakan daftar di rajaongkir.com dan tambahkan API key Anda.",
        },
        { status: 500 },
      );
    }

    // Panggil RajaOngkir /cost endpoint
    const body = new URLSearchParams();
    body.append("origin", origin);
    body.append("destination", destination);
    body.append("weight", String(weightNumber));
    body.append("courier", courier);

    const rajaResponse = await fetch(`${RAJAONGKIR_BASE_URL}/cost`, {
      method: "POST",
      headers: {
        key: API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      cache: "no-store",
    });

    const rajaData = await rajaResponse.json();

    if (!rajaResponse.ok) {
      console.error("RajaOngkir cost error:", rajaData);
      return NextResponse.json(
        {
          success: false,
          error:
            rajaData?.rajaongkir?.status?.description ||
            rajaData?.status?.description ||
            "Gagal menghitung ongkir.",
        },
        { status: rajaResponse.status },
      );
    }

    const result = rajaData?.rajaongkir?.results || [];

    // Normalisasi data tarif ke bentuk yang mudah dipakai frontend
    const costs = result.map((courierResult) => ({
      courier: courierResult.code,
      courierName: courierResult.name,
      services: (courierResult.costs || []).map((service) => ({
        service: service.service,
        description: service.description,
        cost: Number(service.cost?.[0]?.value || 0),
        etd: service.cost?.[0]?.etd || "-",
        note: service.cost?.[0]?.note || "",
      })),
    }));

    return NextResponse.json({
      success: true,
      origin,
      destination,
      weight: weightNumber,
      costs,
    });
  } catch (error) {
    console.error("Ongkir API error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}

