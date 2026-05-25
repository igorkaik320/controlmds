import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is admin
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await userClient.auth.getUser();
    if (!caller) throw new Error("Not authenticated");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: callerRoles } = await adminClient.from("user_roles").select("role").eq("user_id", caller.id);
    const isAdmin = callerRoles?.some((r: any) => r.role === "admin");
    if (!isAdmin) throw new Error("Not authorized - admin only");

    const { email, password, display_name } = await req.json();
    const displayName = String(display_name || "").trim();
    if (!email || !password || !displayName) throw new Error("Missing required fields");

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    });

    if (createError) throw createError;
    if (!newUser.user?.id) throw new Error("User was not created");

    const now = new Date().toISOString();
    const { data: existingProfile, error: profileLookupError } = await adminClient
      .from("profiles")
      .select("user_id")
      .eq("user_id", newUser.user.id)
      .maybeSingle();
    if (profileLookupError) throw profileLookupError;

    if (existingProfile) {
      const { error: updateProfileError } = await adminClient
        .from("profiles")
        .update({ display_name: displayName, updated_at: now })
        .eq("user_id", newUser.user.id);
      if (updateProfileError) throw updateProfileError;
    } else {
      const { error: insertProfileError } = await adminClient
        .from("profiles")
        .insert({
          user_id: newUser.user.id,
          display_name: displayName,
          role: "operador",
          ativo: true,
          created_at: now,
          updated_at: now,
        });
      if (insertProfileError) throw insertProfileError;
    }

    const { data: existingRoles, error: rolesLookupError } = await adminClient
      .from("user_roles")
      .select("id")
      .eq("user_id", newUser.user.id)
      .limit(1);
    if (rolesLookupError) throw rolesLookupError;

    if (!existingRoles || existingRoles.length === 0) {
      const { error: insertRoleError } = await adminClient
        .from("user_roles")
        .insert({ user_id: newUser.user.id, role: "operador" });
      if (insertRoleError) throw insertRoleError;
    }

    return new Response(JSON.stringify({ user: newUser.user }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
