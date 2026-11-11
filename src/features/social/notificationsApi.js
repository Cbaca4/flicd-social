import { supabase, createAccountClient } from "../../lib/supabase";
import { captureAuthScope } from "../../app/authScope.js";

export async function getNotifications({ limit = 50 } = {}) {
  const { data, error } = await supabase
    .from("notifications")
    .select(`
      id,
      type,
      body,
      dump_id,
      created_at,
      read_at,
      actor:actor_id (
        id,
        username,
        display_name,
        avatar_url
      )
    `)
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 100)));

  if (error) throw error;
  return data || [];
}

export async function getUnreadNotificationCount() {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);

  if (error) throw error;
  return count || 0;
}

export async function markNotificationRead(id, authScope) {
  const scope = captureAuthScope(authScope), client = createAccountClient(scope);
  if (!id) return;
  const { error } = await client
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id).eq("recipient_id", scope.user);

  if (error) throw error;
}

export async function markAllNotificationsRead(authScope) {
  const scope = captureAuthScope(authScope), client = createAccountClient(scope);
  const { error } = await client
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null).eq("recipient_id", scope.user);

  if (error) throw error;
}
