import { getAuth } from "firebase-admin/auth";
import { reauthenticate, updatePassword } from "firebase/auth";
import { EmailAuthProvider } from "firebase/auth";

// Helper untuk verifikasi token Firebase dari client
async function verifyUser(authHeader) {
  if (!authHeader) {
    throw new Error("No authorization header provided.");
  }
  const token = authHeader.split("Bearer ")[1];
  if (!token) {
    throw new Error("Invalid authorization header format.");
  }
  // This verifies the token is valid, but we need the user object on client-side for re-auth
  return getAuth().verifyIdToken(token);
}

export async function POST(request) {
  let decodedToken;
  try {
    decodedToken = await verifyUser(request.headers.get("Authorization"));
  } catch (error) {
    return new Response(JSON.stringify({ error: `Authentication failed: ${error.message}` }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  const { newPassword } = await request.json();

  if (!newPassword || newPassword.length < 6) {
    return new Response(JSON.stringify({ error: "Password must be at least 6 characters long." }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  try {
    await getAuth().updateUser(decodedToken.uid, {
      password: newPassword,
    });

    return new Response(JSON.stringify({ message: "Password updated successfully." }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Error updating password:", error);
    let errorMessage = "Failed to update password.";
    if (error.code === 'auth/weak-password') {
        errorMessage = "The new password is too weak.";
    }
    return new Response(JSON.stringify({ error: errorMessage }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
