import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function getUserIdFromToken(authHeader) {
  if (!authHeader) {
    throw new Error("No authorization header provided.");
  }
  const token = authHeader.split("Bearer ")[1];
  if (!token) {
    throw new Error("Invalid authorization header format.");
  }
  
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

  if (error) {
    throw new Error(`Token verification failed: ${error.message}`);
  }
  if (!user) {
    throw new Error("User not found for the provided token.");
  }
  return user.id;
}

export async function POST(request) {
  let userId;
  try {
    userId = await getUserIdFromToken(request.headers.get("Authorization"));
  } catch (error) {
    return new Response(JSON.stringify({ error: `Authentication failed: ${error.message}` }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  const { newPassword } = await request.json();

  if (!newPassword || newPassword.length < 6) {
    return new Response(JSON.stringify({ error: "Password must be at least 6 characters long." }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  try {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (error) {
        throw error;
    }

    return new Response(JSON.stringify({ message: "Password updated successfully." }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Error updating password:", error);
    let errorMessage = "Failed to update password.";
    // Supabase might return a more specific error message in error.message
    if (error.message.toLowerCase().includes('password')) {
        errorMessage = error.message;
    }
    return new Response(JSON.stringify({ error: errorMessage }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
