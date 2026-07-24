import { db } from "@/lib/firebaseAdmin";
import { getAuth } from "firebase-admin/auth";
import { promises as fs } from "fs";
import path from "path";

// Helper to check for admin privileges (Supports Custom Claims & Firestore users collection)
async function verifyAdmin(authHeader) {
  if (!authHeader) throw new Error("No authorization header.");
  const token = authHeader.split("Bearer ")[1];
  if (!token) throw new Error("Invalid token format.");

  const decodedToken = await getAuth().verifyIdToken(token);
  const uid = decodedToken.uid;

  // 1. Cek dari Firebase Auth Custom Claims (Token)
  if (decodedToken.role === "admin" || decodedToken.admin === true) {
    return decodedToken;
  }

  // 2. Cek dari Firebase Auth Custom Claims (User Record)
  try {
    const userRecord = await getAuth().getUser(uid);
    if (
      userRecord.customClaims?.role === "admin" ||
      userRecord.customClaims?.admin === true
    ) {
      return decodedToken;
    }
  } catch (e) {
    // Abaikan jika gagal ambil user record
  }

  // 3. Fallback: Cek langsung dari dokumen Firestore koleksi 'users'
  try {
    const userDoc = await db.collection("users").doc(uid).get();
    if (userDoc.exists && userDoc.data()?.role === "admin") {
      return decodedToken;
    }
  } catch (e) {
    // Abaikan jika gagal cek database
  }

  throw new Error("User is not an administrator.");
}

const settingsDocRef = db.collection("store_config").doc("main");

// GET -> Fetch current store settings (Auto-create if not exists)
export async function GET(request) {
  try {
    await verifyAdmin(request.headers.get("Authorization"));

    let doc = await settingsDocRef.get();

    if (!doc.exists) {
      const defaultSettings = {
        storeName: "XAR Perfume",
        storeEmail: "contact@xar.com",
        currency: "IDR",
        lowStockThreshold: 10,
        midtransServerKey: "",
        midtransClientKey: "",
      };

      await settingsDocRef.set(defaultSettings);
      doc = await settingsDocRef.get();
    }

    const settings = doc.data();

    // IMPORTANT: Mask sensitive keys before sending to the client
    const clientSafeSettings = {
      ...settings,
      midtransServerKey: settings.midtransServerKey
        ? "••••••••••••••••••••••••••••••••"
        : "",
      midtransClientKey: settings.midtransClientKey
        ? "••••••••••••••••••••"
        : "",
    };

    return new Response(JSON.stringify(clientSafeSettings), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: `Verification failed: ${error.message}` }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }
}

// PUT -> Update store settings
export async function PUT(request) {
  try {
    await verifyAdmin(request.headers.get("Authorization"));
    const newSettings = await request.json();

    const updateData = {};

    // Only update fields that are actually provided in the request
    if (newSettings.storeName) updateData.storeName = newSettings.storeName;
    if (newSettings.storeEmail) updateData.storeEmail = newSettings.storeEmail;
    if (newSettings.currency) updateData.currency = newSettings.currency;
    if (newSettings.lowStockThreshold)
      updateData.lowStockThreshold = Number(newSettings.lowStockThreshold);

    // Handle sensitive keys: only update if a new, non-placeholder value is provided
    let envFileContent = "";
    const envPath = path.resolve(process.cwd(), ".env.local");

    try {
      envFileContent = await fs.readFile(envPath, "utf8");
    } catch (e) {
      // .env.local might not exist, that's okay
    }

    if (
      newSettings.midtransServerKey &&
      !newSettings.midtransServerKey.includes("•")
    ) {
      updateData.midtransServerKey = newSettings.midtransServerKey;
      envFileContent = updateEnvVariable(
        envFileContent,
        "MIDTRANS_SERVER_KEY",
        newSettings.midtransServerKey,
      );
    }
    if (
      newSettings.midtransClientKey &&
      !newSettings.midtransClientKey.includes("•")
    ) {
      updateData.midtransClientKey = newSettings.midtransClientKey;
      envFileContent = updateEnvVariable(
        envFileContent,
        "NEXT_PUBLIC_MIDTRANS_CLIENT_KEY",
        newSettings.midtransClientKey,
      );
    }

    if (Object.keys(updateData).length > 0) {
      await settingsDocRef.set(updateData, { merge: true });
    }

    if (envFileContent) {
      await fs.writeFile(envPath, envFileContent);
    }

    return new Response(
      JSON.stringify({ message: "Settings updated successfully." }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Failed to update settings:", error);
    return new Response(
      JSON.stringify({ error: `Update failed: ${error.message}` }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

function updateEnvVariable(content, key, value) {
  const regex = new RegExp(`^${key}=.*$`, "m");
  const newEntry = `${key}="${value}"`;
  if (regex.test(content)) {
    return content.replace(regex, newEntry);
  } else {
    return content + `\n${newEntry}`;
  }
}
